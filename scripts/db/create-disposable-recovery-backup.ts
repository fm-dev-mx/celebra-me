import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	createArtifactManifest,
	validateCriticalBackupManifest,
	type CriticalBackupManifest,
} from './backup-manifest.ts';
import { classifyDbTarget, DISPOSABLE_DB_URL } from './db-target-config.ts';
import { captureRecoveryIntegrity } from './recovery-integrity.ts';
import {
	createStorageObjectArchiveEntry,
	writeStorageObjectArchive,
	type StorageObjectArchive,
} from './storage-object-archive.ts';
import { runCommand, sqlLiteral, timestamp } from './db-workflow-lib.ts';

const values = new Map(
	process.argv.slice(2).map((argument) => {
		const [key, ...rest] = argument.replace(/^--/, '').split('=');
		return [key, rest.join('=')];
	}),
);
const sourceDbUrl = values.get('source-db-url') ?? DISPOSABLE_DB_URL;
const outputDir = resolve(values.get('output-dir') ?? `.tmp/recovery-drill/backup-${timestamp()}`);
const integrityProfileValue = values.get('integrity-profile') ?? 'phase3';
if (integrityProfileValue !== 'phase3' && integrityProfileValue !== 'pre-phase3') {
	throw new Error('Synthetic recovery backup integrity profile is unsupported.');
}
const integrityProfile = integrityProfileValue;
const sourceTarget = classifyDbTarget(sourceDbUrl);
if (sourceTarget.target !== 'disposable-test') {
	throw new Error(
		`Synthetic recovery backup source must be disposable-test, got ${sourceTarget.target}.`,
	);
}

const objectContent = Buffer.from(
	'Synthetic critical invitation Storage object used only by the disposable recovery drill.\n'.repeat(
		64,
	),
	'utf8',
);
const objectHash = createHash('sha256').update(objectContent).digest('hex');
const objectPath = 'f0000000-0000-0000-0000-000000000001/hero.webp';

const phase3ReceiptFixtureSql =
	integrityProfile === 'phase3'
		? `
insert into public.invitation_mutation_operation_receipts (id, operation_id, invitation_id, environment, project_ref, actor_id, actor_type, origin, command_kind, input_hashes, expected_state, status, completed_steps, result, sanitized_error, created_at)
values ('83000000-0000-0000-0000-000000000001', '83100000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'production', ${sqlLiteral(SUPABASE_PROJECT_REFS.production)}, null, 'system', 'recovery', 'recovery_fixture', '{"input":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'::jsonb, '{"revision":"fixture"}'::jsonb, 'partial', array['database'], '{"recoverable":true}'::jsonb, '{"code":"STORAGE_PENDING"}'::jsonb, '2026-07-29T12:08:00Z')
on conflict do nothing;

insert into public.invitation_mutation_operation_receipts (id, operation_id, invitation_id, environment, project_ref, actor_id, actor_type, origin, command_kind, input_hashes, expected_state, status, completed_steps, result, sanitized_error, retry_of_operation_id, created_at)
values ('83000000-0000-0000-0000-000000000002', '83100000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'production', ${sqlLiteral(SUPABASE_PROJECT_REFS.production)}, null, 'system', 'recovery', 'recovery_fixture', '{"input":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'::jsonb, '{"revision":"fixture"}'::jsonb, 'replayed', array['database','storage'], '{"recovered":true}'::jsonb, '{}'::jsonb, '83100000-0000-0000-0000-000000000001', '2026-07-29T12:09:00Z')
on conflict do nothing;
`
		: '';

const provenanceFixtureSql =
	integrityProfile === 'phase3'
		? `
insert into public.managed_invitation_release_provenance (invitation_id, definition_slug, release_schema_version, source_hash, package_hash, metadata_hash, projection_hash, asset_manifest_hash, applied_at, managed_projection, applied_draft_updated_at, applied_operation_id)
select 'f0000000-0000-0000-0000-000000000002', 'fixture-definition', '1', repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64), repeat('e', 64), '2026-07-29T12:09:00Z', content, updated_at, '83100000-0000-0000-0000-000000000002'
from public.invitation_content_drafts where id = 'c0000000-0000-0000-0000-000000000002'
on conflict (invitation_id) do update set applied_at = excluded.applied_at;
`
		: `
insert into public.managed_invitation_release_provenance (invitation_id, definition_slug, release_schema_version, source_hash, package_hash, metadata_hash, projection_hash, asset_manifest_hash, applied_at, managed_projection)
select 'f0000000-0000-0000-0000-000000000002', 'fixture-definition', '1', repeat('a', 64), repeat('b', 64), repeat('c', 64), repeat('d', 64), repeat('e', 64), '2026-07-29T12:09:00Z', content
from public.invitation_content_drafts where id = 'c0000000-0000-0000-0000-000000000002'
on conflict (invitation_id) do update set applied_at = excluded.applied_at;
`;

const fixtureSql = `
update public.guest_invitations
set first_viewed_at = '2026-07-29T12:00:00Z',
    last_viewed_at = '2026-07-29T12:05:00Z',
    responded_at = '2026-07-29T12:06:00Z',
    first_shared_at = '2026-07-28T20:00:00Z',
    last_reminder_sent_at = '2026-07-29T10:00:00Z'
where id = '90000000-0000-0000-0000-000000000001';

insert into public.event_memberships (id, event_id, user_id, membership_role, created_at, updated_at)
values ('81000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'owner', '2026-07-29T12:00:00Z', '2026-07-29T12:00:00Z')
on conflict (event_id, user_id) do nothing;

insert into public.event_claim_codes (id, event_id, code_hash, active, expires_at, max_uses, used_count, created_by, created_at, updated_at, code_key)
values ('82000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', repeat('c', 64), true, '2027-07-29T12:00:00Z', 10, 2, 'a0000000-0000-0000-0000-000000000002', '2026-07-29T12:00:00Z', '2026-07-29T12:00:00Z', 'fixture-key')
on conflict do nothing;

insert into public.guest_invitations (id, invite_id, event_id, full_name, phone, country_code, max_allowed_attendees, attendance_status, attendee_count, guest_comment, delivery_status, responded_at, deleted_at, short_id, entry_source, view_percentage, is_viewed, hide_celebra_me_branding)
values ('90000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'Invitado eliminado', '6681167479', '+52', 1, 'declined', 0, '', 'generated', '2026-07-27T12:00:00Z', '2026-07-28T12:00:00Z', 'DELETED1', 'dashboard', 100, true, false)
on conflict (id) do nothing;

insert into public.guest_invitation_audit (id, guest_invitation_id, actor_type, event_type, payload, created_at)
values ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', 'system', 'status_changed', '{"attendance_status":"declined","attendee_count":0}'::jsonb, '2026-07-27T12:00:00Z')
on conflict (id) do nothing;

insert into public.rsvp_records (store_key, rsvp_id, event_slug, guest_id, guest_name_entered, attendance_status, attendee_count, notes, dietary, source, created_at, last_updated_at, normalized_guest_name, is_potential_duplicate)
values ('fixture:rsvp:1', 'fixture-rsvp-1', 'test-client-wedding', '90000000-0000-0000-0000-000000000001', 'Invitado sintético', 'confirmed', 3, 'Nota', 'Ninguna', 'personalized_link', '2026-07-29T12:00:00Z', '2026-07-29T12:06:00Z', 'invitado sintetico', false)
on conflict (store_key) do nothing;

insert into public.rsvp_audit_log (audit_id, rsvp_id, previous_status, new_status, previous_attendee_count, new_attendee_count, changed_by, changed_at)
values ('fixture-audit-1', 'fixture-rsvp-1', 'pending', 'confirmed', 0, 3, 'guest', '2026-07-29T12:06:00Z')
on conflict (audit_id) do nothing;

insert into public.rsvp_channel_log (channel_event_id, rsvp_id, channel, action, occurred_at)
values ('fixture-channel-1', 'fixture-rsvp-1', 'whatsapp', 'clicked', '2026-07-29T12:07:00Z')
on conflict (channel_event_id) do nothing;

${phase3ReceiptFixtureSql}
${provenanceFixtureSql}

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values ('84000000-0000-0000-0000-000000000001', 'test-client@celebra-me.test', 'a0000000-0000-0000-0000-000000000002', '{"sub":"a0000000-0000-0000-0000-000000000002","email":"test-client@celebra-me.test"}'::jsonb, 'email', '2026-07-29T12:00:00Z', '2026-07-29T12:00:00Z', '2026-07-29T12:00:00Z')
on conflict (id) do nothing;

insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata)
values ('85000000-0000-0000-0000-000000000001', 'invitation-assets', ${sqlLiteral(objectPath)}, 'a0000000-0000-0000-0000-000000000001', '2026-07-29T12:00:00Z', '2026-07-29T12:00:00Z', '2026-07-29T12:00:00Z', jsonb_build_object('size', ${objectContent.byteLength}, 'mimetype', 'image/webp'), 'fixture-v1', 'a0000000-0000-0000-0000-000000000001', '{}'::jsonb)
on conflict (bucket_id, name) do update set metadata = excluded.metadata, version = excluded.version;

update public.invitation_assets
set file_size = ${objectContent.byteLength}, sha256 = ${sqlLiteral(objectHash)}, updated_at = '2026-07-29T12:00:00Z'
where id = 'b0000000-0000-0000-0000-000000000001';
`;

function runPsql(sqlOrFile: string, isFile = false): void {
	const args = ['--set', 'ON_ERROR_STOP=1', '--no-psqlrc', '--dbname', sourceDbUrl];
	if (isFile) args.push('--file', sqlOrFile);
	const result = runCommand('psql', args, {
		input: isFile ? undefined : sqlOrFile,
		redact: [sourceDbUrl],
	});
	if (result.status !== 0) throw new Error('Disposable recovery fixture SQL failed.');
}

mkdirSync(outputDir, { recursive: true });
const resetArgs = ['-y', 'tsx', 'scripts/db/disposable-test-env.ts', 'reset'];
if (integrityProfile === 'pre-phase3') resetArgs.push('--max-version=20260727180000');
runCommand('npx', resetArgs);
runPsql(fixtureSql);

const databasePath = resolve(outputDir, 'database.sql');
const authPath = resolve(outputDir, 'auth.sql');
const storageMetadataPath = resolve(outputDir, 'storage-metadata.sql');
const storageObjectsPath = resolve(outputDir, 'storage-objects.json');
const manifestPath = resolve(outputDir, 'manifest.json');

for (const [path, pgDumpArgs] of [
	[databasePath, ['--data-only', '--schema', 'public']],
	[authPath, ['--data-only', '--table', 'auth.users', '--table', 'auth.identities']],
	[
		storageMetadataPath,
		['--data-only', '--table', 'storage.buckets', '--table', 'storage.objects'],
	],
] as const) {
	runCommand(
		'pg_dump',
		[...pgDumpArgs, '--no-owner', '--no-privileges', '--file', path, '--dbname', sourceDbUrl],
		{ redact: [sourceDbUrl] },
	);
}

const storageArchive: StorageObjectArchive = {
	version: 1,
	createdAt: new Date().toISOString(),
	objects: [
		createStorageObjectArchiveEntry(
			'invitation-assets',
			objectPath,
			objectContent,
			'image/webp',
		),
	],
};
writeStorageObjectArchive(storageObjectsPath, storageArchive);

const integrity = captureRecoveryIntegrity(sourceDbUrl, { profile: integrityProfile });
const manifest: CriticalBackupManifest = {
	version: 1,
	createdAt: new Date().toISOString(),
	environment: 'disposable-test',
	projectRef: SUPABASE_PROJECT_REFS.production,
	sourceEnvironment: 'disposable-test',
	artifacts: [
		createArtifactManifest('database', databasePath),
		createArtifactManifest('auth', authPath),
		createArtifactManifest('storage-metadata', storageMetadataPath),
		createArtifactManifest('storage-objects', storageObjectsPath),
	],
	integrity,
};
validateCriticalBackupManifest(manifest, { allowDisposableTest: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

console.info('Synthetic critical backup set created and verified.');
console.info(`- Manifest: ${manifestPath}`);
console.info(`- Critical tables: ${Object.keys(integrity.tables).length}`);
console.info(`- Storage objects: ${storageArchive.objects.length}`);
console.info(`- Integrity profile: ${integrity.profile}`);
