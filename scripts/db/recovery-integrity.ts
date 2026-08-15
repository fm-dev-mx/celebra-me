import { createHash } from 'node:crypto';
import { quoteIdentifier, runCommand } from './db-workflow-lib.ts';

/**
 * Fingerprint ORDER BY must follow each table's primary key. Several critical
 * tables have no `id` column; a hardcoded `t.id` aborts the batched snapshot.
 */
export const CRITICAL_RECOVERY_TABLES = [
	{ schema: 'public', table: 'invitations', orderBy: 't.id' },
	{ schema: 'public', table: 'events', orderBy: 't.id' },
	{ schema: 'public', table: 'event_memberships', orderBy: 't.id' },
	{ schema: 'public', table: 'event_claim_codes', orderBy: 't.id' },
	{ schema: 'public', table: 'guest_invitations', orderBy: 't.id' },
	{ schema: 'public', table: 'guest_invitation_audit', orderBy: 't.id' },
	{ schema: 'public', table: 'rsvp_records', orderBy: 't.store_key' },
	{ schema: 'public', table: 'rsvp_audit_log', orderBy: 't.audit_id' },
	{ schema: 'public', table: 'rsvp_channel_log', orderBy: 't.channel_event_id' },
	{ schema: 'public', table: 'invitation_content_drafts', orderBy: 't.id' },
	{ schema: 'public', table: 'published_invitation_content', orderBy: 't.id' },
	{ schema: 'public', table: 'invitation_publication_idempotency', orderBy: 't.idempotency_key' },
	{
		schema: 'public',
		table: 'managed_invitation_release_provenance',
		orderBy: 't.invitation_id',
	},
	{ schema: 'public', table: 'invitation_mutation_operation_receipts', orderBy: 't.id' },
	{ schema: 'public', table: 'invitation_assets', orderBy: 't.id' },
	{ schema: 'auth', table: 'users', orderBy: 't.id' },
	{ schema: 'auth', table: 'identities', orderBy: 't.id' },
	{ schema: 'storage', table: 'buckets', orderBy: 't.id' },
	{ schema: 'storage', table: 'objects', orderBy: 't.id' },
] as const;

export interface RecoveryTableFingerprint {
	rowCount: number;
	sha256: string;
}

export interface RecoveryIntegritySnapshot {
	version: 1;
	/** Omitted by legacy Phase 3 manifests. */
	profile?: RecoveryIntegrityProfile;
	capturedAt: string;
	migrationCount: number;
	/** Omitted by legacy Phase 3 manifests. */
	migrationVersions?: string[];
	migrationSha256: string;
	tables: Record<string, RecoveryTableFingerprint>;
	businessStateSha256: string;
	invariants: Record<string, number>;
}

export type RecoveryIntegrityProfile = 'phase3' | 'pre-phase3';

export interface RecoveryIntegrityComparison {
	ok: boolean;
	failures: string[];
}

/** Stable digest of recovery integrity for backup reuse (excludes capturedAt). */
export function computeRecoveryStateDigest(integrity: RecoveryIntegritySnapshot): string {
	const tables = Object.fromEntries(
		Object.keys(integrity.tables)
			.sort()
			.map((key) => [key, integrity.tables[key]]),
	);
	const invariants = Object.fromEntries(
		Object.keys(integrity.invariants)
			.sort()
			.map((key) => [key, integrity.invariants[key]]),
	);
	return createHash('sha256')
		.update(
			JSON.stringify({
				version: integrity.version,
				profile: integrity.profile ?? 'phase3',
				migrationCount: integrity.migrationCount,
				migrationVersions: [...(integrity.migrationVersions ?? [])],
				migrationSha256: integrity.migrationSha256,
				tables,
				businessStateSha256: integrity.businessStateSha256,
				invariants,
			}),
			'utf8',
		)
		.digest('hex');
}

export function wrapRecoveryIntegrityPsqlInput(sql: string): string {
	const statement = sql.trim().endsWith(';') ? sql.trim() : `${sql.trim()};`;
	return `SET statement_timeout = '0';\n${statement}\n`;
}

/** psql prints command tags such as SET even with --tuples-only. */
export function parsePsqlJsonPayload<T>(output: string, label: string): T {
	const value = output.trim();
	if (!value) throw new Error(`Recovery integrity query returned no ${label}.`);
	const jsonStart = value.search(/[[{]/);
	if (jsonStart < 0) {
		throw new Error(`Recovery integrity query returned no JSON ${label}.`);
	}
	return JSON.parse(value.slice(jsonStart)) as T;
}

function psqlCopy(dbUrl: string, sql: string): string {
	const result = runCommand(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--no-psqlrc',
			'--quiet',
			'--tuples-only',
			'--no-align',
			'--dbname',
			dbUrl,
		],
		{ input: wrapRecoveryIntegrityPsqlInput(sql), redact: [dbUrl], throwOnError: false },
	);
	if (result.status !== 0) {
		const detail = [result.stderr, result.stdout]
			.map((part) => part.trim())
			.filter(Boolean)
			.join('\n');
		throw new Error(
			`Recovery integrity query failed with process status ${String(result.status)}.${
				detail ? ` ${detail}` : ''
			}`,
		);
	}
	return result.stdout;
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

const AUTH_USERS_SOURCE = `(
			  select id, aud, role, email, email_confirmed_at, raw_app_meta_data,
			         raw_user_meta_data, is_super_admin, phone, phone_confirmed_at,
			         banned_until, deleted_at, is_sso_user, is_anonymous, created_at, updated_at
			  from auth.users
			)`;

function fingerprintSubquery(entry: (typeof CRITICAL_RECOVERY_TABLES)[number]): string {
	const { schema, table, orderBy } = entry;
	const source =
		schema === 'auth' && table === 'users'
			? AUTH_USERS_SOURCE
			: `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
	return `(select json_build_object(
		  'rowCount', count(*),
		  'sha256', encode(digest(
		    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by ${orderBy}), '') ||
		    case when count(*) > 0 then E'\\n' else '' end,
		    'sha256'
		  ), 'hex')
		) from ${source} t)`;
}

export function buildRecoveryIntegrityCaptureSql(
	profile: RecoveryIntegrityProfile = 'phase3',
): string {
	const tableEntries = CRITICAL_RECOVERY_TABLES.filter(
		({ table }) =>
			!(profile === 'pre-phase3' && table === 'invitation_mutation_operation_receipts'),
	).map((entry) => `'${entry.schema}.${entry.table}', ${fingerprintSubquery(entry)}`);
	return `select json_build_object(
	  'tables', json_build_object(${tableEntries.join(',\n	  ')}),
	  'migrationsText', coalesce((
	    select string_agg(version::text, E'\\n' order by version) || E'\\n'
	    from supabase_migrations.schema_migrations
	  ), ''),
	  'invariants', (${INVARIANT_SQL.replace(/::text\s*$/, '')}),
	  'businessState', (${businessStateSql(profile).replace(/::text\s*$/, '')})
	)::text`;
}

interface RecoveryIntegrityCapturePayload {
	tables: Record<string, RecoveryTableFingerprint>;
	migrationsText: string;
	invariants: Record<string, number>;
	businessState: unknown;
}

const INVARIANT_SQL = `
select json_build_object(
  'orphanGuests', (select count(*) from public.guest_invitations g left join public.events e on e.id = g.event_id where e.id is null),
  'orphanGuestAudit', (select count(*) from public.guest_invitation_audit a left join public.guest_invitations g on g.id = a.guest_invitation_id where g.id is null),
  'orphanMembershipEvents', (select count(*) from public.event_memberships m left join public.events e on e.id = m.event_id where e.id is null),
  'orphanMembershipUsers', (select count(*) from public.event_memberships m left join auth.users u on u.id = m.user_id where u.id is null),
  'orphanClaimCodes', (select count(*) from public.event_claim_codes c left join public.events e on e.id = c.event_id where e.id is null),
  'orphanInvitationEventLinks', (select count(*) from public.events e left join public.invitations i on i.id = e.invitation_project_id where e.invitation_project_id is not null and i.id is null),
  'orphanEventOwners', (select count(*) from public.events e left join auth.users u on u.id = e.owner_user_id where u.id is null),
  'orphanPublishedInvitations', (select count(*) from public.published_invitation_content p left join public.invitations i on i.id = p.invitation_project_id where p.invitation_project_id is not null and i.id is null),
  'orphanProvenance', (select count(*) from public.managed_invitation_release_provenance p left join public.invitations i on i.id = p.invitation_id where i.id is null),
  'orphanAssets', (select count(*) from public.invitation_assets a left join public.invitations i on i.id = a.invitation_id where i.id is null),
  'invalidAttendance', (select count(*) from public.guest_invitations where attendee_count < 0 or attendee_count > max_allowed_attendees or (attendance_status = 'confirmed' and attendee_count < 1) or (attendance_status = 'declined' and attendee_count <> 0)),
  'invalidPhone', (select count(*) from public.guest_invitations where phone is not null and phone !~ '^[0-9]{10}$'),
  'invalidCountryCode', (select count(*) from public.guest_invitations where country_code is not null and country_code !~ '^\\+[0-9]{1,4}$'),
  'duplicateInviteIds', (select count(*) from (select invite_id from public.guest_invitations group by invite_id having count(*) > 1) duplicates),
  'duplicateMemberships', (select count(*) from (select event_id, user_id from public.event_memberships group by event_id, user_id having count(*) > 1) duplicates),
  'duplicateClaimKeys', (select count(*) from (select event_id, code_key from public.event_claim_codes where deleted_at is null group by event_id, code_key having count(*) > 1) duplicates)
)::text`;

function businessStateSql(profile: RecoveryIntegrityProfile): string {
	const receiptState =
		profile === 'phase3'
			? ",\n  'receiptStatuses', (select coalesce(json_object_agg(status, total), '{}'::json) from (select status, count(*) total from public.invitation_mutation_operation_receipts group by status order by status) s)"
			: '';
	return `
select json_build_object(
  'guestStatuses', (select coalesce(json_object_agg(attendance_status, total), '{}'::json) from (select attendance_status, count(*) total from public.guest_invitations group by attendance_status order by attendance_status) s),
  'guestAttendeeTotal', (select coalesce(sum(attendee_count), 0) from public.guest_invitations),
  'guestDeliveryStates', (select coalesce(json_object_agg(delivery_status, total), '{}'::json) from (select delivery_status, count(*) total from public.guest_invitations group by delivery_status order by delivery_status) s),
  'guestTimestampState', (select json_build_object('responded', count(*) filter (where responded_at is not null), 'firstViewed', count(*) filter (where first_viewed_at is not null), 'lastViewed', count(*) filter (where last_viewed_at is not null), 'firstShared', count(*) filter (where first_shared_at is not null), 'lastReminder', count(*) filter (where last_reminder_sent_at is not null)) from public.guest_invitations),
  'guestSoftDeleted', (select count(*) from public.guest_invitations where deleted_at is not null),
  'eventSoftDeleted', (select count(*) from public.events where deleted_at is not null),
  'membershipSoftDeleted', (select count(*) from public.event_memberships where deleted_at is not null),
  'claimCodeSoftDeleted', (select count(*) from public.event_claim_codes where deleted_at is not null),
  'publishedVersions', (select coalesce(json_object_agg(event_type || '/' || slug, version), '{}'::json) from public.published_invitation_content)${receiptState}
)::text`;
}

export function captureRecoveryIntegrity(
	dbUrl: string,
	options: {
		profile?: RecoveryIntegrityProfile;
		copy?: (sql: string) => string;
	} = {},
): RecoveryIntegritySnapshot {
	const profile = options.profile ?? 'phase3';
	const copy = options.copy ?? ((sql: string) => psqlCopy(dbUrl, sql));
	const payload = parsePsqlJsonPayload<RecoveryIntegrityCapturePayload>(
		copy(buildRecoveryIntegrityCaptureSql(profile)),
		'recovery integrity snapshot',
	);
	const migrations = payload.migrationsText;
	const migrationVersions = migrations.length === 0 ? [] : migrations.trimEnd().split(/\r?\n/);
	const businessState =
		typeof payload.businessState === 'string'
			? payload.businessState
			: JSON.stringify(payload.businessState);
	return {
		version: 1,
		profile,
		capturedAt: new Date().toISOString(),
		migrationCount: migrationVersions.length,
		migrationVersions,
		migrationSha256: sha256(migrations),
		tables: payload.tables,
		businessStateSha256: sha256(businessState),
		invariants: payload.invariants,
	};
}

export function compareRecoveryIntegrity(
	expected: RecoveryIntegritySnapshot,
	actual: RecoveryIntegritySnapshot,
	options: { requireValidInvariants?: boolean } = {},
): RecoveryIntegrityComparison {
	const failures: string[] = [];
	const expectedProfile = expected.profile ?? 'phase3';
	const actualProfile = actual.profile ?? 'phase3';
	if (actualProfile !== expectedProfile)
		failures.push(
			`Recovery integrity profile mismatch: expected ${expectedProfile}, got ${actualProfile}.`,
		);
	if (actual.migrationCount !== expected.migrationCount)
		failures.push(
			`Migration count mismatch: expected ${expected.migrationCount}, got ${actual.migrationCount}.`,
		);
	if (actual.migrationSha256 !== expected.migrationSha256)
		failures.push('Migration checksum mismatch.');
	for (const [name, expectedTable] of Object.entries(expected.tables)) {
		const actualTable = actual.tables[name];
		if (!actualTable) {
			failures.push(`Missing recovered table fingerprint: ${name}.`);
			continue;
		}
		if (actualTable.rowCount !== expectedTable.rowCount)
			failures.push(
				`${name} row-count mismatch: expected ${expectedTable.rowCount}, got ${actualTable.rowCount}.`,
			);
		if (actualTable.sha256 !== expectedTable.sha256)
			failures.push(`${name} checksum mismatch.`);
	}
	if (actual.businessStateSha256 !== expected.businessStateSha256)
		failures.push('RSVP/publication/receipt business-state checksum mismatch.');
	for (const [name, expectedCount] of Object.entries(expected.invariants)) {
		const actualCount = actual.invariants[name];
		if (actualCount !== expectedCount)
			failures.push(
				`Invariant ${name} mismatch: expected ${expectedCount}, got ${String(actualCount)}.`,
			);
		if (options.requireValidInvariants !== false && actualCount !== 0)
			failures.push(`Invariant ${name} failed with ${actualCount} violation(s).`);
	}
	return { ok: failures.length === 0, failures };
}
