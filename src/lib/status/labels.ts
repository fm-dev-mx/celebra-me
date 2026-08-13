/** Spanish operator labels for the canonical status dashboard. */
import type {
	AuthorizationIntegrity,
	DiagnosticCode,
	DisposableProofStatus,
	EvidenceState,
	MigrationPresence,
	PromotionAction,
	PromotionReasonCode,
	SchemaOperationReadiness,
	StatusSemantic,
	TargetEnv,
	PatchApplicability,
} from './types';

export const PATCH_STATUS_LABELS: Record<PatchApplicability, string> = {
	NOT_APPLICABLE: 'No aplica',
	NOT_NEEDED: 'No requerido',
	PENDING: 'Pendiente',
	BLOCKED: 'Bloqueado',
	UNVERIFIED: 'Sin verificar',
};

export const ENV_LABELS: Record<TargetEnv, string> = {
	local: 'Local',
	preview: 'Preview',
	production: 'Producción',
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

export const AUTHORIZATION_LABELS: Record<AuthorizationIntegrity, string> = {
	RECORDED: 'Registrada',
	MISSING: 'Ausente',
	GRANDFATHERED: 'Previa al libro',
	NOT_APPLICABLE: 'No aplica',
	UNVERIFIED: 'Sin verificar',
};

export const SEMANTIC_LABELS: Record<StatusSemantic, string> = {
	verified: 'Verificado',
	unverified: 'Sin verificar',
	blocked: 'Requiere corrección',
	neutral: 'No aplica',
};

export const EVIDENCE_LABELS: Record<EvidenceState, string> = {
	LIVE: 'En vivo',
	CACHED: 'En caché',
	UNVERIFIED: 'Sin verificar',
};

export const FRESHNESS_LABELS: Record<
	'LIVE' | 'CACHED' | 'STALE' | 'REVALIDATING' | 'UNVERIFIED',
	string
> = {
	LIVE: 'En vivo',
	CACHED: 'En caché',
	STALE: 'Obsoleta',
	REVALIDATING: 'Revalidando',
	UNVERIFIED: 'Sin verificar',
};

export const MIGRATION_PRESENCE_LABELS: Record<MigrationPresence, string> = {
	APPLIED: 'Aplicada',
	NOT_APPLIED: 'No aplicada',
	UNVERIFIED: 'Sin verificar',
};

export const PUBLICATION_ACTION_LABELS: Record<Exclude<PromotionAction, 'NONE'>, string> = {
	PROMOTE_PREVIEW: 'Promover a Preview',
	PROMOTE_PRODUCTION: 'Promover a Production',
	BLOCKED: 'Bloqueado',
	UNKNOWN: 'Sin clasificar',
};

export const PUBLICATION_REASON_LABELS: Record<PromotionReasonCode, string> = {
	IN_SYNC: 'Local, Preview y Production coinciden con el canónico.',
	EVIDENCE_INCOMPLETE: 'La evidencia promocional en vivo está incompleta.',
	CANONICAL_UNAVAILABLE: 'No se pudo construir la huella canónica desde la definición del registro.',
	IDENTITY_CONFLICT: 'Hay filas de invitación duplicadas o con conflicto de identidad.',
	MANAGED_DIVERGENCE:
		'El contenido publicado coincide con el canónico pero el borrador diverge, o hay conflicto administrado.',
	PRODUCTION_AHEAD_OF_PREVIEW:
		'Production coincide con el canónico mientras Preview no. No es una progresión válida.',
	PREVIEW_ALIGNED_PRODUCTION_BEHIND: 'Local y Preview coinciden con el canónico. Production está detrás.',
	LOCAL_BEHIND_PREVIEW_ALIGNED: 'Preview y Production coinciden con el canónico. Local está detrás.',
	PREVIEW_BEHIND_CANONICAL: 'Preview no coincide con el canónico. La promoción válida es Preview-first.',
};

export const DIAGNOSTIC_LABELS: Record<DiagnosticCode, string> = {
	ENVIRONMENT_IDENTITY_CONFLICT: 'La identidad del entorno no coincide',
	AUTHORITATIVE_COUNT_MISMATCH: 'Hay filas de invitación duplicadas por slug',
	INVITATION_IDENTITY_CONFLICT: 'Hay identidades de invitación duplicadas',
	DRAFT_INVALID: 'El borrador administrado no es válido',
	BASELINE_UNAVAILABLE: 'No hay un baseline verificable',
	BASELINE_VERSION_INCOMPATIBLE: 'La versión del baseline no es compatible',
	MANAGED_DRIFT: 'Hay divergencia administrada en campos semánticos',
	DELIVERY_SCOPE_BLOCKED: 'El alcance autorizado bloquea la reconciliación',
	REQUIRED_PUBLISHED_ASSET_MISSING: 'Falta un asset requerido en contenido publicado',
	UNPUBLISHED_ASSET_PENDING: 'Hay assets pendientes en trabajo no publicado',
	ASSET_IDENTITY_UNVERIFIED: 'No se pudo verificar la identidad de los assets',
	LIFECYCLE_METADATA_STALE: 'El ciclo de vida declarado está obsoleto',
	DETAIL_BUDGET_EXCEEDED: 'El detalle excede el presupuesto seguro',
	PRODUCTION_AUTHORIZATION_MISSING:
		'Falta evidencia de autorización del propietario para migraciones de Production',
};
