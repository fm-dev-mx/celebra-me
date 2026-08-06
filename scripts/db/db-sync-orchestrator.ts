/**
 * db-sync-orchestrator.ts — Thin orchestration for invitation DB synchronization.
 * Delegates mutations to existing engines; never reimplements mirror/update/promote.
 */

import { createHash } from 'node:crypto';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { CONTENT_MIRROR_TABLES, EXCLUDED_TABLES, redactDbUrl } from './db-target-config.ts';
import { getProdDbUrl } from './db-workflow-lib.ts';
import { verifyRequiredDatabaseAvailability } from './verify-required-database-availability.ts';
import { runPreviewMirror } from './preview-sync-invitations.ts';
import {
	assertExactPlan,
	assertPlanFresh,
	buildDbSyncPlan,
	computeMirrorDataFingerprint,
	gatesForDirection,
} from './db-sync-plan.ts';
import {
	DB_SYNC_DIRECTION_LABELS,
	emptyResult,
	type DbSyncDirection,
	type DbSyncDrift,
	type DbSyncMode,
	type DbSyncPlan,
	type DbSyncResult,
	type DbSyncTargetEvidence,
} from './db-sync-types.ts';
import {
	evaluateGeneralStatus,
	resetStatusProbeSession,
	type TargetEnv,
} from '../provision/dbs-status.ts';
import {
	compareAcrossEnvironments,
	listSemanticDifferencePaths,
	type ContentParityEnvironment,
} from '../provision/content-parity.ts';
import { loadSemanticSnapshotsForParity, resolveDbUrl } from '../provision/content-parity-load.ts';
import { resolveInvitationPackageInput } from '../provision/invitation-package-input.ts';
import { applyLocalInvitation } from '../provision/apply-local-invitation.ts';
import { runImportEngine } from '../provision/invitation-import-engine.ts';
import { runPreviewApply } from '../provision/preview-apply.ts';
import { runPromotionPreflight, runPromotionApply } from '../provision/invitation-promote.ts';
import { requireOwnerProductionApply } from './owner-production-apply.ts';
import { authorizePreviewWriteApply } from '../provision/preview-write-auth.ts';
import { toPublicPromotionReport } from '../provision/invitation-promote-cli.ts';
import type { InvitationPackageData } from '../provision/invitation-package.ts';

export interface OrchestrateDbSyncInput {
	mode: DbSyncMode;
	direction?: DbSyncDirection | null;
	slug?: string | null;
	eventType?: string | null;
	packagePath?: string | null;
	expectedPlan?: string | null;
	backupManifest?: string | null;
	apply?: boolean;
	strict?: boolean;
	envs?: ContentParityEnvironment[];
	reviewedPlan?: DbSyncPlan | null;
	now?: Date;
	runMirror?: typeof runPreviewMirror;
	authorizePreview?: typeof authorizePreviewWriteApply;
	requireOwnerApply?: typeof requireOwnerProductionApply;
}

function redactedRef(env: ContentParityEnvironment): string {
	const url = resolveDbUrl(env);
	return url ? `${env}:${redactDbUrl(url)}` : `${env}:${SUPABASE_PROJECT_REFS[env]}:unavailable`;
}

function schemaEvidenceSummary(targets: DbSyncTargetEvidence[]): string {
	return targets
		.map(
			(t) =>
				`${t.environment}:${t.schemaLifecycle ?? (t.available ? 'UNKNOWN' : 'UNVERIFIED')}`,
		)
		.join(',');
}

async function diagnoseTargets(
	envs: ContentParityEnvironment[],
): Promise<{ targets: DbSyncTargetEvidence[]; blockers: string[]; ok: boolean }> {
	const availability = verifyRequiredDatabaseAvailability(envs as TargetEnv[]);
	const blockers: string[] = [];
	const targets: DbSyncTargetEvidence[] = [];

	resetStatusProbeSession();
	let general: Awaited<ReturnType<typeof evaluateGeneralStatus>> | null = null;
	try {
		general = await evaluateGeneralStatus({ environments: envs as TargetEnv[] });
	} catch (error: unknown) {
		blockers.push(
			`STATUS_UNVERIFIED: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	for (const env of envs) {
		const avail = availability.find((row) => row.environment === env);
		const envStatus = general?.environments?.[env as TargetEnv];
		const available = Boolean(avail?.available);
		const reason = avail?.reasonCode;
		if (!available) {
			blockers.push(`${env}: ${reason ?? 'UNAVAILABLE'}`);
		}
		targets.push({
			environment: env,
			available,
			reason,
			redactedIdentity: redactedRef(env),
			schemaLifecycle: envStatus?.schemaLifecycle,
			reachable: envStatus?.reachable,
		});
	}

	return { targets, blockers, ok: blockers.length === 0 };
}

async function resolvePackage(input: OrchestrateDbSyncInput): Promise<InvitationPackageData> {
	const slug = input.slug?.trim();
	if (!slug) {
		throw new Error('SLUG_REQUIRED: --slug is required for this direction');
	}
	if (!input.packagePath?.trim() && input.direction !== 'definition-to-local') {
		throw new Error('PACKAGE_REQUIRED: --package is required for this direction');
	}
	if (input.direction === 'definition-to-local' && !input.packagePath) {
		const resolved = await resolveInvitationPackageInput({ slug });
		return resolved.packageData;
	}
	const resolved = await resolveInvitationPackageInput({
		slug,
		packagePath: input.packagePath!,
	});
	return resolved.packageData;
}

export async function orchestrateDiagnose(input: OrchestrateDbSyncInput): Promise<DbSyncResult> {
	const envs = input.envs ?? ['local', 'preview', 'production'];
	const result = emptyResult('diagnose');
	result.evidenceClass = 'mixed';
	const { targets, blockers, ok } = await diagnoseTargets(envs);
	result.targets = targets;
	result.blockers = blockers;
	result.ok = ok;
	result.status = ok ? 'READY' : 'BLOCKED';
	result.failures = ok ? [] : [...blockers];
	result.artifacts = [
		{ kind: 'table-allowlist', detail: CONTENT_MIRROR_TABLES.join(',') },
		{ kind: 'table-exclusion', detail: EXCLUDED_TABLES.join(',') },
	];
	return result;
}

export async function orchestrateCompare(input: OrchestrateDbSyncInput): Promise<DbSyncResult> {
	const result = emptyResult('compare');
	result.evidenceClass = 'semantic_content_parity';
	const slug = input.slug?.trim();
	const eventType = input.eventType?.trim();
	if (!slug || !eventType) {
		result.status = 'BLOCKED';
		result.failures.push('COMPARE_REQUIRES_SLUG_AND_EVENT_TYPE');
		return result;
	}

	const envs = input.envs ?? ['local', 'preview', 'production'];
	const { targets, blockers } = await diagnoseTargets(envs);
	result.targets = targets;

	const snapshots = loadSemanticSnapshotsForParity({ slug, eventType, envs });
	const loaded = Object.keys(snapshots) as ContentParityEnvironment[];
	if (loaded.length < 2) {
		result.status = 'UNVERIFIED';
		result.ok = false;
		result.failures.push(
			`Need at least two loaded environments; loaded: ${loaded.join(', ') || '(none)'}`,
		);
		result.blockers = blockers;
		return result;
	}

	const compare = compareAcrossEnvironments(slug, eventType, snapshots);
	const drifts: DbSyncDrift[] = compare.drifts.map((drift) => {
		const paths =
			drift.entity === 'invitation_content_drafts' ||
			drift.entity === 'published_invitation_content'
				? listSemanticDifferencePaths(drift.left, drift.right)
				: [];
		return {
			kind: drift.detail.includes('IDENTITY') ? 'IDENTITY_CONFLICT' : 'SEMANTIC_DRIFT',
			entity: drift.entity,
			detail: drift.detail,
			environments: [...drift.environments],
			paths: paths.length > 0 ? paths : undefined,
		};
	});

	result.drifts = drifts;
	result.ok = compare.ok;
	result.status = compare.ok ? 'MATCH_CANONICAL' : 'DRIFT';
	result.blockers = blockers;
	if (blockers.length > 0) {
		result.status = compare.ok ? 'PARTIAL_EVIDENCE' : 'DRIFT';
		if (input.strict !== false) {
			result.ok = false;
		}
	}
	return result;
}

// eslint-disable-next-line complexity -- Direction-specific plan assembly stays one ordered boundary.
async function buildPlanForDirection(
	input: OrchestrateDbSyncInput,
	direction: DbSyncDirection,
): Promise<{ result: DbSyncResult; plan: DbSyncPlan | null }> {
	const result = emptyResult('plan');
	result.direction = direction;
	const now = input.now ?? new Date();

	if (direction === 'production-to-preview-mirror') {
		const { targets, blockers, ok } = await diagnoseTargets(['preview', 'production']);
		result.targets = targets;
		const dataFingerprint = computeMirrorDataFingerprint({
			sourceProjectRef: SUPABASE_PROJECT_REFS.production,
			targetProjectRef: SUPABASE_PROJECT_REFS.preview,
			semanticDigest: input.slug
				? createHash('sha256').update(`mirror:${input.slug}`).digest('hex').slice(0, 16)
				: null,
		});
		const plan = buildDbSyncPlan({
			direction,
			slug: input.slug ?? null,
			redactedSourceIdentity: redactedRef('production'),
			redactedTargetIdentity: redactedRef('preview'),
			dataFingerprint,
			assetFingerprint: 'invitation-assets:supabase-public',
			schemaEvidence: schemaEvidenceSummary(targets),
			now,
		});
		result.plan = plan;
		result.planId = plan.planId;
		result.ok = ok;
		result.status = ok ? 'PLAN_READY' : 'PLAN_BLOCKED';
		result.blockers = blockers;
		result.failures = ok ? [] : [...blockers];
		result.artifacts = [
			{
				kind: 'destructive-warning',
				detail: 'Mirror apply TRUNCATE events CASCADE resets Preview RSVP children (guests/claims/memberships).',
			},
		];
		return { result, plan };
	}

	let packageData: InvitationPackageData;
	try {
		packageData = await resolvePackage({ ...input, direction });
	} catch (error: unknown) {
		result.status = 'BLOCKED';
		result.ok = false;
		result.failures.push(error instanceof Error ? error.message : String(error));
		return { result, plan: null };
	}

	const slug = packageData.invitation.slug;
	const targetEnv: ContentParityEnvironment =
		direction === 'definition-to-local'
			? 'local'
			: direction === 'definition-to-preview'
				? 'preview'
				: 'production';
	const diagnoseEnvs: ContentParityEnvironment[] =
		direction === 'package-to-production' ? ['preview', 'production'] : [targetEnv];
	const { targets, blockers, ok } = await diagnoseTargets(diagnoseEnvs);
	result.targets = targets;

	let enginePlanId: string | undefined;

	if (direction === 'definition-to-local') {
		const dry = await applyLocalInvitation({
			slug,
			apply: false,
		});
		enginePlanId = dry.plan.planId;
	} else if (direction === 'definition-to-preview') {
		const previewUrl = resolveDbUrl('preview');
		if (!previewUrl) {
			result.ok = false;
			result.status = 'PLAN_BLOCKED';
			result.failures.push('PREVIEW_CREDENTIALS_REQUIRED');
			result.blockers = blockers;
			return { result, plan: null };
		}
		const dry = await runImportEngine({
			packageData,
			target: 'preview',
			targetDbUrl: previewUrl,
			dryRun: true,
		});
		enginePlanId = dry.plan?.planId;
	} else if (direction === 'package-to-production') {
		const preflight = await runPromotionPreflight({
			packageData,
			backupManifestPath: input.backupManifest ?? undefined,
			requireBackup: true,
			getProductionDbUrl: getProdDbUrl,
		});
		enginePlanId = preflight.engineResult?.plan.planId;
		if (preflight.status === 'BLOCKED') {
			result.failures.push(preflight.reason ?? preflight.blockCode ?? 'PROMOTE_BLOCKED');
		}
	}

	const plan = buildDbSyncPlan({
		direction,
		slug,
		packageHash: packageData.packageHash,
		sourceHash: packageData.sourceHash,
		redactedSourceIdentity: `package:${packageData.packageHash.slice(0, 12)}`,
		redactedTargetIdentity: redactedRef(targetEnv),
		dataFingerprint: packageData.projectionHash,
		assetFingerprint: packageData.assetManifestHash,
		schemaEvidence: schemaEvidenceSummary(targets),
		enginePlanId,
		now,
	});
	result.plan = plan;
	result.planId = plan.planId;
	result.blockers = blockers;
	result.ok = ok && result.failures.length === 0;
	result.status = result.ok ? 'PLAN_READY' : 'PLAN_BLOCKED';
	if (!ok) result.failures.push(...blockers);
	return { result, plan };
}

export async function orchestratePlan(input: OrchestrateDbSyncInput): Promise<DbSyncResult> {
	if (!input.direction) {
		const result = emptyResult('plan');
		result.failures.push('DIRECTION_REQUIRED');
		result.status = 'BLOCKED';
		return result;
	}
	const { result } = await buildPlanForDirection(input, input.direction);
	return result;
}

// eslint-disable-next-line complexity -- Apply dispatch is intentionally one ordered gate + delegate sequence.
export async function orchestrateApply(input: OrchestrateDbSyncInput): Promise<DbSyncResult> {
	if (!input.apply) {
		const result = emptyResult('apply');
		result.failures.push('APPLY_FLAG_REQUIRED: mutation requires explicit --apply');
		result.status = 'BLOCKED';
		return result;
	}
	if (!input.direction) {
		const result = emptyResult('apply');
		result.failures.push('DIRECTION_REQUIRED');
		result.status = 'BLOCKED';
		return result;
	}

	const direction = input.direction;
	const { result: planResult, plan: rebuilt } = await buildPlanForDirection(input, direction);
	if (!rebuilt?.planId) {
		planResult.mode = 'apply';
		planResult.status = 'BLOCKED';
		planResult.ok = false;
		return planResult;
	}

	try {
		// Reviewed plan TTL binds interactive hold-time; rebuild must still match identity.
		if (input.reviewedPlan) {
			assertPlanFresh(input.reviewedPlan, input.now);
		}
		assertPlanFresh(rebuilt, input.now);
		const expected = input.expectedPlan ?? input.reviewedPlan?.planId;
		assertExactPlan(rebuilt, expected);
		if (input.reviewedPlan && input.reviewedPlan.planId !== rebuilt.planId) {
			throw new Error('PLAN_DRIFT: reviewed plan no longer matches rebuilt evidence');
		}
	} catch (error: unknown) {
		planResult.mode = 'apply';
		planResult.ok = false;
		planResult.status = 'PLAN_INVALID';
		planResult.failures.push(error instanceof Error ? error.message : String(error));
		return planResult;
	}

	const gates = gatesForDirection(direction);
	const applyResult: DbSyncResult = {
		...planResult,
		mode: 'apply',
		plan: { ...rebuilt, mode: 'apply' },
		planId: rebuilt.planId,
	};

	try {
		if (direction === 'production-to-preview-mirror') {
			if (gates.rsvpResetDisclosureRequired) {
				applyResult.artifacts = [
					...(applyResult.artifacts ?? []),
					{
						kind: 'destructive-warning',
						detail: 'TRUNCATE events CASCADE will reset Preview RSVP children. Re-provision synthetic fixtures after apply.',
					},
				];
			}
			const authorize = input.authorizePreview ?? authorizePreviewWriteApply;
			await authorize({
				slug: 'content-mirror',
				operation: 'sync-invitations',
				confirmPrompt:
					'Confirm Mirror Production content into Preview? Type YES to proceed: ',
			});
			const mirror = await (input.runMirror ?? runPreviewMirror)({
				dryRun: false,
				apply: true,
				skipAuthorization: true,
			});
			applyResult.ok = mirror.status === 'applied' && mirror.failures.length === 0;
			applyResult.status = mirror.status;
			applyResult.failures = [...mirror.failures];
			for (const path of mirror.missingAssets) {
				const tagged = `MISSING_ASSET: ${path}`;
				if (!applyResult.failures.includes(tagged)) {
					applyResult.failures.push(tagged);
				}
			}
			if (mirror.missingAssets.length > 0 || applyResult.failures.length > 0) {
				applyResult.ok = false;
				if (applyResult.status === 'applied') applyResult.status = 'failed';
			}
			applyResult.artifacts = [
				...(applyResult.artifacts ?? []),
				{ kind: 'mirror-report', detail: `status=${mirror.status}` },
			];
			return applyResult;
		}

		const packageData = await resolvePackage({ ...input, direction });

		if (direction === 'definition-to-local') {
			const dry = await applyLocalInvitation({
				slug: packageData.invitation.slug,
				apply: false,
			});
			const local = await applyLocalInvitation({
				slug: packageData.invitation.slug,
				apply: true,
				plan: dry.plan,
			});
			applyResult.ok = Boolean(local.receipt) || local.isZeroDrift;
			applyResult.status = local.isZeroDrift ? 'IN_SYNC' : 'APPLIED';
			return applyResult;
		}

		if (direction === 'definition-to-preview') {
			const authorize = input.authorizePreview ?? authorizePreviewWriteApply;
			await authorize({
				slug: packageData.invitation.slug,
				operation: 'apply',
				confirmPrompt: 'Confirm Update invitation in Preview? Type YES to proceed: ',
			});
			const previewUrl = resolveDbUrl('preview');
			if (!previewUrl) throw new Error('PREVIEW_CREDENTIALS_REQUIRED');
			const dry = await runImportEngine({
				packageData,
				target: 'preview',
				targetDbUrl: previewUrl,
				dryRun: true,
			});
			if (!dry.plan) throw new Error('PREVIEW_PLAN_MISSING');
			const applied = await runPreviewApply({
				packageData,
				targetDbUrl: previewUrl,
				plan: dry.plan,
			});
			applyResult.ok =
				applied.receipt?.status === 'EXECUTED' ||
				applied.receipt?.status === 'IN_SYNC' ||
				applied.isZeroDrift;
			applyResult.status =
				applied.receipt?.status ?? (applied.isZeroDrift ? 'IN_SYNC' : 'APPLIED');
			applyResult.artifacts = [
				...(applyResult.artifacts ?? []),
				{ kind: 'preview-approval-pending', detail: 'created-or-reused-by-preview-apply' },
			];
			return applyResult;
		}

		if (direction === 'package-to-production') {
			const preflight = await runPromotionPreflight({
				packageData,
				backupManifestPath: input.backupManifest ?? undefined,
				requireBackup: true,
				getProductionDbUrl: getProdDbUrl,
			});
			if (preflight.status === 'BLOCKED' || preflight.status === 'IN_SYNC') {
				applyResult.ok = preflight.status === 'IN_SYNC';
				applyResult.status = preflight.status;
				if (preflight.status === 'BLOCKED') {
					applyResult.failures.push(preflight.reason ?? 'BLOCKED');
				}
				return applyResult;
			}
			if (!preflight.targetDbUrl) {
				throw new Error('PRODUCTION_TARGET_UNAVAILABLE');
			}
			await (input.requireOwnerApply ?? requireOwnerProductionApply)({
				apply: true,
				dbUrl: preflight.targetDbUrl,
				operationType: 'invitation-promote',
				operationVerb: 'PROMOTE',
				bindingHex: packageData.packageHash,
				applyActionLabel: 'Aplicar',
				summaryTitle: 'Sincronización — promoción Production',
				summary: [
					['Operación', DB_SYNC_DIRECTION_LABELS[direction]],
					['Slug', packageData.invitation.slug],
					['Respaldo', 'Controles del motor de promoción'],
					['Autorización', 'Confirmación interactiva del propietario'],
				],
				technicalReview: [
					['Impacto', 'Delega apply de promoción administrada en Production'],
					['Dirección', DB_SYNC_DIRECTION_LABELS[direction]],
					['Slug', packageData.invitation.slug],
					['Plan ID', rebuilt.planId],
					['Package hash', packageData.packageHash],
					['Tipo interno', 'invitation-promote'],
					['Controles', 'TTY · agente bloqueado · release-check · plan exacto · sin token'],
				],
			});
			const report = await runPromotionApply({
				preflight,
				packageData,
			});
			const publicReport = toPublicPromotionReport(report);
			applyResult.ok = publicReport.status === 'PROMOTED';
			applyResult.status = publicReport.status;
			if (!applyResult.ok) {
				applyResult.failures.push(publicReport.reason ?? publicReport.status);
			}
			return applyResult;
		}

		throw new Error(`Unhandled direction: ${direction}`);
	} catch (error: unknown) {
		applyResult.ok = false;
		applyResult.status = 'FAILED';
		applyResult.failures.push(error instanceof Error ? error.message : String(error));
		return applyResult;
	}
}

export async function orchestrateDbSync(input: OrchestrateDbSyncInput): Promise<DbSyncResult> {
	switch (input.mode) {
		case 'diagnose':
			return orchestrateDiagnose(input);
		case 'compare':
			return orchestrateCompare(input);
		case 'plan':
			return orchestratePlan(input);
		case 'apply':
			return orchestrateApply(input);
		default: {
			const result = emptyResult('diagnose');
			result.failures.push(`Unknown mode: ${String(input.mode)}`);
			return result;
		}
	}
}
