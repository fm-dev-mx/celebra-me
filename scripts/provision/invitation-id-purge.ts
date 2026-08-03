/**
 * invitation-id-purge.ts — ID-scoped Preview invitation purge with dry-run audit.
 *
 * Deletes an incorrect invitation and its exclusive dependencies by immutable UUID only.
 * Never matches by display name or partial text. Production is rejected.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	classifyDbTarget,
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	PROJECT_ROOT,
	redactDbUrl,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';
import { verifyPreviewWriteAuthorization } from './preview-write-auth.ts';

export const INVITATION_ID_PURGE_OPERATION = 'id-purge';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXCLUDED_LIFECYCLE = new Set(['draft', 'in_progress']);

export interface InvitationIdPurgeInput {
	incorrectInvitationId: string;
	canonicalInvitationId: string;
	expectIncorrectSlug?: string;
	expectCanonicalSlug?: string;
	apply?: boolean;
	isInteractive?: boolean;
	authToken?: string;
	env?: NodeJS.ProcessEnv;
	auditDir?: string;
}

export interface InvitationRecordSummary {
	id: string;
	slug: string;
	title: string;
	status: string;
	kind: string;
	eventType: string;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
	clientName: string | null;
	environment: 'preview';
}

export interface DependencyCounts {
	events: number;
	drafts: number;
	published: number;
	assets: number;
	assetsActive: number;
	provenance: number;
	publicationIdempotency: number;
	mutationReceipts: number;
	legacyAdoption: number;
	intakeRequests: number;
	sourcedInvitations: number;
	guests: number;
	claimCodes: number;
	memberships: number;
	guestAudit: number;
}

export interface GuestMigrationCandidate {
	id: string;
	fullName: string;
	hasEmail: boolean;
	hasPhone: boolean;
	attendanceStatus: string | null;
	classification: 'synthetic_test' | 'requires_migration_review';
}

export interface MigrationAssessment {
	required: boolean;
	blockReason: string | null;
	guestCandidates: GuestMigrationCandidate[];
	notes: string[];
}

export interface InvitationIdPurgeAudit {
	mode: 'dry_run' | 'apply';
	executedAt: string;
	environment: 'preview';
	dbUrlRedacted: string;
	incorrect: InvitationRecordSummary;
	canonical: InvitationRecordSummary;
	incorrectDependencies: DependencyCounts;
	canonicalDependencies: DependencyCounts;
	migration: MigrationAssessment;
	deletePlan: {
		tables: Array<{ table: string; action: 'delete' | 'retain_ledger'; count: number; reason: string }>;
		storageAssetPaths: string[];
	};
	blocked: boolean;
	blockReasons: string[];
	deletionResult: 'not_executed' | 'deleted' | 'rolled_back' | 'blocked' | 'deleted_with_residual';
	postconditions?: {
		incorrectExists: boolean;
		canonicalExists: boolean;
		canonicalSlug: string | null;
		orphanChecks: Record<string, number>;
	};
	auditArtifactPath: string | null;
}

function assertUuid(value: string, label: string): string {
	const trimmed = value.trim();
	if (!UUID_RE.test(trimmed)) {
		throw new Error(`INVALID_INVITATION_ID: ${label} must be a UUID, got "${value}".`);
	}
	return trimmed.toLowerCase();
}

export function resolvePreviewPurgeDbUrl(env: NodeJS.ProcessEnv = process.env): string {
	const dbUrl = (
		env.PREVIEW_DB_URL?.trim() ||
		getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES)
	).trim();
	if (!dbUrl) {
		throw new Error(
			'PREVIEW_DB_URL_REQUIRED: Set PREVIEW_DB_URL or provide gitignored .env.preview.local.',
		);
	}
	const classification = classifyDbTarget(dbUrl);
	if (classification.target === 'production') {
		throw new Error('INVITATION_ID_PURGE_PRODUCTION_REJECTED: Production targets are never allowed.');
	}
	if (classification.target !== 'preview') {
		throw new Error(
			`INVITATION_ID_PURGE_TARGET_REJECTED: Expected preview, got ${classification.target}.`,
		);
	}
	return dbUrl;
}

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

function classifyGuest(fullName: string, hasEmail: boolean, hasPhone: boolean): GuestMigrationCandidate['classification'] {
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

function loadAuditPayload(
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

function assessMigration(guests: LoadedAuditPayload['guests'], deps: DependencyCounts): MigrationAssessment {
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

function buildDeletePlan(
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
			{
				table: 'invitation_mutation_operation_receipts',
				action: 'retain_ledger',
				count: deps.mutationReceipts,
				reason: 'Append-only ledger (no UPDATE/DELETE); invitation_id has no FK',
			},
		],
		storageAssetPaths,
	};
}

function writeAuditArtifact(audit: InvitationIdPurgeAudit, auditDir: string): string {
	mkdirSync(auditDir, { recursive: true });
	const stamp = audit.executedAt.replaceAll(':', '').replaceAll('.', '');
	const path = join(auditDir, `invitation-id-purge-${stamp}.json`);
	writeFileSync(path, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
	return path;
}

function executeDeleteTransaction(
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
  v_remaining int;
begin
  select * into v_incorrect from public.invitations where id = ${sqlLiteral(incorrectId)}::uuid for update;
  if not found then
    raise exception 'INCORRECT_NOT_FOUND';
  end if;
  select * into v_canonical from public.invitations where id = ${sqlLiteral(canonicalId)}::uuid for update;
  if not found then
    raise exception 'CANONICAL_NOT_FOUND';
  end if;
  if v_incorrect.id = v_canonical.id then
    raise exception 'IDS_COLLIDE';
  end if;
  if v_incorrect.slug is distinct from ${sqlLiteral(expectIncorrectSlug)} then
    raise exception 'INCORRECT_SLUG_MISMATCH';
  end if;
  if v_canonical.slug is distinct from ${sqlLiteral(expectCanonicalSlug)} then
    raise exception 'CANONICAL_SLUG_MISMATCH';
  end if;
  if exists (
    select 1 from public.event_claim_codes c
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

  if exists (select 1 from public.invitations where id = ${sqlLiteral(incorrectId)}::uuid) then
    raise exception 'INCORRECT_STILL_PRESENT';
  end if;
  if not exists (
    select 1 from public.invitations
    where id = ${sqlLiteral(canonicalId)}::uuid
      and slug = ${sqlLiteral(expectCanonicalSlug)}
  ) then
    raise exception 'CANONICAL_CHANGED';
  end if;

  select count(*) into v_remaining from public.events where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid;
  if v_remaining <> 0 then raise exception 'ORPHAN_EVENTS'; end if;
  select count(*) into v_remaining from public.invitation_content_drafts where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid;
  if v_remaining <> 0 then raise exception 'ORPHAN_DRAFTS'; end if;
  select count(*) into v_remaining from public.published_invitation_content where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid;
  if v_remaining <> 0 then raise exception 'ORPHAN_PUBLISHED'; end if;
  select count(*) into v_remaining from public.invitation_assets where invitation_id = ${sqlLiteral(incorrectId)}::uuid;
  if v_remaining <> 0 then raise exception 'ORPHAN_ASSETS'; end if;
  select count(*) into v_remaining from public.invitation_publication_idempotency where invitation_id = ${sqlLiteral(incorrectId)}::uuid;
  if v_remaining <> 0 then raise exception 'ORPHAN_IDEMPOTENCY'; end if;
end $$;
commit;
select 'deleted';
`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: false });
	if (result.status !== 0) {
		return {
			ok: false,
			error: (result.stderr || result.stdout || 'unknown transaction failure').trim(),
		};
	}
	if (!result.stdout.trim().split(/\r?\n/).some((line) => line.trim() === 'deleted')) {
		return { ok: false, error: 'Transaction did not confirm deletion.' };
	}
	return { ok: true };
}

function loadPostconditions(
	dbUrl: string,
	incorrectId: string,
	canonicalId: string,
): NonNullable<InvitationIdPurgeAudit['postconditions']> {
	const sql = `
select jsonb_build_object(
  'incorrectExists', exists(select 1 from public.invitations where id = ${sqlLiteral(incorrectId)}::uuid),
  'canonicalExists', exists(select 1 from public.invitations where id = ${sqlLiteral(canonicalId)}::uuid),
  'canonicalSlug', (select slug from public.invitations where id = ${sqlLiteral(canonicalId)}::uuid),
  'orphanChecks', jsonb_build_object(
    'events', (select count(*)::int from public.events where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
    'drafts', (select count(*)::int from public.invitation_content_drafts where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
    'published', (select count(*)::int from public.published_invitation_content where invitation_project_id = ${sqlLiteral(incorrectId)}::uuid),
    'assets', (select count(*)::int from public.invitation_assets where invitation_id = ${sqlLiteral(incorrectId)}::uuid),
    'publicationIdempotency', (select count(*)::int from public.invitation_publication_idempotency where invitation_id = ${sqlLiteral(incorrectId)}::uuid),
    'provenance', (select count(*)::int from public.managed_invitation_release_provenance where invitation_id = ${sqlLiteral(incorrectId)}::uuid)
  )
);
`;
	const result = runPsql(sql, dbUrl, { tuplesOnly: true, throwOnError: true });
	return parseJsonObject(result.stdout, 'postconditions');
}

function collectPurgeBlockReasons(
	input: InvitationIdPurgeInput,
	loaded: LoadedAuditPayload,
	migration: MigrationAssessment,
): string[] {
	const blockReasons: string[] = [];
	if (input.expectIncorrectSlug && loaded.incorrect.slug !== input.expectIncorrectSlug) {
		blockReasons.push(
			`Incorrect slug mismatch: expected ${input.expectIncorrectSlug}, got ${loaded.incorrect.slug}.`,
		);
	}
	if (input.expectCanonicalSlug && loaded.canonical.slug !== input.expectCanonicalSlug) {
		blockReasons.push(
			`Canonical slug mismatch: expected ${input.expectCanonicalSlug}, got ${loaded.canonical.slug}.`,
		);
	}
	if (EXCLUDED_LIFECYCLE.has(loaded.incorrect.status) || EXCLUDED_LIFECYCLE.has(loaded.canonical.status)) {
		blockReasons.push('Refusing purge involving draft/in_progress lifecycle status.');
	}
	if (loaded.incorrect.archivedAt) {
		blockReasons.push('Incorrect invitation is archived; refuse ambiguous archive/delete path.');
	}
	if (loaded.canonical.archivedAt) {
		blockReasons.push('Canonical invitation is archived; refuse purge.');
	}
	if (migration.required && migration.blockReason) {
		blockReasons.push(migration.blockReason);
	}
	return blockReasons;
}

export function runInvitationIdPurge(input: InvitationIdPurgeInput): InvitationIdPurgeAudit {
	const incorrectInvitationId = assertUuid(input.incorrectInvitationId, 'incorrectInvitationId');
	const canonicalInvitationId = assertUuid(input.canonicalInvitationId, 'canonicalInvitationId');
	if (incorrectInvitationId === canonicalInvitationId) {
		throw new Error('INVITATION_IDS_COLLIDE: incorrect and canonical IDs must differ.');
	}

	const apply = input.apply === true;
	const env = input.env ?? process.env;
	const dbUrl = resolvePreviewPurgeDbUrl(env);
	const auditDir = input.auditDir ?? join(PROJECT_ROOT, '.tmp', 'invitation-purge-audits');

	const loaded = loadAuditPayload(dbUrl, incorrectInvitationId, canonicalInvitationId);
	const migration = assessMigration(loaded.guests, loaded.incorrectDependencies);
	const blockReasons = collectPurgeBlockReasons(input, loaded, migration);

	verifyPreviewWriteAuthorization({
		slug: loaded.incorrect.slug,
		targets: ['preview'],
		apply,
		isInteractive: input.isInteractive,
		authToken: input.authToken,
		operation: INVITATION_ID_PURGE_OPERATION,
	});

	const audit: InvitationIdPurgeAudit = {
		mode: apply ? 'apply' : 'dry_run',
		executedAt: new Date().toISOString(),
		environment: 'preview',
		dbUrlRedacted: redactDbUrl(dbUrl),
		incorrect: loaded.incorrect,
		canonical: loaded.canonical,
		incorrectDependencies: loaded.incorrectDependencies,
		canonicalDependencies: loaded.canonicalDependencies,
		migration,
		deletePlan: buildDeletePlan(loaded.incorrectDependencies, loaded.storageAssetPaths),
		blocked: blockReasons.length > 0,
		blockReasons,
		deletionResult: 'not_executed',
		auditArtifactPath: null,
	};

	if (apply) {
		if (audit.blocked) {
			audit.deletionResult = 'blocked';
		} else {
			const tx = executeDeleteTransaction(
				dbUrl,
				incorrectInvitationId,
				canonicalInvitationId,
				loaded.incorrect.slug,
				loaded.canonical.slug,
			);
			if (!tx.ok) {
				audit.deletionResult = 'rolled_back';
				audit.blocked = true;
				audit.blockReasons.push(`TRANSACTION_ROLLED_BACK: ${tx.error}`);
			} else {
				audit.deletionResult = 'deleted';
				audit.postconditions = loadPostconditions(
					dbUrl,
					incorrectInvitationId,
					canonicalInvitationId,
				);
				if (
					audit.postconditions.incorrectExists ||
					!audit.postconditions.canonicalExists ||
					Object.values(audit.postconditions.orphanChecks).some((count) => count > 0)
				) {
					audit.blocked = true;
					audit.blockReasons.push('POSTCONDITION_FAILED: Unexpected residual state after delete.');
					audit.deletionResult = 'deleted_with_residual';
				}
			}
		}
	}

	audit.auditArtifactPath = writeAuditArtifact(audit, auditDir);
	return audit;
}
