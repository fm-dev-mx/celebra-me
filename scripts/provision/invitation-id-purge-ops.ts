/**
 * invitation-id-purge-ops.ts — DB queries, storage operations, and audit helpers for ID purge.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';
import type {
	DependencyCounts,
	GuestMigrationCandidate,
	InvitationIdPurgeAudit,
	InvitationIdPurgeInput,
	InvitationRecordSummary,
	MigrationAssessment,
} from './invitation-id-purge.ts';

function parseJsonObject<T>(raw: string, label: string): T {
	const text = raw.trim();
	if (!text) throw new Error(`PURGE_AUDIT_EMPTY: Expected JSON for ${label}.`);
	try {
		return JSON.parse(text) as T;
	} catch (error) {
		throw new Error(
			`PURGE_AUDIT_PARSE_FAILED: ${label}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

const EXCLUDED_LIFECYCLE = new Set(['draft', 'in_progress']);

function classifyGuest(
	fullName: string,
	hasEmail: boolean,
	hasPhone: boolean,
): GuestMigrationCandidate['classification'] {
	const synthetic = /^test\d*$/iu.test(fullName.trim());
	if (synthetic && !hasEmail && !hasPhone) return 'synthetic_test';
	return 'requires_migration_review';
}

interface LoadedAuditPayload {
	incorrect: InvitationRecordSummary;
	canonical: InvitationRecordSummary;
	incorrectDependencies: DependencyCounts;
	canonicalDependencies: DependencyCounts;
	guests: Array<{
		id: string;
		fullName: string;
		hasEmail: boolean;
		hasPhone: boolean;
		attendanceStatus: string | null;
	}>;
	storageAssetPaths: string[];
}

export function loadAuditPayload(
	dbUrl: string,
	incorrectId: string,
	canonicalId: string,
): LoadedAuditPayload {
	const sql = `
select coalesce((
  select jsonb_build_object(
    'incorrect', (
      select jsonb_build_object(
        'id', i.id::text,
        'slug', i.slug,
        'title', i.title,
        'status', i.status,
        'kind', i.kind,
        'eventType', i.event_type,
        'archivedAt', i.archived_at,
        'createdAt', i.created_at,
        'updatedAt', i.updated_at,
        'clientName', i.client_name,
        'environment', 'preview'
      )
      from public.invitations i
      where i.id = ${sqlLiteral(incorrectId)}::uuid
    ),
    'canonical', (
      select jsonb_build_object(
        'id', i.id::text,
        'slug', i.slug,
        'title', i.title,
        'status', i.status,
        'kind', i.kind,
        'eventType', i.event_type,
        'archivedAt', i.archived_at,
        'createdAt', i.created_at,
        'updatedAt', i.updated_at,
        'clientName', i.client_name,
        'environment', 'preview'
      )
      from public.invitations i
      where i.id = ${sqlLiteral(canonicalId)}::uuid
    ),
    'incorrectDependencies', (
      select jsonb_build_object(
        'events', (select count(*)::int from public.events e where e.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
        'drafts', (select count(*)::int from public.invitation_content_drafts d where d.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
        'published', (select count(*)::int from public.published_invitation_content p where p.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
        'assets', (select count(*)::int from public.invitation_assets a where a.invitation_id = ${sqlLiteral(incorrectId)}::uuid),
        'assetsActive', (select count(*)::int from public.invitation_assets a where a.invitation_id = ${sqlLiteral(incorrectId)}::uuid and a.deleted_at is null),
        'provenance', (select count(*)::int from public.managed_invitation_release_provenance p where p.invitation_id = ${sqlLiteral(incorrectId)}::uuid),
        'publicationIdempotency', (select count(*)::int from public.invitation_publication_idempotency i where i.invitation_id = ${sqlLiteral(incorrectId)}::uuid),
        'mutationReceipts', (select count(*)::int from public.invitation_mutation_operation_receipts r where r.invitation_id = ${sqlLiteral(incorrectId)}::uuid),
        'legacyAdoption', (select count(*)::int from public.managed_invitation_legacy_adoption_receipts r where r.invitation_id = ${sqlLiteral(incorrectId)}::uuid),
        'intakeRequests', (select count(*)::int from public.intake_requests ir where ir.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
        'intakeSubmissions', (select count(*)::int from public.intake_submissions s where s.intake_request_id in (select ir.id from public.intake_requests ir where ir.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid)),
        'sourcedInvitations', (select count(*)::int from public.invitations i where i.source_invitation_id = ${sqlLiteral(incorrectId)}::uuid),
        'guests', (select count(*)::int from public.guest_invitations g join public.events e on e.id = g.event_id where e.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
        'claimCodes', (select count(*)::int from public.event_claim_codes c join public.events e on e.id = c.event_id where e.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
        'memberships', (select count(*)::int from public.event_memberships m join public.events e on e.id = m.event_id where e.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
        'guestAudit', (select count(*)::int from public.guest_invitation_audit a join public.guest_invitations g on g.id = a.guest_invitation_id join public.events e on e.id = g.event_id where e.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid)
      )
    ),
    'canonicalDependencies', (
      select jsonb_build_object(
        'events', (select count(*)::int from public.events e where e.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid),
        'drafts', (select count(*)::int from public.invitation_content_drafts d where d.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid),
        'published', (select count(*)::int from public.published_invitation_content p where p.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid),
        'assets', (select count(*)::int from public.invitation_assets a where a.invitation_id = ${sqlLiteral(canonicalId)}::uuid),
        'assetsActive', (select count(*)::int from public.invitation_assets a where a.invitation_id = ${sqlLiteral(canonicalId)}::uuid and a.deleted_at is null),
        'provenance', (select count(*)::int from public.managed_invitation_release_provenance p where p.invitation_id = ${sqlLiteral(canonicalId)}::uuid),
        'publicationIdempotency', (select count(*)::int from public.invitation_publication_idempotency i where i.invitation_id = ${sqlLiteral(canonicalId)}::uuid),
        'mutationReceipts', (select count(*)::int from public.invitation_mutation_operation_receipts r where r.invitation_id = ${sqlLiteral(canonicalId)}::uuid),
        'legacyAdoption', (select count(*)::int from public.managed_invitation_legacy_adoption_receipts r where r.invitation_id = ${sqlLiteral(canonicalId)}::uuid),
        'intakeRequests', (select count(*)::int from public.intake_requests ir where ir.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid),
        'intakeSubmissions', (select count(*)::int from public.intake_submissions s where s.intake_request_id in (select ir.id from public.intake_requests ir where ir.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid)),
        'sourcedInvitations', (select count(*)::int from public.invitations i where i.source_invitation_id = ${sqlLiteral(canonicalId)}::uuid),
        'guests', (select count(*)::int from public.guest_invitations g join public.events e on e.id = g.event_id where e.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid),
        'claimCodes', (select count(*)::int from public.event_claim_codes c join public.events e on e.id = c.event_id where e.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid),
        'memberships', (select count(*)::int from public.event_memberships m join public.events e on e.id = m.event_id where e.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid),
        'guestAudit', (select count(*)::int from public.guest_invitation_audit a join public.guest_invitations g on g.id = a.guest_invitation_id join public.events e on e.id = g.event_id where e.invitation_project_id = ${sqlLiteral(canonicalId)}::uuid)
      )
    ),
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id::text,
        'fullName', g.full_name,
        'hasEmail', g.email is not null and length(trim(g.email)) > 0,
        'hasPhone', g.phone is not null and length(trim(g.phone)) > 0,
        'attendanceStatus', g.attendance_status
      ) order by g.created_at)
      from public.guest_invitations g
      join public.events e on e.id = g.event_id
      where e.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid
    ), '[]'::jsonb),
    'storageAssetPaths', coalesce((
      select jsonb_agg(a.storage_path order by a.storage_path)
      from public.invitation_assets a
      where a.invitation_id = ${sqlLiteral(incorrectId)}::uuid
        and a.storage_path is not null
    ), '[]'::jsonb)
  )
), '{}'::jsonb);
`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	const payload = parseJsonObject<Partial<LoadedAuditPayload>>(result.stdout, 'audit payload');
	if (!payload.incorrect || !payload.canonical) {
		throw new Error(
			'INVITATION_IDENTITY_AMBIGUOUS: Both incorrect and canonical invitation IDs must resolve to exactly one row each.',
		);
	}
	return {
		incorrect: payload.incorrect,
		canonical: payload.canonical,
		incorrectDependencies: payload.incorrectDependencies as DependencyCounts,
		canonicalDependencies: payload.canonicalDependencies as DependencyCounts,
		guests: payload.guests ?? [],
		storageAssetPaths: payload.storageAssetPaths ?? [],
	};
}

export function assessMigration(
	guests: LoadedAuditPayload['guests'],
	deps: DependencyCounts,
): MigrationAssessment {
	const guestCandidates = guests.map((guest) => ({
		id: guest.id,
		fullName: guest.fullName,
		hasEmail: guest.hasEmail,
		hasPhone: guest.hasPhone,
		attendanceStatus: guest.attendanceStatus,
		classification: classifyGuest(guest.fullName, guest.hasEmail, guest.hasPhone),
	}));
	const notes: string[] = [];
	const reviewGuests = guestCandidates.filter((g) => g.classification === 'requires_migration_review');
	if (deps.claimCodes > 0) {
		notes.push('Exclusive access/claim codes exist on the incorrect invitation.');
	}
	if (reviewGuests.length > 0) {
		notes.push('Non-synthetic guest rows require explicit migration review before delete.');
	}
	if (guestCandidates.some((g) => g.classification === 'synthetic_test')) {
		notes.push('Synthetic dashboard test guests are exclusive disposable fixtures; migration not required.');
	}
	if (deps.memberships > 0) {
		notes.push('Exclusive event memberships will be removed with the incorrect event (canonical host already exists).');
	}
	const required = reviewGuests.length > 0 || deps.claimCodes > 0;
	return {
		required,
		blockReason: required
			? 'MIGRATION_REQUIRED: Exclusive dependent data may be valuable and must be migrated or explicitly dispositioned before delete.'
			: null,
		guestCandidates,
		notes,
	};
}

export function buildDeletePlan(
	deps: DependencyCounts,
	storageAssetPaths: string[],
): InvitationIdPurgeAudit['deletePlan'] {
	return {
		tables: [
			{
				table: 'invitation_publication_idempotency',
				action: 'delete',
				count: deps.publicationIdempotency,
				reason: 'ON DELETE RESTRICT — must remove before invitation/draft hard delete',
			},
			{
				table: 'managed_invitation_legacy_adoption_receipts',
				action: 'delete',
				count: deps.legacyAdoption,
				reason: 'ON DELETE RESTRICT — exclusive receipt rows if present',
			},
			{
				table: 'published_invitation_content',
				action: 'delete',
				count: deps.published,
				reason: 'NO ACTION FK — explicit delete required',
			},
			{
				table: 'events',
				action: 'delete',
				count: deps.events,
				reason: 'Cascades guests, memberships, claim codes, guest audit',
			},
			{
				table: 'invitations',
				action: 'delete',
				count: 1,
				reason: 'Cascades drafts, assets, provenance, intake requests',
			},
		],
		storageAssetPaths,
	};
}

export function writeAuditArtifact(audit: InvitationIdPurgeAudit, auditDir: string): string {
	mkdirSync(auditDir, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	const path = join(auditDir, `invitation-id-purge-${stamp}.json`);
	writeFileSync(path, JSON.stringify(audit, null, 2), 'utf8');
	return path;
}

export async function removePreviewStorageObjects(
	paths: string[],
	env: NodeJS.ProcessEnv = process.env,
): Promise<NonNullable<InvitationIdPurgeAudit['storageCleanup']>> {
	const attempted = [...paths];
	const removed: string[] = [];
	const alreadyAbsent: string[] = [];
	const failed: Array<{ path: string; error: string }> = [];

	if (paths.length === 0) {
		return { attempted, removed, alreadyAbsent, failed };
	}

	const supabaseUrl = (
		env.PREVIEW_SUPABASE_URL?.trim() ||
		getSecretFromEnvOrFiles('PREVIEW_SUPABASE_URL', PREVIEW_SECRET_FILES) ||
		getSecretFromEnvOrFiles('SUPABASE_URL', PREVIEW_SECRET_FILES)
	).trim();
	const serviceRoleKey = (
		env.PREVIEW_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
		getSecretFromEnvOrFiles('PREVIEW_SUPABASE_SERVICE_ROLE_KEY', PREVIEW_SECRET_FILES) ||
		getSecretFromEnvOrFiles('SUPABASE_SERVICE_ROLE_KEY', PREVIEW_SECRET_FILES)
	).trim();

	if (!supabaseUrl || !serviceRoleKey) {
		for (const path of paths) {
			failed.push({
				path,
				error: 'PREVIEW_STORAGE_CREDENTIALS_MISSING',
			});
		}
		return { attempted, removed, alreadyAbsent, failed };
	}

	const { createClient } = await import('@supabase/supabase-js');
	const client = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false },
	});
	const bucket = client.storage.from('invitation-assets');

	for (const path of paths) {
		try {
			const res = await bucket.remove([path]);
			if (res.error) {
				failed.push({ path, error: res.error.message });
			} else if (res.data && res.data.length > 0) {
				removed.push(path);
			} else {
				alreadyAbsent.push(path);
			}
		} catch (error) {
			failed.push({ path, error: error instanceof Error ? error.message : String(error) });
		}
	}

	return { attempted, removed, alreadyAbsent, failed };
}

export function assertStorageOwnership(paths: string[], expectedSlug: string): string[] {
	const prefix = `managed/${expectedSlug}/`;
	const foreign: string[] = [];
	for (const path of paths) {
		if (!path.startsWith(prefix)) {
			foreign.push(path);
		}
	}
	return foreign;
}

export function loadAssetHashes(dbUrl: string, invitationId: string): string[] {
	const sql = `
select coalesce(jsonb_agg(sha256 order by sha256), '[]'::jsonb)::text
from public.invitation_assets
where invitation_id = ${sqlLiteral(invitationId)}::uuid
  and deleted_at is null
  and sha256 is not null;
`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	return parseJsonObject<string[]>(result.stdout, 'asset hashes');
}

export function assessAssetHashEquivalence(
	incorrectHashes: string[],
	canonicalHashes: string[],
): NonNullable<InvitationIdPurgeAudit['assetHashEquivalence']> {
	const canonicalSet = new Set(canonicalHashes);
	const missingOnCanonical = incorrectHashes.filter((hash) => !canonicalSet.has(hash));
	return {
		ok: missingOnCanonical.length === 0,
		incorrectHashes,
		canonicalHashes,
		missingOnCanonical,
	};
}

export function executeDeleteTransaction(
	dbUrl: string,
	incorrectId: string,
	canonicalId: string,
	expectIncorrectSlug: string,
	expectCanonicalSlug: string,
): { ok: true } | { ok: false; error: string } {
	const sql = `
begin;

do $$
declare
  v_incorrect public.invitations%rowtype;
  v_canonical public.invitations%rowtype;
begin
  select * into v_incorrect
  from public.invitations
  where id = ${sqlLiteral(incorrectId)}::uuid
  for update;
  if not found then raise exception 'INCORRECT_NOT_FOUND'; end if;
  if v_incorrect.slug is distinct from ${sqlLiteral(expectIncorrectSlug)} then
    raise exception 'INCORRECT_SLUG_MISMATCH';
  end if;

  select * into v_canonical
  from public.invitations
  where id = ${sqlLiteral(canonicalId)}::uuid
  for update;
  if not found then raise exception 'CANONICAL_NOT_FOUND'; end if;
  if v_canonical.slug is distinct from ${sqlLiteral(expectCanonicalSlug)} then
    raise exception 'CANONICAL_SLUG_MISMATCH';
  end if;
  if v_incorrect.id = v_canonical.id then raise exception 'IDS_COLLIDE'; end if;

  if exists (
    select 1
    from public.event_claim_codes c
    join public.events e on e.id = c.event_id
    where e.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid
  ) then
    raise exception 'CLAIM_CODES_PRESENT';
  end if;
  if exists (
    select 1
    from public.guest_invitations g
    join public.events e on e.id = g.event_id
    where e.invitation_project_id = ${sqlLiteral(incorrectId)}::uuid
      and (
        (g.email is not null and length(trim(g.email)) > 0)
        or (g.phone is not null and length(trim(g.phone)) > 0)
        or g.full_name !~* '^test[0-9]*$'
      )
  ) then
    raise exception 'NON_SYNTHETIC_GUESTS_PRESENT';
  end if;
end $$;

delete from public.invitation_publication_idempotency
where invitation_id = ${sqlLiteral(incorrectId)}::uuid;

delete from public.managed_invitation_legacy_adoption_receipts
where invitation_id = ${sqlLiteral(incorrectId)}::uuid;

delete from public.published_invitation_content
where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid;

delete from public.events
where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid;

delete from public.invitations
where id = ${sqlLiteral(incorrectId)}::uuid;

commit;
`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: false });
	if (result.status !== 0) {
		return { ok: false, error: result.stderr.trim() || result.stdout.trim() || 'psql exit non-zero' };
	}
	return { ok: true };
}

export function loadPostconditions(
	dbUrl: string,
	incorrectId: string,
	canonicalId: string,
	incorrectSlug: string,
): NonNullable<InvitationIdPurgeAudit['postconditions']> {
	const sql = `
select jsonb_build_object(
  'incorrectExists', (select exists(select 1 from public.invitations where id = ${sqlLiteral(incorrectId)}::uuid)),
  'canonicalExists', (select exists(select 1 from public.invitations where id = ${sqlLiteral(canonicalId)}::uuid)),
  'canonicalSlug', (select slug from public.invitations where id = ${sqlLiteral(canonicalId)}::uuid),
  'obsoleteSlugPresent', (select exists(
    select 1 from public.invitations
    where slug = ${sqlLiteral(incorrectSlug)} and archived_at is null
  ) or exists(
    select 1 from public.published_invitation_content
    where slug = ${sqlLiteral(incorrectSlug)} and deleted_at is null
  ) or exists(
    select 1 from public.events
    where slug = ${sqlLiteral(incorrectSlug)} and deleted_at is null
  )),
  'orphanChecks', jsonb_build_object(
    'events', (select count(*)::int from public.events where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
    'drafts', (select count(*)::int from public.invitation_content_drafts where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
    'published', (select count(*)::int from public.published_invitation_content where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
    'assets', (select count(*)::int from public.invitation_assets where invitation_id = ${sqlLiteral(incorrectId)}::uuid),
    'provenance', (select count(*)::int from public.managed_invitation_release_provenance where invitation_id = ${sqlLiteral(incorrectId)}::uuid),
    'idempotency', (select count(*)::int from public.invitation_publication_idempotency where invitation_id = ${sqlLiteral(incorrectId)}::uuid)
  )
)::text;
`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	return parseJsonObject(result.stdout, 'postconditions');
}

export function insertPurgeReceipt(
	dbUrl: string,
	canonicalInvitationId: string,
	incorrectInvitationId: string,
	audit: InvitationIdPurgeAudit,
): string {
	const operationId = globalThis.crypto.randomUUID();
	const status =
		audit.blocked ||
		audit.deletionResult === 'rolled_back' ||
		audit.deletionResult === 'deleted_with_residual'
			? 'partial'
			: audit.deletionResult === 'already_absent'
				? 'replayed'
				: 'applied';
	const completedStepsSql =
		audit.completedSteps.length > 0
			? `array[${audit.completedSteps.map((step) => sqlLiteral(step)).join(',')}]::text[]`
			: 'array[]::text[]';
	const inputHashes = JSON.stringify({
		incorrectInvitationId: incorrectInvitationId,
		canonicalInvitationId: canonicalInvitationId,
	});
	const expectedState = JSON.stringify({
		expectIncorrectSlug: audit.incorrect.slug,
		expectCanonicalSlug: audit.canonical.slug,
		incorrectDependencies: audit.incorrectDependencies,
	});
	const resultPayload = JSON.stringify({
		deletionResult: audit.deletionResult,
		storageCleanup: audit.storageCleanup ?? null,
		postconditions: audit.postconditions ?? null,
		failures: audit.failures,
	});
	const sanitizedError = audit.failures.length
		? JSON.stringify({ message: audit.failures.join(' | ').slice(0, 500) })
		: '{}';
	const sql = `
insert into public.invitation_mutation_operation_receipts (
  operation_id, invitation_id, environment, project_ref, actor_type, origin, command_kind,
  input_hashes, expected_state, status, completed_steps, result, sanitized_error
) values (
  ${sqlLiteral(operationId)}::uuid,
  ${sqlLiteral(canonicalInvitationId)}::uuid,
  'preview',
  'preview',
  'operator',
  'managed_cli_hosted',
  'invitation_id_purge',
  ${sqlLiteral(inputHashes)}::jsonb,
  ${sqlLiteral(expectedState)}::jsonb,
  ${sqlLiteral(status)},
  ${completedStepsSql},
  ${sqlLiteral(resultPayload)}::jsonb,
  ${sqlLiteral(sanitizedError)}::jsonb
);
select ${sqlLiteral(operationId)};
`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	return result.stdout.trim();
}

export function collectPurgeBlockReasons(
	input: InvitationIdPurgeInput,
	loaded: LoadedAuditPayload,
	migration: MigrationAssessment,
	assetHashEquivalence: NonNullable<InvitationIdPurgeAudit['assetHashEquivalence']>,
	expectIncorrectSlug: string,
	expectCanonicalSlug: string,
): string[] {
	const blockReasons: string[] = [];
	if (loaded.incorrect.slug !== expectIncorrectSlug) {
		blockReasons.push(
			`INCORRECT_SLUG_MISMATCH: expected ${expectIncorrectSlug}, got ${loaded.incorrect.slug}.`,
		);
	}
	if (loaded.canonical.slug !== expectCanonicalSlug) {
		blockReasons.push(
			`CANONICAL_SLUG_MISMATCH: expected ${expectCanonicalSlug}, got ${loaded.canonical.slug}.`,
		);
	}
	if (EXCLUDED_LIFECYCLE.has(loaded.canonical.status)) {
		blockReasons.push('Refusing purge: canonical invitation has draft/in_progress status.');
	}
	if (loaded.canonical.archivedAt) {
		blockReasons.push('Canonical invitation is archived; refuse purge.');
	}
	if (!loaded.incorrect.archivedAt) {
		blockReasons.push(
			'INCORRECT_NOT_ARCHIVED: This purge accepts only a genuinely archived inconsistent source.',
		);
	}
	if (!input.allowArchivedInconsistentSource) {
		blockReasons.push(
			'ARCHIVED_INCONSISTENT_ACK_REQUIRED: Pass --allow-archived-inconsistent-source to purge an archived inconsistent source.',
		);
	}
	if (loaded.incorrectDependencies.claimCodes > 0) {
		blockReasons.push(
			`UNRESOLVED_CLAIM_CODES: ${loaded.incorrectDependencies.claimCodes} claim code(s) remain; migrate or disposition before purge.`,
		);
	}
	if (migration.required && migration.blockReason) {
		blockReasons.push(migration.blockReason);
	}
	if (
		loaded.incorrectDependencies.guests > 0 &&
		migration.guestCandidates.some((g) => g.classification === 'requires_migration_review')
	) {
		blockReasons.push(
			'UNRESOLVED_GUESTS: Non-synthetic guest rows remain; migrate or disposition before purge.',
		);
	}
	if (
		input.requireCanonicalAssetHashEquivalence !== false &&
		!assetHashEquivalence.ok
	) {
		blockReasons.push(
			`ASSET_HASH_EQUIVALENCE_FAILED: incorrect asset hashes missing on canonical: ${assetHashEquivalence.missingOnCanonical.join(', ')}`,
		);
	}
	const foreignStorage = assertStorageOwnership(loaded.storageAssetPaths, expectIncorrectSlug);
	if (foreignStorage.length > 0) {
		blockReasons.push(
			`STORAGE_OWNERSHIP_VIOLATION: paths outside managed/${expectIncorrectSlug}/: ${foreignStorage.join(', ')}`,
		);
	}
	return blockReasons;
}
