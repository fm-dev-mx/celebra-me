/**
 * Database boundary for the draft canonicalization repair.
 * Reads are forced read-only; the write runs in a single guarded transaction.
 */
import {
	getPreviewDbUrl,
	getProdDbUrl,
	LOCAL_DB_URL,
	runPsql,
	sqlLiteral,
} from '../db/db-workflow-lib.ts';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	DRAFT_CANONICALIZATION_OPERATION_TYPE,
	type DraftCanonicalizationPlan,
	type DraftCanonicalizationTarget,
} from './draft-canonicalization.ts';

type JsonRecord = Record<string, unknown>;

export interface DraftCanonicalizationState {
	draft: { content: JsonRecord | null; status: string | null; updatedAt: string | null };
	published: { content: JsonRecord | null; version: number | null };
}

export function resolveTargetDbUrl(target: DraftCanonicalizationTarget): string {
	if (target === 'production') return getProdDbUrl().url;
	if (target === 'preview') return getPreviewDbUrl().url;
	return LOCAL_DB_URL;
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePsqlJson(stdout: string): unknown {
	const text = stdout.trim();
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start < 0 || end < start) return null;
	return JSON.parse(text.slice(start, end + 1)) as unknown;
}

function buildStateSql(slug: string): string {
	const literal = sqlLiteral(slug);
	return `SELECT jsonb_build_object(
  'draft', (SELECT jsonb_build_object('content', d.content, 'status', d.status, 'updatedAt', d.updated_at)
              FROM public.invitation_content_drafts d
              JOIN public.invitations i ON i.id = d.invitation_project_id
             WHERE i.slug = ${literal} AND i.archived_at IS NULL AND d.deleted_at IS NULL
             ORDER BY d.updated_at DESC LIMIT 1),
  'published', (SELECT jsonb_build_object('content', p.content, 'version', p.version)
                  FROM public.published_invitation_content p
                  JOIN public.invitations i ON i.id = p.invitation_project_id
                 WHERE i.slug = ${literal} AND i.archived_at IS NULL AND p.deleted_at IS NULL
                 ORDER BY p.version DESC, p.created_at DESC LIMIT 1))::text;`;
}

export function readDraftCanonicalizationState(
	slug: string,
	dbUrl: string,
): DraftCanonicalizationState | null {
	const result = runPsql(buildStateSql(slug), dbUrl, {
		tuplesOnly: true,
		throwOnError: false,
		timeoutMs: 30_000,
		env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
	});
	if (result.status !== 0) return null;
	const parsed = parsePsqlJson(result.stdout);
	if (!isRecord(parsed) || !isRecord(parsed.draft) || !isRecord(parsed.published)) return null;
	return {
		draft: {
			content: isRecord(parsed.draft.content) ? parsed.draft.content : null,
			status: typeof parsed.draft.status === 'string' ? parsed.draft.status : null,
			updatedAt: typeof parsed.draft.updatedAt === 'string' ? parsed.draft.updatedAt : null,
		},
		published: {
			content: isRecord(parsed.published.content) ? parsed.published.content : null,
			version:
				typeof parsed.published.version === 'number' ? parsed.published.version : null,
		},
	};
}

function sqlJson(value: unknown): string {
	return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values: readonly string[]): string {
	return `ARRAY[${values.map((value) => sqlLiteral(value)).join(', ')}]`;
}

export interface DraftCanonicalizationWriteInput {
	plan: DraftCanonicalizationPlan;
	beforeContent: JsonRecord;
	publishedContent: JsonRecord;
	targetDbUrl: string;
}

export function buildDraftCanonicalizationTransactionSql(
	input: DraftCanonicalizationWriteInput,
): string {
	const { plan } = input;
	const projectRef = SUPABASE_PROJECT_REFS[plan.target];
	const inputHashes = sqlJson({
		operationId: plan.operationId,
		operationFingerprint: plan.operationFingerprint,
		publishedHash: plan.hashes.published,
		draftBefore: plan.hashes.draftBefore,
		draftAfter: plan.hashes.draftAfter,
		publishedVersion: plan.publishedVersion,
		structuralChangedPathCount: plan.structuralChangedPaths.length,
	});
	const expectedState = sqlJson({
		draftStatus: plan.draftStatus,
		draftUpdatedAt: plan.draftUpdatedAt,
		publishedVersion: plan.publishedVersion,
		publishedHash: plan.hashes.published,
	});
	const receiptResult = (idempotent: boolean): string =>
		sqlJson({
			slug: plan.slug,
			operationId: plan.operationId,
			operationFingerprint: plan.operationFingerprint,
			publishedHash: plan.hashes.published,
			draftBefore: plan.hashes.draftBefore,
			draftAfter: plan.hashes.draftAfter,
			removedPublishedOnlyKeys: plan.removedPublishedOnlyKeys,
			provenance: DRAFT_CANONICALIZATION_OPERATION_TYPE,
			idempotent,
		});
	const publishedVersionSql = plan.publishedVersion === null ? 'NULL' : String(plan.publishedVersion);

	return `BEGIN;
DO $draft_canonicalization$
DECLARE
  v_invitation_id uuid;
  v_draft public.invitation_content_drafts%rowtype;
  v_published jsonb;
  v_published_version integer;
  v_receipt public.invitation_mutation_operation_receipts%rowtype;
  v_expected_before jsonb := ${sqlJson(input.beforeContent)};
  v_expected_after jsonb := ${sqlJson(plan.afterContent)};
  v_expected_published jsonb := ${sqlJson(input.publishedContent)};
BEGIN
  SELECT i.id INTO v_invitation_id
    FROM public.invitations i
   WHERE i.slug = ${sqlLiteral(plan.slug)} AND i.archived_at IS NULL
   ORDER BY i.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_CANONICALIZATION_TARGET_NOT_FOUND';
  END IF;

  SELECT d.* INTO v_draft
    FROM public.invitation_content_drafts d
   WHERE d.invitation_project_id = v_invitation_id AND d.deleted_at IS NULL
   ORDER BY d.updated_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_CANONICALIZATION_DRAFT_NOT_FOUND';
  END IF;

  SELECT p.content, p.version INTO v_published, v_published_version
    FROM public.published_invitation_content p
   WHERE p.invitation_project_id = v_invitation_id AND p.deleted_at IS NULL
   ORDER BY p.version DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_CANONICALIZATION_PUBLISHED_NOT_FOUND';
  END IF;

  IF v_published IS DISTINCT FROM v_expected_published
     OR v_published_version IS DISTINCT FROM ${publishedVersionSql} THEN
    RAISE EXCEPTION 'DRAFT_CANONICALIZATION_PUBLISHED_CHANGED';
  END IF;

  SELECT * INTO v_receipt
    FROM public.invitation_mutation_operation_receipts r
   WHERE r.operation_id = ${sqlLiteral(plan.receiptOperationId)}::uuid;
  IF FOUND THEN
    IF v_receipt.command_kind <> '${DRAFT_CANONICALIZATION_OPERATION_TYPE}'
       OR v_receipt.input_hashes->>'operationId' <> ${sqlLiteral(plan.operationId)}
       OR v_draft.content <> v_expected_after THEN
      RAISE EXCEPTION 'DRAFT_CANONICALIZATION_OPERATION_ID_REUSED';
    END IF;
    RETURN;
  END IF;

  IF v_draft.content = v_expected_after THEN
    INSERT INTO public.invitation_mutation_operation_receipts (
      operation_id, invitation_id, environment, project_ref, actor_type, origin,
      command_kind, input_hashes, expected_state, status, completed_steps, result
    ) VALUES (
      ${sqlLiteral(plan.receiptOperationId)}::uuid, v_invitation_id, ${sqlLiteral(plan.target)},
      ${sqlLiteral(projectRef)}, 'operator', 'recovery', '${DRAFT_CANONICALIZATION_OPERATION_TYPE}',
      ${inputHashes}, ${expectedState}, 'replayed',
      ${sqlTextArray(['target_verified', 'already_canonical'])}, ${receiptResult(true)}
    );
    RETURN;
  END IF;

  IF v_draft.content <> v_expected_before THEN
    RAISE EXCEPTION 'DRAFT_CANONICALIZATION_STALE_DRAFT';
  END IF;

  UPDATE public.invitation_content_drafts
     SET content = v_expected_after
   WHERE id = v_draft.id;

  INSERT INTO public.invitation_mutation_operation_receipts (
    operation_id, invitation_id, environment, project_ref, actor_type, origin,
    command_kind, input_hashes, expected_state, status, completed_steps, result
  ) VALUES (
    ${sqlLiteral(plan.receiptOperationId)}::uuid, v_invitation_id, ${sqlLiteral(plan.target)},
    ${sqlLiteral(projectRef)}, 'operator', 'recovery', '${DRAFT_CANONICALIZATION_OPERATION_TYPE}',
    ${inputHashes}, ${expectedState}, 'applied',
    ${sqlTextArray(['target_verified', 'draft_canonicalized', 'schema_validated'])}, ${receiptResult(false)}
  );
END;
$draft_canonicalization$;
SELECT row_to_json(result_row)
  FROM (
    SELECT d.content AS "draftContent", r.status, r.result,
           p.content AS "publishedContent", p.version AS "publishedVersion"
      FROM public.invitation_content_drafts d
      JOIN public.invitations i ON i.id = d.invitation_project_id
      JOIN public.invitation_mutation_operation_receipts r
        ON r.operation_id = ${sqlLiteral(plan.receiptOperationId)}::uuid
      JOIN public.published_invitation_content p
        ON p.invitation_project_id = i.id AND p.deleted_at IS NULL
     WHERE i.slug = ${sqlLiteral(plan.slug)} AND i.archived_at IS NULL AND d.deleted_at IS NULL
     ORDER BY d.updated_at DESC, p.version DESC
     LIMIT 1
  ) result_row;
COMMIT;`;
}

export function applyDraftCanonicalization(input: DraftCanonicalizationWriteInput): {
	status: string;
	result: unknown;
	draftContent: JsonRecord;
	publishedContent: JsonRecord;
} {
	const result = runPsql(buildDraftCanonicalizationTransactionSql(input), input.targetDbUrl, {
		tuplesOnly: true,
	});
	const line = result.stdout
		.trim()
		.split(/\r?\n/)
		.map((value) => value.trim())
		.find((value) => value.startsWith('{'));
	if (!line) {
		throw new Error(
			'DRAFT_CANONICALIZATION_APPLY_NO_RESULT: transaction returned no receipt row.',
		);
	}
	return JSON.parse(line) as {
		status: string;
		result: unknown;
		draftContent: JsonRecord;
		publishedContent: JsonRecord;
	};
}
