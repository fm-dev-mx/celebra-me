/**
 * Pure schema lifecycle classification for invitation operational preflights.
 *
 * Invitation workflows must never run migrations automatically. Promotion
 * preflight returns SCHEMA_INCOMPATIBLE / OWNER_ACTION_REQUIRED when this
 * classifier does not report CURRENT.
 *
 * This module is the single schema lifecycle classifier. Operator-facing
 * labels (e.g. SCHEMA_UNVERIFIED) are produced only by CLI/UI formatters.
 */

export type SchemaLifecycleState = 'CURRENT' | 'BEHIND' | 'SCHEMA_DRIFT' | 'UNVERIFIED';

/** Domain that produced an UNVERIFIED result. */
export type StatusEvidenceDomain = 'schema' | 'content' | 'inventory';

/** Which evidence backed a schema lifecycle claim. */
export type SchemaEvidenceClass =
	| 'migration_history_parity'
	| 'object_audit_readiness';

/**
 * Structured UNVERIFIED result shared across schema, content, and inventory.
 * Domain-prefixed status tokens are formatter-only and must not appear here.
 */
export interface DomainUnverifiedResult {
	status: 'UNVERIFIED';
	domain: StatusEvidenceDomain;
	reason: string;
	evidenceClass?: SchemaEvidenceClass;
}

interface SchemaLifecycleInput {
	pendingMigrations?: readonly string[];
	extraMigrations?: readonly string[];
	mismatchedMigrations?: readonly string[];
	auditErrors?: readonly string[];
	verified?: boolean;
}

export function classifySchemaLifecycle(input: SchemaLifecycleInput): SchemaLifecycleState {
	if (input.verified === false) return 'UNVERIFIED';
	if ((input.extraMigrations?.length ?? 0) > 0 || (input.mismatchedMigrations?.length ?? 0) > 0) {
		return 'SCHEMA_DRIFT';
	}
	if ((input.auditErrors?.length ?? 0) > 0) return 'SCHEMA_DRIFT';
	if ((input.pendingMigrations?.length ?? 0) > 0) return 'BEHIND';
	return 'CURRENT';
}

export function domainUnverified(
	domain: StatusEvidenceDomain,
	reason: string,
	evidenceClass?: SchemaEvidenceClass,
): DomainUnverifiedResult {
	return {
		status: 'UNVERIFIED',
		domain,
		reason,
		...(evidenceClass ? { evidenceClass } : {}),
	};
}

/** Default evidence class for fast status / observability history probes. */
export const DEFAULT_STATUS_SCHEMA_EVIDENCE: SchemaEvidenceClass = 'migration_history_parity';
