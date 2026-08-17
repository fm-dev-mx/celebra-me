/**
 * Diagnostic enrichment after canonical classification and promotion decisions.
 * Must not change action, schema lifecycle, or operation readiness.
 */
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { isManagedInvitationPath } from '../../src/lib/intake/mutations/ownership.ts';
import type {
	CanonicalDiagnostic,
	DiagnosticDomain,
	CanonicalStatusView,
	DiagnosticCode,
	EvidenceState,
	TargetEnv,
} from '../../src/lib/status/types.ts';
import {
	diagnoseManagedBaselineError,
	ManagedBaselineError,
	resolveVerifiedManagedBaseline,
} from './managed-merge-baseline.ts';
import { RELEASE_SCHEMA_VERSION, buildSemanticAssetMap } from './normalized-invitation-release.ts';
import { apply3WaySemanticPatch } from './semantic-delta.ts';
import type { InvitationDefinition } from './invitations/invitation-definition.ts';
import type { LiveInvitationEvidenceRow } from '../status-core/promotional-evidence.ts';

const ENVS: TargetEnv[] = ['local', 'preview', 'production'];
const MAX_SEMANTIC_PATHS = 50;

function diagnostic(input: {
	code: DiagnosticCode;
	domain: DiagnosticDomain;
	evidence: EvidenceState;
	cause: string;
	slug?: string;
	environment?: TargetEnv;
	affectedFieldCount?: number;
	affectedSectionCount?: number;
	semanticPaths?: string[];
}): CanonicalDiagnostic {
	return {
		code: input.code,
		domain: input.domain,
		evidence: input.evidence,
		cause: input.cause,
		affectedFieldCount: input.affectedFieldCount ?? 0,
		affectedSectionCount: input.affectedSectionCount ?? 0,
		semanticPaths: input.semanticPaths ?? [],
		...(input.slug ? { slug: input.slug } : {}),
		...(input.environment ? { environment: input.environment } : {}),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assetDiagnostics(
	definition: InvitationDefinition,
	row: LiveInvitationEvidenceRow,
	environment: TargetEnv,
	evidence: EvidenceState,
): CanonicalDiagnostic[] {
	const expectedKeys = new Set(definition.assets.map((asset) => asset.key));
	const liveKeys = new Set(
		row.assets
			.map((asset) => asset.managedSourceKey)
			.filter((key): key is string => Boolean(key)),
	);
	const missing = [...expectedKeys].filter((key) => !liveKeys.has(key));
	const unreferenced = [...liveKeys].filter((key) => !expectedKeys.has(key));
	const unkeyed = row.assets.filter((asset) => !asset.managedSourceKey);
	const published = row.publishedVersion != null;
	const diagnostics: CanonicalDiagnostic[] = [];
	if (unkeyed.length > 0 && missing.length > 0) {
		diagnostics.push(
			diagnostic({
				code: 'ASSET_IDENTITY_UNVERIFIED',
				domain: 'content',
				evidence,
				cause: 'Managed assets exist without a unique semantic key mapping.',
				slug: definition.slug,
				environment,
				affectedFieldCount: missing.length + unkeyed.length,
				affectedSectionCount: 1,
			}),
		);
	} else if (missing.length > 0) {
		diagnostics.push(
			diagnostic({
				code: published ? 'REQUIRED_PUBLISHED_ASSET_MISSING' : 'UNPUBLISHED_ASSET_PENDING',
				domain: 'content',
				evidence,
				cause: published
					? 'A required published asset slot is empty.'
					: 'A required asset slot is still unpublished.',
				slug: definition.slug,
				environment,
				affectedFieldCount: missing.length,
				affectedSectionCount: 1,
			}),
		);
	}
	if (unreferenced.length > 0) {
		diagnostics.push(
			diagnostic({
				code: 'UNREFERENCED_MANAGED_ASSET',
				domain: 'content',
				evidence,
				cause: `Live database contains ${unreferenced.length} unreferenced managed asset(s): ${unreferenced.join(', ')}.`,
				slug: definition.slug,
				environment,
				affectedFieldCount: unreferenced.length,
				affectedSectionCount: 1,
				semanticPaths: unreferenced,
			}),
		);
	}
	return diagnostics;
}

function baselineDiagnostic(
	definition: InvitationDefinition,
	row: LiveInvitationEvidenceRow,
	environment: TargetEnv,
	evidence: EvidenceState,
): CanonicalDiagnostic | null {
	try {
		resolveVerifiedManagedBaseline(
			{
				managedProjection: row.managedProjection,
				hasManagedProjection: row.hasManagedProjection,
				releaseSchemaVersion: row.releaseSchemaVersion,
				appliedDraftUpdatedAt: row.appliedDraftUpdatedAt,
				appliedOperationId: row.appliedOperationId,
				appliedPublishedVersion: row.appliedPublishedVersion,
				appliedPublishedProjectionHash: row.appliedPublishedProjectionHash,
				appliedReceipt: row.appliedReceipt,
				latestMutationReceipt: row.latestReceipt,
			},
			RELEASE_SCHEMA_VERSION,
			{ requireProjection: false },
		);
		return null;
	} catch (error) {
		const baseline = diagnoseManagedBaselineError(error);
		const code: DiagnosticCode =
			error instanceof ManagedBaselineError &&
			error.classification === 'incompatible_normalization_version'
				? 'BASELINE_VERSION_INCOMPATIBLE'
				: 'BASELINE_UNAVAILABLE';
		return diagnostic({
			code,
			domain: 'content',
			evidence,
			cause:
				code === 'BASELINE_VERSION_INCOMPATIBLE'
					? 'The stored baseline used a different normalization version.'
					: `No verified managed baseline is available for this row (${baseline.classification}).`,
			slug: definition.slug,
			environment,
		});
	}
}

function semanticDiagnostics(
	definition: InvitationDefinition,
	row: LiveInvitationEvidenceRow,
	environment: TargetEnv,
	evidence: EvidenceState,
): CanonicalDiagnostic[] {
	if (row.detailBudgetExceeded) {
		return [
			diagnostic({
				code: 'DETAIL_BUDGET_EXCEEDED',
				domain: 'content',
				evidence,
				cause: 'Managed projection detail exceeded the safe payload budget.',
				slug: definition.slug,
				environment,
			}),
		];
	}
	if (!row.managedProjection || !isRecord(row.publishedContent ?? row.draftContent)) {
		return [];
	}
	const currentTarget = (row.publishedContent ?? row.draftContent) as Record<string, unknown>;
	let canonicalContent: Record<string, unknown>;
	try {
		const built = definition.buildPublishedContent(buildSemanticAssetMap(definition));
		if (!isRecord(built)) return [];
		canonicalContent = built;
	} catch {
		return [];
	}
	const patch = apply3WaySemanticPatch({
		previousCanonical: row.managedProjection,
		currentCanonical: canonicalContent,
		currentTarget,
		scope: definition.deliveryScope,
		targetName: `${environment}:${definition.slug}`,
		detectTargetOnlyDrift: true,
	});
	const managed = patch.deltas.filter((delta) => isManagedInvitationPath(delta.path));
	const paths = [...new Set(managed.map((delta) => delta.path))].sort();
	const sections = new Set(paths.map((path) => path.split(/[.[\]]/)[0]).filter(Boolean));
	const detailPaths = paths.length <= MAX_SEMANTIC_PATHS ? paths : [];
	if (managed.some((delta) => delta.status === 'BLOCKED_BY_SCOPE')) {
		return [
			diagnostic({
				code: 'DELIVERY_SCOPE_BLOCKED',
				domain: 'content',
				evidence,
				cause: 'Authorized delivery scope blocks one or more managed paths.',
				slug: definition.slug,
				environment,
				affectedFieldCount: paths.length,
				affectedSectionCount: sections.size,
				semanticPaths: detailPaths,
			}),
		];
	}
	if (managed.some((delta) => delta.status === 'DRIFT')) {
		return [
			diagnostic({
				code: 'MANAGED_DRIFT',
				domain: 'content',
				evidence,
				cause: 'Live managed content differs from the canonical definition on semantic paths.',
				slug: definition.slug,
				environment,
				affectedFieldCount: paths.length,
				affectedSectionCount: sections.size,
				semanticPaths: detailPaths,
			}),
		];
	}
	return [];
}

function collectEnvironmentSummaryDiagnostics(view: CanonicalStatusView): CanonicalDiagnostic[] {
	const diagnostics: CanonicalDiagnostic[] = [];
	for (const env of ENVS) {
		const summary = view.environments[env];
		if (summary.evidence !== 'UNVERIFIED' && !summary.environmentIdentityOk) {
			diagnostics.push(
				diagnostic({
					code: 'ENVIRONMENT_IDENTITY_CONFLICT',
					domain: 'schema',
					evidence: summary.evidence,
					cause: `Expected ${env === 'local' ? 'persistent-local' : env}; observed ${summary.targetClassification}.`,
					environment: env,
				}),
			);
		}
		if (summary.identityConflictsCount > 0) {
			diagnostics.push(
				diagnostic({
					code: 'AUTHORITATIVE_COUNT_MISMATCH',
					domain: 'content',
					evidence: summary.evidence,
					cause: `${summary.identityConflictsCount} duplicate active invitation slug(s).`,
					environment: env,
					affectedFieldCount: summary.identityConflictsCount,
				}),
			);
		}
	}
	return diagnostics;
}

function collectPromotionConflictDiagnostics(view: CanonicalStatusView): CanonicalDiagnostic[] {
	const diagnostics: CanonicalDiagnostic[] = [];
	for (const row of view.promotions) {
		if (row.reasonCode === 'IDENTITY_CONFLICT') {
			for (const env of ENVS) {
				if (row.environments[env] !== 'conflict') continue;
				diagnostics.push(
					diagnostic({
						code: 'INVITATION_IDENTITY_CONFLICT',
						domain: 'content',
						evidence: view.environments[env].evidence,
						cause: 'Duplicate or identity-conflicting invitation rows.',
						slug: row.slug,
						environment: env,
					}),
				);
			}
		}
	}
	return diagnostics;
}

function collectLiveRowDiagnostics(
	view: CanonicalStatusView,
	rowsByEnv: Record<TargetEnv, LiveInvitationEvidenceRow[]>,
	definitionBySlug: Map<string, InvitationDefinition>,
	includeSemanticDetail: boolean,
): CanonicalDiagnostic[] {
	const diagnostics: CanonicalDiagnostic[] = [];
	for (const env of ENVS) {
		const evidence = view.environments[env].evidence;
		for (const live of rowsByEnv[env] ?? []) {
			const definition = definitionBySlug.get(live.slug);
			if (!definition) continue;
			if (
				live.draftContent != null &&
				!eventContentSchema.safeParse(live.draftContent).success
			) {
				diagnostics.push(
					diagnostic({
						code: 'DRAFT_INVALID',
						domain: 'content',
						evidence,
						cause: 'Managed draft content does not satisfy the invitation contract.',
						slug: definition.slug,
						environment: env,
					}),
				);
			}
			diagnostics.push(...assetDiagnostics(definition, live, env, evidence));
			const baseline = baselineDiagnostic(definition, live, env, evidence);
			if (baseline) diagnostics.push(baseline);
			if (includeSemanticDetail) {
				diagnostics.push(...semanticDiagnostics(definition, live, env, evidence));
			}
		}
	}
	return diagnostics;
}

function collectStaleLifecycleDiagnostics(
	definitions: readonly InvitationDefinition[],
	view: CanonicalStatusView,
): CanonicalDiagnostic[] {
	const diagnostics: CanonicalDiagnostic[] = [];
	for (const definition of definitions) {
		if (definition.lifecycle !== 'in_progress') continue;
		const promotion = view.promotions.find((row) => row.slug === definition.slug);
		const inSync = view.inSyncSlugs.includes(definition.slug);
		const productionMatch = inSync || promotion?.environments.production === 'match';
		if (productionMatch) {
			diagnostics.push(
				diagnostic({
					code: 'LIFECYCLE_METADATA_STALE',
					domain: 'content',
					evidence: view.evidence,
					cause: 'Registry lifecycle is in_progress while Production matches canonical.',
					slug: definition.slug,
				}),
			);
		}
	}
	return diagnostics;
}

export function enrichCanonicalDiagnostics(input: {
	view: CanonicalStatusView;
	definitions: readonly InvitationDefinition[];
	rowsByEnv: Record<TargetEnv, LiveInvitationEvidenceRow[]>;
	includeSemanticDetail: boolean;
}): CanonicalDiagnostic[] {
	const definitionBySlug = new Map(input.definitions.map((item) => [item.slug, item]));
	const diagnostics: CanonicalDiagnostic[] = [
		...collectEnvironmentSummaryDiagnostics(input.view),
		...collectPromotionConflictDiagnostics(input.view),
		...collectLiveRowDiagnostics(
			input.view,
			input.rowsByEnv,
			definitionBySlug,
			input.includeSemanticDetail,
		),
		...collectStaleLifecycleDiagnostics(input.definitions, input.view),
	];

	diagnostics.sort((left, right) => {
		const env = (left.environment ?? '').localeCompare(right.environment ?? '');
		if (env !== 0) return env;
		const slug = (left.slug ?? '').localeCompare(right.slug ?? '');
		if (slug !== 0) return slug;
		return left.code.localeCompare(right.code);
	});
	return diagnostics;
}
