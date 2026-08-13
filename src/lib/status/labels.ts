/** Spanish operator labels for the canonical status dashboard. */
import type {
	AuthorizationIntegrity,
	DiagnosticCode,
	DisposableProofStatus,
	SchemaOperationReadiness,
	TargetEnv,
} from './types';

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
