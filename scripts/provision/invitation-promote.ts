/**
 * invitation-promote.ts — Owner-only Production managed-content promotion.
 *
 * Orchestrates existing approval, preflight, schema, backup, import-engine,
 * and verification infrastructure. Does not run migrations or invent a second
 * Production publication path.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluateMigrationHistoryParity } from '../db/audit-db.ts';
import { fetchRemoteMigrationVersions } from '../status-core/migration-history-reader.ts';
import {
	validateCriticalBackupManifest,
	type CriticalBackupManifest,
} from '../db/backup-manifest.ts';
import { CRITICAL_BACKUP_RPO_MS } from '../db/critical-backup-reuse.ts';
import {
	classifySchemaLifecycle,
	type SchemaLifecycleState,
} from '../db/schema-lifecycle-state.ts';
import { PROJECT_ROOT } from '../db/db-workflow-lib.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import {
	runImportEngine,
	type ImportEngineOptions,
	type ImportEngineResult,
} from './invitation-import-engine.ts';
import { assertEngineResult } from './invitation-engine-result.ts';
import {
	verifyPreviewApprovalArtifact,
	type PreviewApprovalArtifact,
} from './preview-approval-service.ts';
import { getDefaultPreviewApprovalStore } from './preview-approval-store.ts';
import {
	verifyPreviewArtifactLive,
	type PreviewLiveVerificationResult,
} from './preview-live-verification.ts';
import {
	ProductionPreflightError,
	runProductionPreflight,
	type ProductionPreflightResult,
} from './production-preflight.ts';
import { type ConflictResolutions, type UpdateScope } from './semantic-delta.ts';
import type { AssetPolicy } from './asset-reconciliation.ts';
import type { OperationalPlan } from './invitation-update-plan.ts';
import {
	divergenceFromManagedBaseline,
	divergenceFromMergeConflict,
	emptyDivergence,
	type PromotionDivergenceSummary,
} from './promotion-divergence.ts';

export { classifyPromotionDifferences } from './promotion-divergence.ts';

export type PromotionTerminalStatus =
	'PROMOTABLE' | 'PROMOTED' | 'IN_SYNC' | 'BLOCKED' | 'APPLIED_BUT_VERIFICATION_FAILED';

export type PromotionBlockCode =
	| 'MISSING_PREVIEW_APPROVAL'
	| 'APPROVAL_IDENTITY_MISMATCH'
	| 'PRODUCTION_CREDENTIALS_UNAVAILABLE'
	| 'PRODUCTION_PLAN_BLOCKED'
	| 'SCHEMA_INCOMPATIBLE'
	| 'BACKUP_REQUIRED'
	| 'MANAGED_DIVERGENCE'
	| 'CONFIRMATION_REQUIRED'
	| 'VERIFICATION_FAILED';

export interface PromotionSchemaGateResult {
	state: SchemaLifecycleState;
	migrationHead: string | null;
	pendingMigrations: string[];
	extraMigrations: string[];
	compatible: boolean;
	blockCode?: PromotionBlockCode;
	detail: string;
}

export interface PromotionBackupGateResult {
	required: boolean;
	acceptable: boolean;
	manifestPath?: string;
	createdAt?: string;
	projectRef?: string;
	canonicalCommand: string;
	blockCode?: PromotionBlockCode;
	detail: string;
}

export interface PromotionPreflightReport {
	status: PromotionTerminalStatus;
	blockCode?: PromotionBlockCode;
	reason?: string;
	slug: string;
	packageHash: string;
	sourceHash: string;
	projectionHash: string;
	assetManifestHash: string;
	approval?: PreviewApprovalArtifact;
	productionProjectRef?: string;
	schema: PromotionSchemaGateResult;
	backup: PromotionBackupGateResult;
	divergence: PromotionDivergenceSummary;
	engineResult?: ImportEngineResult & { plan: OperationalPlan };
	targetDbUrl?: string;
}

export interface PromotionApplyReport extends PromotionPreflightReport {
	applyResult?: ImportEngineResult & { plan: OperationalPlan };
	verification?: {
		ok: boolean;
		detail: string;
		schema: PromotionSchemaGateResult;
		managedConflicts: number;
		provenancePackageHash?: string | null;
	};
}

const MIGRATIONS_DIR = resolve(PROJECT_ROOT, 'supabase', 'migrations');
const DEFAULT_BACKUP_ROOT = resolve(PROJECT_ROOT, '.backups', 'prod');
/** Planned Production mutations share the critical migrate RPO (15 minutes). */
const CANONICAL_BACKUP_COMMAND = 'pnpm db:prod:backup:critical';

export function listExpectedMigrationVersions(migrationsDir: string = MIGRATIONS_DIR): string[] {
	if (!existsSync(migrationsDir)) return [];
	return readdirSync(migrationsDir)
		.filter((f) => f.endsWith('.sql'))
		.sort()
		.map((f) => f.split('_')[0]!)
		.filter(Boolean);
}

export function evaluatePromotionSchemaGate(input: {
	dbUrl: string;
	fetchRemote?: typeof fetchRemoteMigrationVersions;
	expectedVersions?: string[];
}): PromotionSchemaGateResult {
	const expectedVersions = input.expectedVersions ?? listExpectedMigrationVersions();
	try {
		const remote = (input.fetchRemote ?? fetchRemoteMigrationVersions)(input.dbUrl);
		if (remote.isUninitialized && expectedVersions.length > 0) {
			const state = classifySchemaLifecycle({
				pendingMigrations: expectedVersions,
				verified: true,
			});
			return {
				state,
				migrationHead: null,
				pendingMigrations: expectedVersions,
				extraMigrations: [],
				compatible: false,
				blockCode: 'SCHEMA_INCOMPATIBLE',
				detail: `SCHEMA_INCOMPATIBLE / OWNER_ACTION_REQUIRED: Production schema is uninitialized relative to ${expectedVersions.length} expected migrations. Run pnpm db:migrate, then rerun invitation:release --targets production.`,
			};
		}
		const parity = evaluateMigrationHistoryParity(expectedVersions, remote.remoteVersions);
		const state = classifySchemaLifecycle({
			pendingMigrations: parity.pendingLocal,
			extraMigrations: parity.extraRemote,
			mismatchedMigrations:
				parity.isReordered || parity.hasDivergentHistory
					? parity.extraRemote.length > 0
						? parity.extraRemote
						: parity.pendingLocal.length > 0
							? parity.pendingLocal
							: ['divergent-history']
					: [],
			auditErrors: parity.errors.filter((e) => !e.startsWith('Pending local migrations')),
			verified: true,
		});
		const compatible = state === 'CURRENT';
		return {
			state,
			migrationHead: remote.remoteVersions.at(-1) ?? null,
			pendingMigrations: parity.pendingLocal,
			extraMigrations: parity.extraRemote,
			compatible,
			blockCode: compatible ? undefined : 'SCHEMA_INCOMPATIBLE',
			detail: compatible
				? `Schema lifecycle ${state}; Production matches expected migration head ${remote.remoteVersions.at(-1) ?? '(none)'}.`
				: `SCHEMA_INCOMPATIBLE / OWNER_ACTION_REQUIRED: schema lifecycle is ${state}. Promotion never runs migrations. Owner must execute pnpm db:migrate (or remediate SCHEMA_DRIFT), then rerun invitation:release --targets production.`,
		};
	} catch (error) {
		return {
			state: 'UNVERIFIED',
			migrationHead: null,
			pendingMigrations: [],
			extraMigrations: [],
			compatible: false,
			blockCode: 'SCHEMA_INCOMPATIBLE',
			detail: `SCHEMA_INCOMPATIBLE / OWNER_ACTION_REQUIRED: schema state is UNVERIFIED (${error instanceof Error ? error.message : String(error)}).`,
		};
	}
}

export function findLatestCriticalBackupManifest(
	backupRoot: string = DEFAULT_BACKUP_ROOT,
): string | undefined {
	if (!existsSync(backupRoot)) return undefined;
	const candidates: { path: string; mtimeMs: number }[] = [];
	for (const entry of readdirSync(backupRoot, { withFileTypes: true })) {
		if (!entry.isDirectory() || !entry.name.startsWith('critical-')) continue;
		const manifestPath = join(backupRoot, entry.name, 'manifest.json');
		if (!existsSync(manifestPath)) continue;
		candidates.push({ path: manifestPath, mtimeMs: statSync(manifestPath).mtimeMs });
	}
	candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return candidates[0]?.path;
}

export function evaluatePromotionBackupGate(input: {
	manifestPath?: string;
	backupRoot?: string;
	productionProjectRef?: string;
	now?: Date;
	maxAgeMs?: number;
	required?: boolean;
}): PromotionBackupGateResult {
	const required = input.required !== false;
	const canonicalCommand = CANONICAL_BACKUP_COMMAND;
	if (!required) {
		return {
			required: false,
			acceptable: true,
			canonicalCommand,
			detail: 'Backup gate not required for this read-only promotion inspection.',
		};
	}

	const manifestPath =
		input.manifestPath?.trim() ||
		findLatestCriticalBackupManifest(input.backupRoot ?? DEFAULT_BACKUP_ROOT);
	if (!manifestPath) {
		return {
			required: true,
			acceptable: false,
			canonicalCommand,
			blockCode: 'BACKUP_REQUIRED',
			detail: `BACKUP_REQUIRED: no verified critical Production backup manifest found. Run ${canonicalCommand} and pass --backup-manifest <path>.`,
		};
	}

	try {
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
		validateCriticalBackupManifest(manifest);
		const createdAtMs = Date.parse(manifest.createdAt);
		const nowMs = (input.now ?? new Date()).getTime();
		const maxAgeMs = input.maxAgeMs ?? CRITICAL_BACKUP_RPO_MS;
		if (
			!Number.isFinite(createdAtMs) ||
			createdAtMs > nowMs ||
			nowMs - createdAtMs > maxAgeMs
		) {
			return {
				required: true,
				acceptable: false,
				manifestPath,
				createdAt: manifest.createdAt,
				projectRef: manifest.projectRef,
				canonicalCommand,
				blockCode: 'BACKUP_REQUIRED',
				detail: `BACKUP_REQUIRED: backup manifest is missing a fresh timestamp or is older than ${Math.round(maxAgeMs / 60000)}m (critical RPO). Run ${canonicalCommand}.`,
			};
		}
		if (
			input.productionProjectRef &&
			manifest.projectRef &&
			manifest.projectRef !== input.productionProjectRef
		) {
			return {
				required: true,
				acceptable: false,
				manifestPath,
				createdAt: manifest.createdAt,
				projectRef: manifest.projectRef,
				canonicalCommand,
				blockCode: 'BACKUP_REQUIRED',
				detail: `BACKUP_REQUIRED: backup projectRef "${manifest.projectRef}" does not match Production "${input.productionProjectRef}".`,
			};
		}
		return {
			required: true,
			acceptable: true,
			manifestPath,
			createdAt: manifest.createdAt,
			projectRef: manifest.projectRef,
			canonicalCommand,
			detail: `Verified critical backup ${manifestPath} captured at ${manifest.createdAt}.`,
		};
	} catch (error) {
		return {
			required: true,
			acceptable: false,
			manifestPath,
			canonicalCommand,
			blockCode: 'BACKUP_REQUIRED',
			detail: `BACKUP_REQUIRED: backup manifest is invalid or unverifiable (${error instanceof Error ? error.message : String(error)}).`,
		};
	}
}

function requireApprovedRelease(
	packageData: InvitationPackageData,
	approvalsDirs?: string[],
	now?: Date,
	intendedProductionProjectRef?: string,
	liveRecheck?: PreviewLiveVerificationResult,
): PreviewApprovalArtifact {
	try {
		return verifyPreviewApprovalArtifact(
			{
				packageHash: packageData.packageHash,
				sourceHash: packageData.sourceHash,
				metadataHash: packageData.metadataHash,
				projectionHash: packageData.projectionHash,
				assetManifestHash: packageData.assetManifestHash,
				slug: packageData.invitation.slug,
				route: `/${packageData.invitation.eventType}/${packageData.invitation.slug}`,
				intendedProductionProjectRef,
			},
			liveRecheck ? { now, liveRecheck } : approvalsDirs,
			liveRecheck ? undefined : now,
		);
	} catch (error) {
		throw new ProductionPreflightError(
			'MISSING_PREVIEW_APPROVAL',
			`MISSING_PREVIEW_APPROVAL: exact approved Preview release is required. ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
}

/** Orchestrates approval, schema, backup, and Production dry-run planning. */
// eslint-disable-next-line complexity -- Promotion preflight is intentionally a single ordered gate sequence.
export async function runPromotionPreflight(input: {
	packageData: InvitationPackageData;
	ownerUserId?: string;
	approvalsDirs?: string[];
	now?: Date;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	updateScope?: UpdateScope;
	conflictResolutions?: ConflictResolutions;
	backupManifestPath?: string;
	backupRoot?: string;
	requireBackup?: boolean;
	/** Reviewed plan from the first preflight; binds create identity on rebuild. */
	plan?: ImportEngineOptions['plan'];
	getProductionDbUrl: () => { url: string };
	runEngine?: (options: ImportEngineOptions) => Promise<ImportEngineResult>;
	evaluateSchema?: typeof evaluatePromotionSchemaGate;
	evaluateBackup?: typeof evaluatePromotionBackupGate;
	liveRecheck?: PreviewLiveVerificationResult;
	runLiveVerification?: typeof verifyPreviewArtifactLive;
}): Promise<PromotionPreflightReport> {
	const slug = input.packageData.invitation.slug;
	const base = {
		slug,
		packageHash: input.packageData.packageHash,
		sourceHash: input.packageData.sourceHash,
		projectionHash: input.packageData.projectionHash,
		assetManifestHash: input.packageData.assetManifestHash,
	};

	let targetDbUrl: string;
	try {
		targetDbUrl = input.getProductionDbUrl().url;
	} catch {
		const schema: PromotionSchemaGateResult = {
			state: 'UNVERIFIED',
			migrationHead: null,
			pendingMigrations: [],
			extraMigrations: [],
			compatible: false,
			blockCode: 'SCHEMA_INCOMPATIBLE',
			detail: 'Production credentials unavailable; schema cannot be classified.',
		};
		return {
			...base,
			status: 'BLOCKED',
			blockCode: 'PRODUCTION_CREDENTIALS_UNAVAILABLE',
			reason: 'Credenciales de Producción no configuradas. Configure acceso owner y vuelva a ejecutar el preflight.',
			schema,
			backup: {
				required: false,
				acceptable: true,
				canonicalCommand: CANONICAL_BACKUP_COMMAND,
				detail: 'Backup gate skipped because Production credentials are unavailable.',
			},
			divergence: emptyDivergence(),
		};
	}

	const schema = (input.evaluateSchema ?? evaluatePromotionSchemaGate)({ dbUrl: targetDbUrl });
	if (!schema.compatible) {
		return {
			...base,
			status: 'BLOCKED',
			blockCode: schema.blockCode ?? 'SCHEMA_INCOMPATIBLE',
			reason: schema.detail,
			schema,
			backup: (input.evaluateBackup ?? evaluatePromotionBackupGate)({
				manifestPath: input.backupManifestPath,
				backupRoot: input.backupRoot,
				required: input.requireBackup !== false,
				now: input.now,
			}),
			divergence: emptyDivergence(),
			targetDbUrl,
		};
	}

	let liveRecheck = input.liveRecheck;
	if (!liveRecheck && !input.approvalsDirs) {
		const storedApproval = getDefaultPreviewApprovalStore().get(input.packageData.packageHash);
		if (storedApproval) {
			liveRecheck = await (input.runLiveVerification ?? verifyPreviewArtifactLive)(
				storedApproval,
			);
		}
	}

	let approval: PreviewApprovalArtifact;
	try {
		approval = requireApprovedRelease(
			input.packageData,
			input.approvalsDirs,
			input.now,
			undefined,
			liveRecheck,
		);
	} catch (error) {
		return {
			...base,
			status: 'BLOCKED',
			blockCode: 'MISSING_PREVIEW_APPROVAL',
			reason: error instanceof Error ? error.message : String(error),
			schema,
			backup: (input.evaluateBackup ?? evaluatePromotionBackupGate)({
				manifestPath: input.backupManifestPath,
				backupRoot: input.backupRoot,
				required: input.requireBackup !== false,
				now: input.now,
			}),
			divergence: emptyDivergence(),
			targetDbUrl,
		};
	}

	let preflight: ProductionPreflightResult;
	try {
		preflight = await runProductionPreflight({
			packageData: input.packageData,
			ownerUserId: input.ownerUserId,
			approvalsDirs: input.approvalsDirs,
			now: input.now,
			assetPolicy: input.assetPolicy,
			pruneAssets: input.pruneAssets,
			updateScope: input.updateScope,
			conflictResolutions: input.conflictResolutions,
			plan: input.plan,
			getProductionDbUrl: () => ({ url: targetDbUrl }),
			runEngine: input.runEngine,
			liveRecheck,
		});
	} catch (error) {
		const divergence =
			divergenceFromMergeConflict(error) ?? divergenceFromManagedBaseline(error);
		if (divergence?.blocksPromotion) {
			return {
				...base,
				status: 'BLOCKED',
				blockCode: 'MANAGED_DIVERGENCE',
				reason: 'Unresolved Production managed divergence blocks promotion. Resolve semantically before apply; Production must not be blindly replaced by Preview.',
				approval,
				schema,
				backup: (input.evaluateBackup ?? evaluatePromotionBackupGate)({
					manifestPath: input.backupManifestPath,
					backupRoot: input.backupRoot,
					productionProjectRef: approval.intendedProductionProjectRef,
					required: input.requireBackup !== false,
					now: input.now,
				}),
				divergence,
				targetDbUrl,
			};
		}
		const code =
			error instanceof ProductionPreflightError
				? error.code === 'PRODUCTION_CREDENTIALS_UNAVAILABLE'
					? 'PRODUCTION_CREDENTIALS_UNAVAILABLE'
					: error.code === 'MISSING_PREVIEW_APPROVAL'
						? 'MISSING_PREVIEW_APPROVAL'
						: 'PRODUCTION_PLAN_BLOCKED'
				: 'PRODUCTION_PLAN_BLOCKED';
		const message = error instanceof Error ? error.message : String(error);
		const isDivergence = /divergence|managed divergence|merge_conflict|DRIFT/i.test(message);
		return {
			...base,
			status: 'BLOCKED',
			blockCode: isDivergence ? 'MANAGED_DIVERGENCE' : code,
			reason: message,
			approval,
			schema,
			backup: (input.evaluateBackup ?? evaluatePromotionBackupGate)({
				manifestPath: input.backupManifestPath,
				backupRoot: input.backupRoot,
				productionProjectRef: approval.intendedProductionProjectRef,
				required: input.requireBackup !== false,
				now: input.now,
			}),
			divergence: emptyDivergence(),
			targetDbUrl,
		};
	}

	// Re-verify approval against the exact Production project discovered by planning.
	try {
		approval = requireApprovedRelease(
			input.packageData,
			input.approvalsDirs,
			input.now,
			preflight.engineResult.projectRef,
			liveRecheck,
		);
	} catch (error) {
		return {
			...base,
			status: 'BLOCKED',
			blockCode: 'APPROVAL_IDENTITY_MISMATCH',
			reason: error instanceof Error ? error.message : String(error),
			approval: preflight.approval,
			productionProjectRef: preflight.engineResult.projectRef,
			schema,
			backup: (input.evaluateBackup ?? evaluatePromotionBackupGate)({
				manifestPath: input.backupManifestPath,
				backupRoot: input.backupRoot,
				productionProjectRef: preflight.engineResult.projectRef,
				required: input.requireBackup !== false,
				now: input.now,
			}),
			divergence: emptyDivergence(),
			engineResult: preflight.engineResult,
			targetDbUrl,
		};
	}

	const backup = (input.evaluateBackup ?? evaluatePromotionBackupGate)({
		manifestPath: input.backupManifestPath,
		backupRoot: input.backupRoot,
		productionProjectRef: preflight.engineResult.projectRef,
		required: input.requireBackup !== false,
		now: input.now,
	});
	if (!backup.acceptable) {
		return {
			...base,
			status: 'BLOCKED',
			blockCode: backup.blockCode ?? 'BACKUP_REQUIRED',
			reason: backup.detail,
			approval,
			productionProjectRef: preflight.engineResult.projectRef,
			schema,
			backup,
			divergence: emptyDivergence(),
			engineResult: preflight.engineResult,
			targetDbUrl,
		};
	}

	const divergence = emptyDivergence();
	for (const change of preflight.engineResult.functionalChanges ?? []) {
		if (change.operation === 'reuse' || change.operation === 'skip') continue;
		divergence.safeManagedChanges.push({
			classification: 'SAFE_MANAGED_CHANGE',
			path: change.field ?? `${change.section}.${change.entity}`,
			detail: `${change.label} (${change.operation})`,
			previousCanonicalValue: change.previousValue,
			packageValue: change.newValue,
		});
	}

	const status: PromotionTerminalStatus = preflight.engineResult.isZeroDrift
		? 'IN_SYNC'
		: 'PROMOTABLE';
	return {
		...base,
		status,
		approval,
		productionProjectRef: preflight.engineResult.projectRef,
		schema,
		backup,
		divergence,
		engineResult: preflight.engineResult,
		targetDbUrl,
	};
}

export async function runPromotionApply(input: {
	preflight: PromotionPreflightReport;
	packageData: InvitationPackageData;
	ownerUserId?: string;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	updateScope?: UpdateScope;
	conflictResolutions?: ConflictResolutions;
	runEngine?: (options: ImportEngineOptions) => Promise<ImportEngineResult>;
	evaluateSchema?: typeof evaluatePromotionSchemaGate;
}): Promise<PromotionApplyReport> {
	if (
		input.preflight.status === 'BLOCKED' ||
		!input.preflight.engineResult ||
		!input.preflight.targetDbUrl ||
		!input.preflight.backup.acceptable
	) {
		return {
			...input.preflight,
			status: 'BLOCKED',
			blockCode:
				input.preflight.blockCode ??
				(input.preflight.backup.acceptable ? 'PRODUCTION_PLAN_BLOCKED' : 'BACKUP_REQUIRED'),
			reason:
				input.preflight.reason ??
				(input.preflight.backup.acceptable
					? 'Promotion apply requires a successful preflight.'
					: input.preflight.backup.detail),
		};
	}

	if (input.preflight.status === 'IN_SYNC') {
		return {
			...input.preflight,
			status: 'IN_SYNC',
			applyResult: input.preflight.engineResult,
			verification: {
				ok: true,
				detail: 'Production already matches the approved managed release; no mutation performed.',
				schema: input.preflight.schema,
				managedConflicts: 0,
				provenancePackageHash: input.packageData.packageHash,
			},
		};
	}

	const applyResult = await (input.runEngine ?? runImportEngine)({
		packageData: input.packageData,
		target: 'production',
		targetDbUrl: input.preflight.targetDbUrl,
		ownerUserId: input.ownerUserId,
		dryRun: false,
		plan: input.preflight.engineResult.plan,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope: input.updateScope,
		conflictResolutions: input.conflictResolutions,
	});
	assertEngineResult(applyResult, input.preflight.engineResult.plan.planId, 'Producción', true);

	const verification = await verifyPromotionOutcome({
		packageData: input.packageData,
		targetDbUrl: input.preflight.targetDbUrl,
		ownerUserId: input.ownerUserId,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope: input.updateScope,
		conflictResolutions: input.conflictResolutions,
		runEngine: input.runEngine,
		evaluateSchema: input.evaluateSchema,
		expectedPackageHash: input.packageData.packageHash,
	});

	if (!verification.ok) {
		return {
			...input.preflight,
			status: 'APPLIED_BUT_VERIFICATION_FAILED',
			blockCode: 'VERIFICATION_FAILED',
			reason: verification.detail,
			applyResult,
			verification,
		};
	}

	return {
		...input.preflight,
		status: applyResult.isZeroDrift ? 'IN_SYNC' : 'PROMOTED',
		applyResult,
		verification,
	};
}

export async function verifyPromotionOutcome(input: {
	packageData: InvitationPackageData;
	targetDbUrl: string;
	ownerUserId?: string;
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	updateScope?: UpdateScope;
	conflictResolutions?: ConflictResolutions;
	runEngine?: (options: ImportEngineOptions) => Promise<ImportEngineResult>;
	evaluateSchema?: typeof evaluatePromotionSchemaGate;
	expectedPackageHash: string;
}): Promise<NonNullable<PromotionApplyReport['verification']>> {
	const schema = (input.evaluateSchema ?? evaluatePromotionSchemaGate)({
		dbUrl: input.targetDbUrl,
	});
	if (!schema.compatible) {
		return {
			ok: false,
			detail: `Post-apply schema gate failed: ${schema.detail}`,
			schema,
			managedConflicts: 0,
		};
	}

	try {
		const verifyResult = await (input.runEngine ?? runImportEngine)({
			packageData: input.packageData,
			target: 'production',
			targetDbUrl: input.targetDbUrl,
			ownerUserId: input.ownerUserId,
			dryRun: true,
			assetPolicy: input.assetPolicy,
			pruneAssets: input.pruneAssets,
			updateScope: input.updateScope,
			conflictResolutions: input.conflictResolutions,
		});
		assertEngineResult(verifyResult, undefined, 'Producción', false);
		const remainingMutations = verifyResult.plannedMutations;
		const ok = remainingMutations === 0 || Boolean(verifyResult.isZeroDrift);
		return {
			ok,
			detail: ok
				? 'Post-promotion verification passed: managed semantic state, plan identity, and schema are compatible.'
				: `APPLIED_BUT_VERIFICATION_FAILED: Production still reports ${remainingMutations} planned managed mutations after apply.`,
			schema,
			managedConflicts: 0,
			provenancePackageHash: input.expectedPackageHash,
		};
	} catch (error) {
		const fromMerge = divergenceFromMergeConflict(error);
		return {
			ok: false,
			detail: `APPLIED_BUT_VERIFICATION_FAILED: ${error instanceof Error ? error.message : String(error)}`,
			schema,
			managedConflicts: fromMerge?.managedDivergences.length ?? 1,
		};
	}
}
