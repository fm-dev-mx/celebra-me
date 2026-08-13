/**
 * Canonical disposable-test reference validation for object audits.
 *
 * The disposable migration proof receipt binds migration file digests; it does
 * not prove that the live database on port 54332 still has a coherent schema.
 * Object audit must validate the live reference before attributing differences
 * to Production, Preview, or persistent-local.
 */

export const REFERENCE_INVALID_LIFECYCLE = 'REFERENCE_INVALID';

export const CANONICAL_REFERENCE_TABLES = [
	'app_user_roles',
	'audit_logs',
	'commercial_record_classifications',
	'customers',
	'event_claim_codes',
	'event_memberships',
	'events',
	'guest_invitation_audit',
	'guest_invitations',
	'host_profiles',
	'intake_requests',
	'intake_submissions',
	'invitation_assets',
	'invitation_content_drafts',
	'invitation_mutation_operation_receipts',
	'invitation_publication_idempotency',
	'invitations',
	'leads',
	'managed_invitation_legacy_adoption_receipts',
	'managed_invitation_release_provenance',
	'meta_conversion_delivery_attempts',
	'meta_conversion_events',
	'meta_conversion_recoveries',
	'preview_approval_artifacts',
	'production_authorization_receipts',
	'published_invitation_content',
	'rsvp_audit_log',
	'rsvp_channel_log',
	'rsvp_records',
	'sales_orders',
	'tracking_events',
	'visitor_sessions',
] as const;

export type ReferenceInvalidCause =
	| 'unreachable'
	| 'wrong_target'
	| 'introspection_failed'
	| 'stale_or_reused'
	| 'history_mismatch'
	| 'incoherent_history_and_schema'
	| 'schema_incomplete';

export interface DisposableReferenceInput {
	reachable: boolean;
	classificationTarget: string;
	expectedVersions: readonly string[];
	liveVersions: readonly string[] | null;
	liveTableNames: readonly string[] | null;
	proofOk: boolean;
	proofAppliedVersions: readonly string[] | null;
	introspectionError?: string;
}

export interface DisposableReferenceVerdict {
	ok: boolean;
	lifecycle: typeof REFERENCE_INVALID_LIFECYCLE | 'VALID';
	cause: ReferenceInvalidCause | null;
	reason: string;
	remediation: string;
	missingTables: string[];
}

export const DISPOSABLE_REFERENCE_REMEDIATION =
	'Rebuild the canonical disposable reference with `pnpm db:disposable:reset`, then re-run the audit. Do not plan or apply Production schema changes until the reference is VALID.';

function versionsEqual(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((version, index) => version === right[index]);
}

function missingCanonicalTables(liveTableNames: readonly string[]): string[] {
	const present = new Set(liveTableNames);
	return CANONICAL_REFERENCE_TABLES.filter((tableName) => !present.has(tableName));
}

export function evaluateDisposableReference(
	input: DisposableReferenceInput,
): DisposableReferenceVerdict {
	if (!input.reachable) {
		return invalid(
			'unreachable',
			input.introspectionError
				? `Canonical disposable reference is unreachable on the disposable-test target: ${input.introspectionError}`
				: 'Canonical disposable reference is unreachable on the disposable-test target.',
		);
	}

	if (input.classificationTarget !== 'disposable-test') {
		return invalid(
			'wrong_target',
			`Canonical disposable reference introspection classified as "${input.classificationTarget}", expected "disposable-test".`,
		);
	}

	if (input.introspectionError || input.liveVersions === null || input.liveTableNames === null) {
		return invalid(
			'introspection_failed',
			input.introspectionError
				? `Canonical disposable reference introspection failed: ${input.introspectionError}`
				: 'Canonical disposable reference introspection did not return migration history and table evidence.',
		);
	}

	if (
		input.proofOk &&
		input.proofAppliedVersions !== null &&
		!versionsEqual(input.liveVersions, input.proofAppliedVersions)
	) {
		return invalid(
			'stale_or_reused',
			'Live disposable migration history does not match the current disposable migration proof. The running database is stale or reused relative to the proof receipt.',
		);
	}

	const historyAligned = versionsEqual(input.liveVersions, input.expectedVersions);
	const missingTables = missingCanonicalTables(input.liveTableNames);

	if (!historyAligned && missingTables.length > 0) {
		return invalid(
			'schema_incomplete',
			`Canonical disposable reference is missing required tables (${missingTables.join(', ')}) and migration history is ${input.liveVersions.length}/${input.expectedVersions.length}.`,
			missingTables,
		);
	}

	if (!historyAligned) {
		return invalid(
			'history_mismatch',
			`Canonical disposable reference migration history is ${input.liveVersions.length}/${input.expectedVersions.length}, expected the current workspace set (${input.expectedVersions.length}/${input.expectedVersions.length}).`,
		);
	}

	if (missingTables.length > 0) {
		return invalid(
			'incoherent_history_and_schema',
			`Canonical disposable reference claims current migration history (${input.liveVersions.length}/${input.expectedVersions.length}) but is missing required tables: ${missingTables.join(', ')}.`,
			missingTables,
		);
	}

	return {
		ok: true,
		lifecycle: 'VALID',
		cause: null,
		reason: `Canonical disposable reference is valid (${input.liveVersions.length}/${input.expectedVersions.length} migrations; required tables present).`,
		remediation: '',
		missingTables: [],
	};
}

function invalid(
	cause: ReferenceInvalidCause,
	reason: string,
	missingTables: string[] = [],
): DisposableReferenceVerdict {
	return {
		ok: false,
		lifecycle: REFERENCE_INVALID_LIFECYCLE,
		cause,
		reason,
		remediation: DISPOSABLE_REFERENCE_REMEDIATION,
		missingTables,
	};
}
