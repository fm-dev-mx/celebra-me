/** Spanish operator labels for the canonical status dashboard. */
import type {
	DisposableProofStatus,
	EvidenceState,
	PromotionAction,
	SchemaOperationReadiness,
	TargetEnv,
} from './types';

export const ENV_LABELS: Record<TargetEnv, string> = {
	local: 'Local',
	preview: 'Preview',
	production: 'Producción',
};

export const EVIDENCE_LABELS: Record<EvidenceState, string> = {
	LIVE: 'LIVE',
	CACHED: 'CACHED',
	UNVERIFIED: 'UNVERIFIED',
};

export const READINESS_LABELS: Record<SchemaOperationReadiness, string> = {
	READY: 'Lista',
	NEEDS_DISPOSABLE_PROOF: 'Requiere prueba disposable',
	PENDING_MIGRATIONS: 'Migraciones pendientes',
	SCHEMA_DRIFT: 'Divergencia de esquema',
	UNREACHABLE: 'No alcanzable',
	NOT_CONFIGURED: 'Sin configurar',
	UNVERIFIED: 'Sin verificar',
};

export const DISPOSABLE_LABELS: Record<DisposableProofStatus, string> = {
	valid: 'VÁLIDA',
	missing: 'AUSENTE',
	stale: 'OBSOLETA',
};

export const ACTION_LABELS: Record<Exclude<PromotionAction, 'NONE'>, string> = {
	PROMOTE_PREVIEW: 'PROMOTE_PREVIEW',
	PROMOTE_PRODUCTION: 'PROMOTE_PRODUCTION',
	BLOCKED: 'BLOCKED',
	UNKNOWN: 'UNKNOWN',
};
