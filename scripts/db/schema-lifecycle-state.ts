/**
 * Pure schema lifecycle classification for invitation operational preflights.
 *
 * Invitation workflows must never run migrations automatically. Promotion
 * preflight returns SCHEMA_INCOMPATIBLE / OWNER_ACTION_REQUIRED when this
 * classifier does not report CURRENT.
 */
export type SchemaLifecycleState = 'CURRENT' | 'BEHIND' | 'SCHEMA_DRIFT' | 'UNVERIFIED';

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
