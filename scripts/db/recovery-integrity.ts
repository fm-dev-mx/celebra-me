import { createHash } from 'node:crypto';
import { quoteIdentifier, runCommand } from './db-workflow-lib.ts';

export const CRITICAL_RECOVERY_TABLES = [
	{ schema: 'public', table: 'invitations' },
	{ schema: 'public', table: 'events' },
	{ schema: 'public', table: 'event_memberships' },
	{ schema: 'public', table: 'event_claim_codes' },
	{ schema: 'public', table: 'guest_invitations' },
	{ schema: 'public', table: 'guest_invitation_audit' },
	{ schema: 'public', table: 'rsvp_records' },
	{ schema: 'public', table: 'rsvp_audit_log' },
	{ schema: 'public', table: 'rsvp_channel_log' },
	{ schema: 'public', table: 'invitation_content_drafts' },
	{ schema: 'public', table: 'published_invitation_content' },
	{ schema: 'public', table: 'invitation_publication_idempotency' },
	{ schema: 'public', table: 'managed_invitation_release_provenance' },
	{ schema: 'public', table: 'invitation_mutation_operation_receipts' },
	{ schema: 'public', table: 'invitation_assets' },
	{ schema: 'auth', table: 'users' },
	{ schema: 'auth', table: 'identities' },
	{ schema: 'storage', table: 'buckets' },
	{ schema: 'storage', table: 'objects' },
] as const;

export interface RecoveryTableFingerprint {
	rowCount: number;
	sha256: string;
}

export interface RecoveryIntegritySnapshot {
	version: 1;
	capturedAt: string;
	migrationCount: number;
	migrationSha256: string;
	tables: Record<string, RecoveryTableFingerprint>;
	businessStateSha256: string;
	invariants: Record<string, number>;
}

export interface RecoveryIntegrityComparison {
	ok: boolean;
	failures: string[];
}

function psqlCopy(dbUrl: string, sql: string): string {
	const result = runCommand(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--no-psqlrc',
			'--dbname',
			dbUrl,
			'--command',
			`COPY (${sql}) TO STDOUT`,
		],
		{ redact: [dbUrl] },
	);
	return result.stdout;
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function parseSingleJson<T>(output: string, label: string): T {
	const value = output.trim();
	if (!value) throw new Error(`Recovery integrity query returned no ${label}.`);
	return JSON.parse(value) as T;
}

function getPrimaryKeyOrder(dbUrl: string, schema: string, table: string): string {
	const output = psqlCopy(
		dbUrl,
		`select coalesce(string_agg(format('t.%I', a.attname), ', ' order by key_columns.ordinality), '')
		 from pg_index i
		 join pg_class c on c.oid = i.indrelid
		 join pg_namespace n on n.oid = c.relnamespace
		 cross join lateral unnest(i.indkey) with ordinality as key_columns(attnum, ordinality)
		 join pg_attribute a on a.attrelid = c.oid and a.attnum = key_columns.attnum
		 where i.indisprimary and n.nspname = ${sqlLiteral(schema)} and c.relname = ${sqlLiteral(table)}`,
	).trim();
	return output || 'row_to_json(t)::text';
}

function sqlLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function fingerprintTable(dbUrl: string, schema: string, table: string): RecoveryTableFingerprint {
	const qualified = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
	if (schema === 'auth' && table === 'users') {
		const output = psqlCopy(
			dbUrl,
			`select row_to_json(t)::text from (
			  select id, aud, role, email, email_confirmed_at, raw_app_meta_data,
			         raw_user_meta_data, is_super_admin, phone, phone_confirmed_at,
			         banned_until, deleted_at, is_sso_user, is_anonymous, created_at, updated_at
			  from auth.users order by id
			) t`,
		);
		const rows = output.length === 0 ? [] : output.trimEnd().split(/\r?\n/);
		return { rowCount: rows.length, sha256: sha256(output) };
	}
	const orderBy = getPrimaryKeyOrder(dbUrl, schema, table);
	const output = psqlCopy(
		dbUrl,
		`select row_to_json(t)::text from ${qualified} t order by ${orderBy}`,
	);
	const rows = output.length === 0 ? [] : output.trimEnd().split(/\r?\n/);
	return { rowCount: rows.length, sha256: sha256(output) };
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

const BUSINESS_STATE_SQL = `
select json_build_object(
  'guestStatuses', (select coalesce(json_object_agg(attendance_status, total), '{}'::json) from (select attendance_status, count(*) total from public.guest_invitations group by attendance_status order by attendance_status) s),
  'guestAttendeeTotal', (select coalesce(sum(attendee_count), 0) from public.guest_invitations),
  'guestDeliveryStates', (select coalesce(json_object_agg(delivery_status, total), '{}'::json) from (select delivery_status, count(*) total from public.guest_invitations group by delivery_status order by delivery_status) s),
  'guestTimestampState', (select json_build_object('responded', count(*) filter (where responded_at is not null), 'firstViewed', count(*) filter (where first_viewed_at is not null), 'lastViewed', count(*) filter (where last_viewed_at is not null), 'firstShared', count(*) filter (where first_shared_at is not null), 'lastReminder', count(*) filter (where last_reminder_sent_at is not null)) from public.guest_invitations),
  'guestSoftDeleted', (select count(*) from public.guest_invitations where deleted_at is not null),
  'eventSoftDeleted', (select count(*) from public.events where deleted_at is not null),
  'membershipSoftDeleted', (select count(*) from public.event_memberships where deleted_at is not null),
  'claimCodeSoftDeleted', (select count(*) from public.event_claim_codes where deleted_at is not null),
  'publishedVersions', (select coalesce(json_object_agg(event_type || '/' || slug, version), '{}'::json) from public.published_invitation_content),
  'receiptStatuses', (select coalesce(json_object_agg(status, total), '{}'::json) from (select status, count(*) total from public.invitation_mutation_operation_receipts group by status order by status) s)
)::text`;

export function captureRecoveryIntegrity(dbUrl: string): RecoveryIntegritySnapshot {
	const tables: Record<string, RecoveryTableFingerprint> = {};
	for (const { schema, table } of CRITICAL_RECOVERY_TABLES) {
		tables[`${schema}.${table}`] = fingerprintTable(dbUrl, schema, table);
	}
	const migrations = psqlCopy(
		dbUrl,
		'select version::text from supabase_migrations.schema_migrations order by version',
	);
	const invariants = parseSingleJson<Record<string, number>>(
		psqlCopy(dbUrl, INVARIANT_SQL),
		'invariant evidence',
	);
	const businessState = psqlCopy(dbUrl, BUSINESS_STATE_SQL);
	return {
		version: 1,
		capturedAt: new Date().toISOString(),
		migrationCount: migrations.length === 0 ? 0 : migrations.trimEnd().split(/\r?\n/).length,
		migrationSha256: sha256(migrations),
		tables,
		businessStateSha256: sha256(businessState),
		invariants,
	};
}

export function compareRecoveryIntegrity(
	expected: RecoveryIntegritySnapshot,
	actual: RecoveryIntegritySnapshot,
	options: { requireValidInvariants?: boolean } = {},
): RecoveryIntegrityComparison {
	const failures: string[] = [];
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
