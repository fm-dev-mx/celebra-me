/**
 * db-sync-types.ts — Shared contracts for `pnpm db:sync` orchestration facade.
 * Secret-free JSON envelope; no mutation engines.
 */

import { redactCredentials } from './db-target-config.ts';

export const DB_SYNC_SCHEMA_VERSION = '1.0.0' as const;

export const DB_SYNC_MODES = ['diagnose', 'compare', 'plan', 'apply'] as const;
export type DbSyncMode = (typeof DB_SYNC_MODES)[number];

/**
 * Hard allowlist of content-sync directions.
 * Schema migrate and Local dump restore are intentionally absent.
 */
export const DB_SYNC_DIRECTIONS = [
	'definition-to-local',
	'definition-to-preview',
	'package-to-production',
	'production-to-preview-mirror',
] as const;
export type DbSyncDirection = (typeof DB_SYNC_DIRECTIONS)[number];

export const DB_SYNC_DIRECTION_LABELS: Record<DbSyncDirection, string> = {
	'definition-to-local': 'Update invitation in Local',
	'definition-to-preview': 'Update invitation in Preview',
	'package-to-production': 'Promote approved invitation to Production',
	'production-to-preview-mirror': 'Mirror Production content into Preview',
};

export const DB_SYNC_DELEGATED_ENGINES: Record<DbSyncDirection, string> = {
	'definition-to-local': 'applyLocalInvitation',
	'definition-to-preview': 'runPreviewApply / runImportEngine',
	'package-to-production': 'runPromotionPreflight / runPromotionApply',
	'production-to-preview-mirror': 'runPreviewMirror',
};

export type DbSyncEvidenceClass =
	'migration_history_parity' | 'semantic_content_parity' | 'database_availability' | 'mixed';

export interface DbSyncTargetEvidence {
	environment: 'local' | 'preview' | 'production';
	available: boolean;
	reason?: string;
	redactedIdentity?: string;
	schemaLifecycle?: string;
	reachable?: boolean;
}

export interface DbSyncDrift {
	kind: string;
	entity: string;
	detail: string;
	environments?: string[];
	paths?: string[];
}

export interface DbSyncArtifactRef {
	kind: string;
	path?: string;
	detail?: string;
}

export interface DbSyncPlanGates {
	previewApprovalRequired: boolean;
	releaseCheckRequired: boolean;
	criticalBackupRequired: boolean;
	previewWriteAuthRequired: boolean;
	ownerProductionApplyRequired: boolean;
	rsvpResetDisclosureRequired: boolean;
	/** Content apply requires history-parity CURRENT on the write target. */
	schemaCurrentRequired: boolean;
}

export interface DbSyncPlan {
	schemaVersion: typeof DB_SYNC_SCHEMA_VERSION;
	planId: string;
	mode: 'plan' | 'apply';
	direction: DbSyncDirection;
	slug: string | null;
	packageHash: string | null;
	sourceHash: string | null;
	redactedSourceIdentity: string;
	redactedTargetIdentity: string;
	dataFingerprint: string;
	assetFingerprint: string;
	schemaEvidence: string;
	gates: DbSyncPlanGates;
	delegatedEngine: string;
	delegatedOperation: string;
	expectedPostState: string;
	createdAt: string;
	expiresAt: string;
	/** Engine-native plan id when wrapping update/promote plans. */
	enginePlanId?: string;
}

export interface DbSyncResult {
	schemaVersion: typeof DB_SYNC_SCHEMA_VERSION;
	command: 'db:sync';
	mode: DbSyncMode;
	direction: DbSyncDirection | null;
	planId: string | null;
	ok: boolean;
	status: string;
	targets: DbSyncTargetEvidence[];
	evidenceClass: DbSyncEvidenceClass;
	drifts: DbSyncDrift[];
	failures: string[];
	artifacts: DbSyncArtifactRef[];
	plan?: DbSyncPlan;
	blockers?: string[];
}

export const PLAN_TTL_MS = 30 * 60 * 1000;

export function isDbSyncMode(value: string): value is DbSyncMode {
	return (DB_SYNC_MODES as readonly string[]).includes(value);
}

export function isDbSyncDirection(value: string): value is DbSyncDirection {
	return (DB_SYNC_DIRECTIONS as readonly string[]).includes(value);
}

export function assertAllowedDirection(direction: string): DbSyncDirection {
	if (!isDbSyncDirection(direction)) {
		throw new Error(
			`FORBIDDEN_DIRECTION: "${direction}" is not in the db:sync allowlist. ` +
				`Allowed: ${DB_SYNC_DIRECTIONS.join(', ')}. ` +
				`Preview→Production, Local→Production (without promote), and dump restore are not synchronization.`,
		);
	}
	return direction;
}

export function emptyResult(mode: DbSyncMode): DbSyncResult {
	return {
		schemaVersion: DB_SYNC_SCHEMA_VERSION,
		command: 'db:sync',
		mode,
		direction: null,
		planId: null,
		ok: false,
		status: 'UNEVALUATED',
		targets: [],
		evidenceClass: 'mixed',
		drifts: [],
		failures: [],
		artifacts: [],
		blockers: [],
	};
}

function redactDeep(value: unknown): unknown {
	if (typeof value === 'string') return redactCredentials(value);
	if (Array.isArray(value)) return value.map((entry) => redactDeep(entry));
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
			out[key] = redactDeep(entry);
		}
		return out;
	}
	return value;
}

/** Deterministic JSON for agents — never include secrets or raw DB URLs. */
export function resultToJson(result: DbSyncResult): string {
	return `${JSON.stringify(redactDeep(result), null, 2)}\n`;
}

export function exitCodeForResult(
	result: DbSyncResult,
	options: { strict?: boolean } = {},
): number {
	if (result.mode === 'apply') return result.ok ? 0 : 1;
	if (options.strict || result.mode === 'diagnose') {
		if (!result.ok) return 1;
	}
	if (result.failures.length > 0) return 1;
	return result.ok ? 0 : 1;
}
