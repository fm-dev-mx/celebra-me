/**
 * Shared schema-lifecycle contract for status consumers.
 *
 * Authoritative classifier: scripts/db/schema-lifecycle-state.ts
 * Live history probe: scripts/status-core/migration-probe.ts
 * Object-level audit: scripts/db/audit-db.ts (separate evidence class)
 *
 * Migration-history parity and object-level audit readiness are NOT equivalent.
 * Do not present a history-only CURRENT as proof of object audit readiness.
 */

import type { SchemaLifecycleState } from '../db/schema-lifecycle-state.ts';

/** Which evidence backed a schema lifecycle claim. */
export type SchemaEvidenceClass =
	| 'migration_history_parity'
	| 'object_audit_readiness';

/** Operator-facing status domains that may emit UNVERIFIED. */
export type StatusDomain = 'SCHEMA' | 'CONTENT' | 'INVENTORY';

export type DomainUnverifiedStatus = `${StatusDomain}_UNVERIFIED`;

/**
 * Label an unavailable / unprobed result with its domain so operators never
 * confuse schema, content, or inventory UNVERIFIED tokens.
 */
export function formatDomainUnverified(
	domain: StatusDomain,
	detail?: string,
): { status: DomainUnverifiedStatus; domain: StatusDomain; detail: string } {
	return {
		status: `${domain}_UNVERIFIED`,
		domain,
		detail:
			detail ??
			`${domain} evidence unavailable or not probed; fail-closed (do not infer healthy state).`,
	};
}

/**
 * Operator-facing schema lifecycle label. History states stay CURRENT / BEHIND /
 * SCHEMA_DRIFT; UNVERIFIED becomes SCHEMA_UNVERIFIED.
 */
export function formatSchemaLifecycleLabel(
	lifecycle: SchemaLifecycleState,
): 'CURRENT' | 'BEHIND' | 'SCHEMA_DRIFT' | 'SCHEMA_UNVERIFIED' {
	if (lifecycle === 'UNVERIFIED') return 'SCHEMA_UNVERIFIED';
	return lifecycle;
}

/** Default evidence class for dbs / managed-status / observability probes. */
export const DEFAULT_STATUS_SCHEMA_EVIDENCE: SchemaEvidenceClass = 'migration_history_parity';
