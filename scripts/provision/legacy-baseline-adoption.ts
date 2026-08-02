/**
 * Administrative adoption of a Production checkpoint as the first managed baseline
 * for legacy invitations.
 *
 * Two phases:
 *  1. Read-only preparation: manifest generation and dry-run inspect the Production
 *     candidate, stable asset identities, and delivery drift — never writing any row.
 *  2. Guarded apply (requires the exact manifest fingerprint): records release
 *     provenance and a mutation receipt in Production so the adopted baseline is
 *     verifiable. Apply never alters invitation content itself.
 */
import { createHash, randomUUID } from 'node:crypto';

import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	buildSemanticInvitationSnapshot,
	compareSemanticInvitationSnapshots,
	type ContentParityDrift,
	type ContentParityEnvironment,
	type SemanticInvitationSnapshot,
} from './content-parity.ts';
import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { resolveDbUrlForEnv, type TargetEnv } from './dbs-status.ts';
import { validatePackageData } from './invitation-import-engine.ts';
import { exportInvitationPackage, type InvitationPackageData } from './invitation-package.ts';
import { getInvitationDefinition } from './invitations/registry.ts';
import {
	canonicalize,
	RELEASE_SCHEMA_VERSION,
	semanticAssetRef,
} from './normalized-invitation-release.ts';

export const LEGACY_BASELINE_ADOPTION_MANIFEST_VERSION = '1.0.0';
export const LEGACY_BASELINE_ADOPTION_PROVENANCE = 'production_administrative_adoption';
export const LEGACY_BASELINE_ADOPTION_SLUGS = [
	'abril-michelle-becerra-rea',
	'romina-rios-chaparro',
] as const;

export type LegacyAdoptionEnvironment = ContentParityEnvironment;
export type LegacyAdoptionBlocker =
	| 'ENVIRONMENT_UNAVAILABLE'
	| 'INVALID_PRODUCTION_CANDIDATE'
	| 'INCOMPLETE_MANAGED_SCOPE'
	| 'ASSET_IDENTITY_AMBIGUOUS'
	| 'NORMALIZATION_VERSION_UNSUPPORTED'
	| 'STALE_MANIFEST'
	| 'APPLY_DISABLED';

export interface LegacyAdoptionRawAsset {
	id: string;
	displayName: string;
	mimeType: string;
	width: number | null;
	height: number | null;
	fileSize: number | null;
	sha256: string | null;
}

export interface LegacyAdoptionRawEnvironmentCandidate {
	environment: LegacyAdoptionEnvironment;
	invitation: {
		slug: string;
		eventType: string;
		kind: string;
		baseDemoId: string | null;
		themeId: string | null;
		snapshot: unknown;
		createdBy: string | null;
	};
	draft: { content: unknown; status: string | null; updatedAt: string | null };
	published: {
		content: unknown;
		version: number | null;
		isDemo: boolean;
		slug: string;
		eventType: string;
	};
	event: { slug: string; eventType: string; ownerUserId: string | null } | null;
	assets: LegacyAdoptionRawAsset[];
}

export interface LegacyAssetIdentity {
	semanticKey: string;
}

export interface LegacyCandidateComparison {
	against: 'canonical' | LegacyAdoptionEnvironment;
	outcome: 'ALIGNED' | 'DRIFT' | 'UNAVAILABLE';
	driftCount: number;
	managedPaths: string[];
}

export interface LegacyAdoptionEntry {
	slug: string;
	entryFingerprint: string;
	productionCandidateFingerprint: string | null;
	normalizationVersion: string;
	contractVersion: string;
	provenance: typeof LEGACY_BASELINE_ADOPTION_PROVENANCE;
	managedScope: { sections: string[]; assetKeys: string[] };
	stableAssetIdentities: LegacyAssetIdentity[];
	comparisons: LegacyCandidateComparison[];
	detectedDrift: string[];
	exclusions: string[];
	unresolvedAmbiguity: LegacyAdoptionBlocker[];
	status: 'ELIGIBLE' | 'BLOCKED';
	expectedSnapshot: {
		operationalStatus: 'UNVERIFIED' | 'HEALTHY';
		deliveryStatus: 'UNVERIFIED' | 'ALIGNED' | 'IN_PROGRESS';
		issuesExpectedToDisappear: string[];
		issuesExpectedToRemain: string[];
		workItemsExpectedToRemain: string[];
	};
}

export interface LegacyBaselineAdoptionManifest {
	manifestVersion: typeof LEGACY_BASELINE_ADOPTION_MANIFEST_VERSION;
	generatedAt: string;
	normalizationVersion: string;
	contractVersion: string;
	provenance: typeof LEGACY_BASELINE_ADOPTION_PROVENANCE;
	manifestFingerprint: string;
	commands?: {
		dryRun: string;
		futureApply: string;
	};
	entries: LegacyAdoptionEntry[];
}

export interface LegacyAdoptionDryRunEntry {
	slug: string;
	status: 'ELIGIBLE' | 'BLOCKED';
	candidateFingerprintVerified: boolean;
	manifestFingerprintVerified: boolean;
	sourceChangedAfterGeneration: boolean;
	metadataChanges: string[];
	affectedEnvironments: LegacyAdoptionEnvironment[];
	expectedSnapshot: LegacyAdoptionEntry['expectedSnapshot'];
	remainingIssues: string[];
	remainingWorkItems: string[];
	blockingReason?: LegacyAdoptionBlocker;
	writes: 0;
}

function sha256(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rawAsset(value: unknown): LegacyAdoptionRawAsset | null {
	if (!isRecord(value)) return null;
	const id = stringOrNull(value.id);
	const displayName = stringOrNull(value.displayName);
	const mimeType = stringOrNull(value.mimeType);
	const sha = stringOrNull(value.sha256);
	if (!id || !displayName || !mimeType) return null;
	return {
		id,
		displayName,
		mimeType,
		width: numberOrNull(value.width),
		height: numberOrNull(value.height),
		fileSize: numberOrNull(value.fileSize),
		sha256: sha && /^[a-f0-9]{64}$/.test(sha) ? sha : null,
	};
}

function parseCandidate(
	environment: LegacyAdoptionEnvironment,
	value: unknown,
): LegacyAdoptionRawEnvironmentCandidate | null {
	if (
		!isRecord(value) ||
		!isRecord(value.invitation) ||
		!isRecord(value.draft) ||
		!isRecord(value.published)
	)
		return null;
	const invitation = value.invitation;
	const draft = value.draft;
	const published = value.published;
	const slug = stringOrNull(invitation.slug);
	const eventType = stringOrNull(invitation.eventType);
	const kind = stringOrNull(invitation.kind);
	const publishedSlug = stringOrNull(published.slug);
	const publishedEventType = stringOrNull(published.eventType);
	if (!slug || !eventType || !kind || !publishedSlug || !publishedEventType) return null;
	const event = isRecord(value.event)
		? {
				slug: stringOrNull(value.event.slug) ?? '',
				eventType: stringOrNull(value.event.eventType) ?? '',
				ownerUserId: stringOrNull(value.event.ownerUserId),
			}
		: null;
	return {
		environment,
		invitation: {
			slug,
			eventType,
			kind,
			baseDemoId: stringOrNull(invitation.baseDemoId),
			themeId: stringOrNull(invitation.themeId),
			snapshot: invitation.snapshot ?? null,
			createdBy: stringOrNull(invitation.createdBy),
		},
		draft: {
			content: draft.content ?? null,
			status: stringOrNull(draft.status),
			updatedAt: stringOrNull(draft.updatedAt),
		},
		published: {
			content: published.content ?? null,
			version: numberOrNull(published.version),
			isDemo: published.isDemo === true,
			slug: publishedSlug,
			eventType: publishedEventType,
		},
		event,
		assets: Array.isArray(value.assets)
			? value.assets.flatMap((asset) => {
					const parsed = rawAsset(asset);
					return parsed ? [parsed] : [];
				})
			: [],
	};
}

function assetSignature(asset: {
	displayName: string;
	mimeType: string;
	width: number | null;
	height: number | null;
	fileSize: number | null;
}): string {
	return canonicalize({
		displayName: asset.displayName,
		mimeType: asset.mimeType,
		width: asset.width,
		height: asset.height,
		fileSize: asset.fileSize,
	});
}

function mapSemanticAssets(
	pkg: InvitationPackageData,
	candidate: LegacyAdoptionRawEnvironmentCandidate,
): {
	identities: LegacyAssetIdentity[];
	keyById: Map<string, string>;
	blocker: LegacyAdoptionBlocker | null;
} {
	if (pkg.assets.length === 0) {
		return { identities: [], keyById: new Map(), blocker: 'INCOMPLETE_MANAGED_SCOPE' };
	}

	const keyById = new Map<string, string>();
	const identities: LegacyAssetIdentity[] = [];

	if (candidate.assets.length === pkg.assets.length) {
		const remaining = [...candidate.assets];
		for (const asset of [...pkg.assets].sort((left, right) =>
			left.key.localeCompare(right.key),
		)) {
			const matches = remaining.filter(
				(row) => assetSignature(row) === assetSignature(asset),
			);
			if (matches.length !== 1) {
				return { identities: [], keyById: new Map(), blocker: 'ASSET_IDENTITY_AMBIGUOUS' };
			}
			const match = matches[0]!;
			keyById.set(match.id, asset.key);
			identities.push({ semanticKey: asset.key });
			remaining.splice(remaining.indexOf(match), 1);
		}
		return remaining.length === 0
			? { identities, keyById, blocker: null }
			: { identities: [], keyById: new Map(), blocker: 'INCOMPLETE_MANAGED_SCOPE' };
	}

	const remaining = [...candidate.assets];
	for (const asset of [...pkg.assets].sort((left, right) => left.key.localeCompare(right.key))) {
		const matches = remaining.filter((row) => assetSignature(row) === assetSignature(asset));
		if (matches.length === 0) {
			return { identities: [], keyById: new Map(), blocker: 'INCOMPLETE_MANAGED_SCOPE' };
		}
		if (matches.length > 1) {
			return { identities: [], keyById: new Map(), blocker: 'ASSET_IDENTITY_AMBIGUOUS' };
		}
		const match = matches[0]!;
		keyById.set(match.id, asset.key);
		identities.push({ semanticKey: asset.key });
		remaining.splice(remaining.indexOf(match), 1);
	}

	return remaining.length === 0
		? { identities, keyById, blocker: null }
		: { identities: [], keyById: new Map(), blocker: 'ASSET_IDENTITY_AMBIGUOUS' };
}

function normalizeAssetReferences(value: unknown, keyById: ReadonlyMap<string, string>): unknown {
	if (Array.isArray(value)) return value.map((item) => normalizeAssetReferences(item, keyById));
	if (!isRecord(value)) return value;
	if (value.type === 'uploaded' && typeof value.assetId === 'string') {
		const key = keyById.get(value.assetId);
		if (key) return semanticAssetRef(key);
	}
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, normalizeAssetReferences(item, keyById)]),
	);
}

function snapshotForCandidate(
	candidate: LegacyAdoptionRawEnvironmentCandidate,
	keyById: ReadonlyMap<string, string>,
): SemanticInvitationSnapshot {
	return buildSemanticInvitationSnapshot({
		invitation: {
			slug: candidate.invitation.slug,
			event_type: candidate.invitation.eventType,
			kind: candidate.invitation.kind,
			base_demo_id: candidate.invitation.baseDemoId,
			theme_id: candidate.invitation.themeId,
			snapshot: candidate.invitation.snapshot,
		},
		draftContent: normalizeAssetReferences(candidate.draft.content, keyById),
		published: {
			content: normalizeAssetReferences(candidate.published.content, keyById),
			is_demo: candidate.published.isDemo,
			slug: candidate.published.slug,
			event_type: candidate.published.eventType,
		},
		assets: candidate.assets.flatMap((asset) => {
			const semanticKey = keyById.get(asset.id);
			return semanticKey ? [{ managed_source_key: semanticKey, sha256: semanticKey }] : [];
		}),
		event: candidate.event
			? { slug: candidate.event.slug, event_type: candidate.event.eventType }
			: null,
	});
}

function snapshotForPackage(pkg: InvitationPackageData): SemanticInvitationSnapshot {
	return buildSemanticInvitationSnapshot({
		invitation: {
			slug: pkg.invitation.slug,
			event_type: pkg.invitation.eventType,
			kind: pkg.invitation.kind,
			base_demo_id: pkg.invitation.baseDemoId,
			theme_id: pkg.invitation.themeId,
			snapshot: pkg.invitation.snapshot,
		},
		draftContent: pkg.draft.content,
		published: {
			content: pkg.publishedContent.content,
			is_demo: false,
			slug: pkg.invitation.slug,
			event_type: pkg.invitation.eventType,
		},
		assets: pkg.assets.map((asset) => ({ managed_source_key: asset.key, sha256: asset.key })),
		event: { slug: pkg.invitation.slug, event_type: pkg.invitation.eventType },
	});
}

function managedPaths(drifts: readonly ContentParityDrift[]): string[] {
	return [...new Set(drifts.map((drift) => `${drift.entity}.${drift.field}`))].sort();
}

function comparison(
	leftEnv: LegacyAdoptionEnvironment,
	left: SemanticInvitationSnapshot,
	against: 'canonical' | LegacyAdoptionEnvironment,
	rightEnv: LegacyAdoptionEnvironment,
	right: SemanticInvitationSnapshot,
): LegacyCandidateComparison {
	const drifts = compareSemanticInvitationSnapshots(leftEnv, left, rightEnv, right);
	return {
		against,
		outcome: drifts.length === 0 ? 'ALIGNED' : 'DRIFT',
		driftCount: drifts.length,
		managedPaths: managedPaths(drifts),
	};
}

function candidateIsValid(candidate: LegacyAdoptionRawEnvironmentCandidate, slug: string): boolean {
	return Boolean(
		candidate.invitation.slug === slug &&
		candidate.invitation.kind === 'client' &&
		candidate.invitation.createdBy &&
		candidate.event &&
		candidate.event.ownerUserId === candidate.invitation.createdBy &&
		candidate.published.content &&
		candidate.published.version &&
		eventContentSchema.safeParse(candidate.published.content).success,
	);
}

function expectedSnapshot(input: {
	eligible: boolean;
	canonicalDrift: boolean;
}): LegacyAdoptionEntry['expectedSnapshot'] {
	if (!input.eligible) {
		return {
			operationalStatus: 'UNVERIFIED',
			deliveryStatus: 'UNVERIFIED',
			issuesExpectedToDisappear: [],
			issuesExpectedToRemain: ['BASELINE_UNAVAILABLE', 'ASSET_IDENTITY_UNVERIFIED'],
			workItemsExpectedToRemain: [],
		};
	}
	return {
		operationalStatus: 'HEALTHY',
		deliveryStatus: input.canonicalDrift ? 'IN_PROGRESS' : 'ALIGNED',
		issuesExpectedToDisappear: ['BASELINE_UNAVAILABLE', 'ASSET_IDENTITY_UNVERIFIED'],
		issuesExpectedToRemain: [],
		workItemsExpectedToRemain: input.canonicalDrift ? ['CANONICAL_CHANGE_PENDING'] : [],
	};
}

function entryFingerprint(entry: Omit<LegacyAdoptionEntry, 'entryFingerprint'>): string {
	return sha256(entry);
}

function manifestPayload(
	manifest: Omit<LegacyBaselineAdoptionManifest, 'manifestFingerprint'>,
): unknown {
	return {
		manifestVersion: manifest.manifestVersion,
		normalizationVersion: manifest.normalizationVersion,
		contractVersion: manifest.contractVersion,
		provenance: manifest.provenance,
		entries: [...manifest.entries].sort((left, right) => left.slug.localeCompare(right.slug)),
	};
}

export function computeLegacyBaselineManifestFingerprint(
	manifest:
		| Omit<LegacyBaselineAdoptionManifest, 'manifestFingerprint'>
		| LegacyBaselineAdoptionManifest,
): string {
	const { manifestFingerprint: _fingerprint, ...payload } =
		manifest as LegacyBaselineAdoptionManifest;
	return sha256(manifestPayload(payload));
}

export function buildLegacyBaselineAdoptionEntry(input: {
	pkg: InvitationPackageData;
	candidates: Partial<Record<LegacyAdoptionEnvironment, LegacyAdoptionRawEnvironmentCandidate>>;
}): LegacyAdoptionEntry {
	const pkg = input.pkg;
	const definition = getInvitationDefinition(pkg.invitation.slug);
	const production = input.candidates.production;
	const canonical = snapshotForPackage(pkg);
	const scope = {
		sections: [
			'invitation',
			'invitation_content_drafts',
			'published_invitation_content',
			'invitation_assets',
			'events',
		],
		assetKeys: [...pkg.assets.map((asset) => asset.key)].sort(),
	};
	const base: Omit<LegacyAdoptionEntry, 'entryFingerprint'> = {
		slug: pkg.invitation.slug,
		productionCandidateFingerprint: null,
		normalizationVersion: pkg.schemaVersion,
		contractVersion: `${definition.lifecycle}:${definition.deliveryScope}`,
		provenance: LEGACY_BASELINE_ADOPTION_PROVENANCE,
		managedScope: scope,
		stableAssetIdentities: [] as LegacyAssetIdentity[],
		comparisons: [] as LegacyCandidateComparison[],
		detectedDrift: [] as string[],
		exclusions: [
			'guests',
			'rsvps',
			'audits',
			'receipts',
			'promotion_state',
			'transport_asset_identifiers',
		],
		unresolvedAmbiguity: [] as LegacyAdoptionBlocker[],
		status: 'BLOCKED',
		expectedSnapshot: expectedSnapshot({ eligible: false, canonicalDrift: false }),
	};
	if (pkg.schemaVersion !== RELEASE_SCHEMA_VERSION) {
		base.unresolvedAmbiguity.push('NORMALIZATION_VERSION_UNSUPPORTED');
		return { ...base, entryFingerprint: entryFingerprint(base) };
	}
	validatePackageData(pkg);
	if (!production) {
		base.unresolvedAmbiguity.push('ENVIRONMENT_UNAVAILABLE');
		return { ...base, entryFingerprint: entryFingerprint(base) };
	}
	if (!candidateIsValid(production, pkg.invitation.slug)) {
		base.unresolvedAmbiguity.push('INVALID_PRODUCTION_CANDIDATE');
		return { ...base, entryFingerprint: entryFingerprint(base) };
	}
	const mappedProduction = mapSemanticAssets(pkg, production);
	if (mappedProduction.blocker) {
		base.unresolvedAmbiguity.push(mappedProduction.blocker);
		return { ...base, entryFingerprint: entryFingerprint(base) };
	}
	const snapshots: Partial<Record<LegacyAdoptionEnvironment, SemanticInvitationSnapshot>> = {};
	for (const environment of ['local', 'preview', 'production'] as const) {
		const candidate = input.candidates[environment];
		if (!candidate) {
			base.unresolvedAmbiguity.push('ENVIRONMENT_UNAVAILABLE');
			continue;
		}
		const mappings = mapSemanticAssets(pkg, candidate);
		if (mappings.blocker) {
			base.unresolvedAmbiguity.push(mappings.blocker);
			continue;
		}
		snapshots[environment] = snapshotForCandidate(candidate, mappings.keyById);
	}
	if (base.unresolvedAmbiguity.length > 0) {
		base.unresolvedAmbiguity = [...new Set(base.unresolvedAmbiguity)].sort();
		return { ...base, entryFingerprint: entryFingerprint(base) };
	}
	const productionSnapshot = snapshots.production!;
	const comparisons = [
		comparison('production', productionSnapshot, 'canonical', 'local', canonical),
		comparison('production', productionSnapshot, 'local', 'local', snapshots.local!),
		comparison('production', productionSnapshot, 'preview', 'preview', snapshots.preview!),
	];
	base.comparisons = comparisons;
	base.stableAssetIdentities = mappedProduction.identities;
	base.productionCandidateFingerprint = sha256(productionSnapshot);
	base.detectedDrift = [...new Set(comparisons.flatMap((item) => item.managedPaths))].sort();
	const canonicalDrift = comparisons[0]!.outcome === 'DRIFT';
	const eligible: Omit<LegacyAdoptionEntry, 'entryFingerprint'> = {
		...base,
		status: 'ELIGIBLE',
		expectedSnapshot: expectedSnapshot({ eligible: true, canonicalDrift }),
	};
	return { ...eligible, entryFingerprint: entryFingerprint(eligible) };
}

export function createLegacyBaselineAdoptionManifest(input: {
	packages: InvitationPackageData[];
	candidates: Partial<Record<LegacyAdoptionEnvironment, LegacyAdoptionRawEnvironmentCandidate>>[];
	generatedAt?: string;
}): LegacyBaselineAdoptionManifest {
	const entries = input.packages
		.map((pkg, index) =>
			buildLegacyBaselineAdoptionEntry({ pkg, candidates: input.candidates[index] ?? {} }),
		)
		.sort((left, right) => left.slug.localeCompare(right.slug));
	const unsigned: Omit<LegacyBaselineAdoptionManifest, 'manifestFingerprint'> = {
		manifestVersion: LEGACY_BASELINE_ADOPTION_MANIFEST_VERSION,
		generatedAt: input.generatedAt ?? new Date().toISOString(),
		normalizationVersion: RELEASE_SCHEMA_VERSION,
		contractVersion: 'managed-baseline-adoption-v1',
		provenance: LEGACY_BASELINE_ADOPTION_PROVENANCE,
		entries,
	};
	return { ...unsigned, manifestFingerprint: computeLegacyBaselineManifestFingerprint(unsigned) };
}

export function verifyLegacyBaselineManifest(manifest: LegacyBaselineAdoptionManifest): boolean {
	return (
		manifest.manifestVersion === LEGACY_BASELINE_ADOPTION_MANIFEST_VERSION &&
		manifest.normalizationVersion === RELEASE_SCHEMA_VERSION &&
		manifest.manifestFingerprint === computeLegacyBaselineManifestFingerprint(manifest) &&
		manifest.entries.every((entry) => {
			const { entryFingerprint: fingerprint, ...unsigned } = entry;
			return fingerprint === entryFingerprint(unsigned);
		})
	);
}

export function dryRunLegacyBaselineAdoption(input: {
	manifest: LegacyBaselineAdoptionManifest;
	refreshed: LegacyBaselineAdoptionManifest;
}): LegacyAdoptionDryRunEntry[] {
	const manifestValid = verifyLegacyBaselineManifest(input.manifest);
	const refreshedBySlug = new Map(input.refreshed.entries.map((entry) => [entry.slug, entry]));
	return input.manifest.entries.map((entry) => {
		const current = refreshedBySlug.get(entry.slug);
		const sourceChanged = !current || current.entryFingerprint !== entry.entryFingerprint;
		const blockingReason = sourceChanged ? 'STALE_MANIFEST' : entry.unresolvedAmbiguity[0];
		const status = !blockingReason && entry.status === 'ELIGIBLE' ? 'ELIGIBLE' : 'BLOCKED';
		return {
			slug: entry.slug,
			status,
			candidateFingerprintVerified: Boolean(
				current &&
				current.productionCandidateFingerprint === entry.productionCandidateFingerprint,
			),
			manifestFingerprintVerified: manifestValid,
			sourceChangedAfterGeneration: sourceChanged,
			metadataChanges:
				status === 'ELIGIBLE'
					? [
							'shared_managed_baseline',
							'semantic_asset_identity',
							'adoption_provenance_receipt',
						]
					: [],
			affectedEnvironments: ['local', 'preview', 'production'],
			expectedSnapshot: entry.expectedSnapshot,
			remainingIssues: entry.expectedSnapshot.issuesExpectedToRemain,
			remainingWorkItems: entry.expectedSnapshot.workItemsExpectedToRemain,
			blockingReason,
			writes: 0,
		};
	});
}

export async function applyLegacyBaselineAdoption(input: {
	manifest: LegacyBaselineAdoptionManifest;
	providedFingerprint?: string;
}): Promise<{ writes: number; appliedEntries: Array<{ slug: string; status: 'APPLIED' }> }> {
	if (!verifyLegacyBaselineManifest(input.manifest)) {
		throw new Error(
			'STALE_MANIFEST: The manifest fingerprint is invalid. Regenerate before any future approval.',
		);
	}
	if (
		!input.providedFingerprint ||
		input.providedFingerprint !== input.manifest.manifestFingerprint
	) {
		throw new Error(
			'EXACT_MANIFEST_FINGERPRINT_REQUIRED: Future apply requires the exact manifest fingerprint.',
		);
	}

	const { dbUrl } = resolveDbUrlForEnv('production');
	if (!dbUrl) {
		throw new Error(
			'PRODUCTION_DB_UNAVAILABLE: PROD_DB_URL is not configured for adoption apply.',
		);
	}

	const eligibleEntries = input.manifest.entries.filter((entry) => entry.status === 'ELIGIBLE');
	let totalWrites = 0;
	const appliedEntries: Array<{ slug: string; status: 'APPLIED' }> = [];

	for (const entry of eligibleEntries) {
		const candidate = readLegacyAdoptionCandidate({
			environment: 'production',
			slug: entry.slug,
		});
		if (!candidate || !candidate.published.content) {
			throw new Error(
				`STALE_MANIFEST: Production candidate for ${entry.slug} is missing or invalid.`,
			);
		}

		const idRes = runPsql(
			`select id::text from public.invitations where slug = ${sqlLiteral(entry.slug)} and archived_at is null limit 1;`,
			dbUrl,
			{ tuplesOnly: true },
		);
		const invitationId = idRes.stdout.trim();
		if (!invitationId) {
			throw new Error(
				`TARGET_INVITATION_NOT_FOUND: Production invitation for ${entry.slug} not found.`,
			);
		}

		const operationId = randomUUID();
		const pkgData = (
			await exportInvitationPackage({
				slug: entry.slug,
				sourceDir: `src/assets/invitations/${entry.slug}`,
				dryRun: true,
			})
		).packageData;

		const provenanceProjectionHash = createHash('sha256')
			.update(pkgData.projectionHash)
			.digest('hex');

		const appliedPublishedProjectionHash = hashPublicationProjection(
			candidate.published.content as Record<string, unknown>,
		);

		const publishedUpdatedAt = (candidate.published.content as { updatedAt?: string })
			.updatedAt;
		const draftUpdatedAt = candidate.draft.updatedAt ?? publishedUpdatedAt;
		const draftUpdatedAtSql = draftUpdatedAt
			? `${sqlLiteral(draftUpdatedAt)}::timestamptz`
			: 'now()';

		const sql = `BEGIN; INSERT INTO public.managed_invitation_release_provenance (invitation_id, definition_slug, release_schema_version, source_hash, package_hash, metadata_hash, projection_hash, asset_manifest_hash, managed_projection, applied_draft_updated_at, applied_operation_id, applied_published_version, applied_published_projection_hash, applied_at) VALUES (${sqlLiteral(invitationId)}::uuid, ${sqlLiteral(pkgData.sourceSlug)}, ${sqlLiteral(pkgData.schemaVersion)}, ${sqlLiteral(pkgData.sourceHash)}, ${sqlLiteral(pkgData.packageHash)}, ${sqlLiteral(pkgData.metadataHash)}, ${sqlLiteral(provenanceProjectionHash)}, ${sqlLiteral(pkgData.assetManifestHash)}, ${sqlLiteral(JSON.stringify(candidate.published.content))}::jsonb, ${draftUpdatedAtSql}, '${operationId}'::uuid, ${candidate.published.version}, ${sqlLiteral(appliedPublishedProjectionHash)}, now()) ON CONFLICT (invitation_id) DO UPDATE SET definition_slug = EXCLUDED.definition_slug, release_schema_version = EXCLUDED.release_schema_version, source_hash = EXCLUDED.source_hash, package_hash = EXCLUDED.package_hash, metadata_hash = EXCLUDED.metadata_hash, projection_hash = EXCLUDED.projection_hash, asset_manifest_hash = EXCLUDED.asset_manifest_hash, managed_projection = EXCLUDED.managed_projection, applied_draft_updated_at = EXCLUDED.applied_draft_updated_at, applied_operation_id = EXCLUDED.applied_operation_id, applied_published_version = EXCLUDED.applied_published_version, applied_published_projection_hash = EXCLUDED.applied_published_projection_hash, applied_at = EXCLUDED.applied_at; INSERT INTO public.invitation_mutation_operation_receipts (operation_id, invitation_id, environment, project_ref, actor_type, origin, command_kind, input_hashes, expected_state, status, completed_steps, result) VALUES ('${operationId}'::uuid, ${sqlLiteral(invitationId)}::uuid, 'production', 'production', 'operator', 'managed_cli_hosted', 'managed_baseline_adoption', ${sqlLiteral(JSON.stringify({ manifestFingerprint: input.manifest.manifestFingerprint, sourceHash: pkgData.sourceHash, packageHash: pkgData.packageHash }))}::jsonb, ${sqlLiteral(JSON.stringify({ draftUpdatedAt: candidate.draft.updatedAt, publishedVersion: candidate.published.version }))}::jsonb, 'applied', ARRAY['target_verified', 'provenance_recorded'], '{}'::jsonb); COMMIT;`;

		const res = runPsql(sql, dbUrl, { throwOnError: true });
		if (res.status !== 0) {
			throw new Error(
				`ADOPTION_APPLY_FAILED: Failed to apply baseline adoption for ${entry.slug}: ${res.stderr}`,
			);
		}

		totalWrites += 2;
		appliedEntries.push({ slug: entry.slug, status: 'APPLIED' });
	}

	return { writes: totalWrites, appliedEntries };
}

function parsePsqlJson(stdout: string): unknown {
	const text = stdout.trim();
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start < 0 || end < start) return null;
	return JSON.parse(text.slice(start, end + 1)) as unknown;
}

export function readLegacyAdoptionCandidate(input: {
	environment: LegacyAdoptionEnvironment;
	slug: string;
}): LegacyAdoptionRawEnvironmentCandidate | null {
	const { dbUrl } = resolveDbUrlForEnv(input.environment as TargetEnv);
	if (!dbUrl) return null;
	const sql = `SELECT jsonb_build_object('invitation', (SELECT jsonb_build_object('slug', i.slug, 'eventType', i.event_type, 'kind', i.kind, 'baseDemoId', i.base_demo_id, 'themeId', i.theme_id, 'snapshot', i.snapshot, 'createdBy', i.created_by) FROM public.invitations i WHERE i.slug = ${sqlLiteral(input.slug)} AND i.archived_at IS NULL ORDER BY i.id LIMIT 1), 'draft', (SELECT jsonb_build_object('content', d.content, 'status', d.status, 'updatedAt', d.updated_at) FROM public.invitation_content_drafts d JOIN public.invitations i ON i.id = d.invitation_project_id WHERE i.slug = ${sqlLiteral(input.slug)} AND i.archived_at IS NULL AND d.deleted_at IS NULL ORDER BY d.updated_at DESC LIMIT 1), 'published', (SELECT jsonb_build_object('content', p.content, 'version', p.version, 'isDemo', p.is_demo, 'slug', p.slug, 'eventType', p.event_type) FROM public.published_invitation_content p JOIN public.invitations i ON i.id = p.invitation_project_id WHERE i.slug = ${sqlLiteral(input.slug)} AND i.archived_at IS NULL AND p.deleted_at IS NULL ORDER BY p.version DESC, p.created_at DESC LIMIT 1), 'event', (SELECT jsonb_build_object('slug', e.slug, 'eventType', e.event_type, 'ownerUserId', e.owner_user_id) FROM public.events e JOIN public.invitations i ON i.id = e.invitation_project_id WHERE i.slug = ${sqlLiteral(input.slug)} AND i.archived_at IS NULL AND e.deleted_at IS NULL ORDER BY e.id LIMIT 1), 'assets', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'displayName', a.display_name, 'mimeType', a.mime_type, 'width', a.width, 'height', a.height, 'fileSize', a.file_size, 'sha256', a.sha256) ORDER BY a.id) FROM public.invitation_assets a JOIN public.invitations i ON i.id = a.invitation_id WHERE i.slug = ${sqlLiteral(input.slug)} AND i.archived_at IS NULL AND a.deleted_at IS NULL), '[]'::jsonb))::text;`;
	const result = runPsql(sql, dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
		timeoutMs: 30_000,
		env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
	});
	if (result.status !== 0) return null;
	return parseCandidate(input.environment, parsePsqlJson(result.stdout));
}
