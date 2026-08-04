import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import type { RominaDraftResetPlan } from './romina-draft-reset.ts';
import { deriveRominaReceiptOperationId } from './romina-shared-helpers.ts';

export interface RominaDraftResetTransactionInput {
	plan: RominaDraftResetPlan;
	draftContent: Record<string, unknown>;
	publishedContent: Record<string, unknown>;
	draftStatus: string | null;
	draftUpdatedAt: string | null;
	targetDbUrl: string;
}

function sqlJson(value: unknown): string {
	return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values: readonly string[]): string {
	return `ARRAY[${values.map((value) => sqlLiteral(value)).join(', ')}]`;
}

export function buildRominaDraftResetTransactionSql(
	input: RominaDraftResetTransactionInput,
): string {
	const { plan } = input;
	const receiptOperationId = deriveRominaReceiptOperationId(plan.operationId);
	const expectedBefore = sqlJson(input.draftContent);
	const expectedAfter = sqlJson(input.publishedContent);
	const expectedPublished = sqlJson(input.publishedContent);
	const inputHashes = sqlJson({
		operationId: plan.operationId,
		operationFingerprint: plan.operationFingerprint,
		publishedHash: plan.hashes.published,
		draftBefore: plan.hashes.draftBefore,
		draftAfter: plan.hashes.draftAfter,
		publishedVersion: plan.publishedVersion,
		changedPathCount: plan.changedPaths.length,
	});
	const expectedState = sqlJson({
		draftStatus: input.draftStatus,
		draftUpdatedAt: input.draftUpdatedAt,
		publishedVersion: plan.publishedVersion,
		publishedHash: plan.hashes.published,
	});
	const appliedResult = sqlJson({
		slug: plan.slug,
		operationId: plan.operationId,
		operationFingerprint: plan.operationFingerprint,
		publishedHash: plan.hashes.published,
		draftBefore: plan.hashes.draftBefore,
		draftAfter: plan.hashes.draftAfter,
		changedPathCount: plan.changedPaths.length,
		provenance: 'romina_draft_reset',
		idempotent: false,
	});
	const replayedResult = sqlJson({
		slug: plan.slug,
		operationId: plan.operationId,
		operationFingerprint: plan.operationFingerprint,
		publishedHash: plan.hashes.published,
		draftBefore: plan.hashes.draftBefore,
		draftAfter: plan.hashes.draftAfter,
		changedPathCount: plan.changedPaths.length,
		provenance: 'romina_draft_reset',
		idempotent: true,
	});
	const publishedVersionSql =
		plan.publishedVersion === null ? 'NULL' : String(plan.publishedVersion);

	return `BEGIN;
DO $romina_draft_reset$
DECLARE
  v_invitation_id uuid;
  v_draft public.invitation_content_drafts%rowtype;
  v_published jsonb;
  v_published_version integer;
  v_receipt public.invitation_mutation_operation_receipts%rowtype;
  v_expected_before jsonb := ${expectedBefore};
  v_expected_after jsonb := ${expectedAfter};
  v_expected_published jsonb := ${expectedPublished};
BEGIN
  SELECT i.id INTO v_invitation_id
    FROM public.invitations i
   WHERE i.slug = ${sqlLiteral(plan.slug)}
     AND i.archived_at IS NULL
   ORDER BY i.id
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROMINA_DRAFT_RESET_TARGET_NOT_FOUND';
  END IF;

  SELECT d.* INTO v_draft
    FROM public.invitation_content_drafts d
   WHERE d.invitation_project_id = v_invitation_id
     AND d.deleted_at IS NULL
   ORDER BY d.updated_at DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROMINA_DRAFT_RESET_DRAFT_NOT_FOUND';
  END IF;

  SELECT p.content, p.version
    INTO v_published, v_published_version
    FROM public.published_invitation_content p
   WHERE p.invitation_project_id = v_invitation_id
     AND p.deleted_at IS NULL
   ORDER BY p.version DESC
   LIMIT 1
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROMINA_DRAFT_RESET_PUBLISHED_NOT_FOUND';
  END IF;

  IF v_published IS DISTINCT FROM v_expected_published
     OR v_published_version IS DISTINCT FROM ${publishedVersionSql} THEN
    RAISE EXCEPTION 'ROMINA_DRAFT_RESET_PUBLISHED_CHANGED';
  END IF;

  SELECT * INTO v_receipt
    FROM public.invitation_mutation_operation_receipts r
   WHERE r.operation_id = ${sqlLiteral(receiptOperationId)}::uuid;
  IF FOUND THEN
    IF v_receipt.command_kind <> 'romina_draft_reset'
       OR v_receipt.input_hashes->>'operationId' <> ${sqlLiteral(plan.operationId)}
       OR v_receipt.input_hashes->>'operationFingerprint' <> ${sqlLiteral(plan.operationFingerprint)}
       OR v_draft.content <> v_expected_after THEN
      RAISE EXCEPTION 'ROMINA_DRAFT_RESET_OPERATION_ID_REUSED';
    END IF;
    RETURN;
  END IF;

  IF v_draft.content = v_expected_after THEN
    INSERT INTO public.invitation_mutation_operation_receipts (
      operation_id, invitation_id, environment, project_ref, actor_type, origin,
      command_kind, input_hashes, expected_state, status, completed_steps, result
    ) VALUES (
      ${sqlLiteral(receiptOperationId)}::uuid, v_invitation_id, 'production', 'production',
      'operator', 'recovery', 'romina_draft_reset', ${inputHashes}, ${expectedState},
      'replayed', ${sqlTextArray(['target_verified', 'already_reset'])}, ${replayedResult}
    );
    RETURN;
  END IF;

  IF v_draft.content <> v_expected_before THEN
    RAISE EXCEPTION 'ROMINA_DRAFT_RESET_STALE_DRAFT';
  END IF;

  UPDATE public.invitation_content_drafts
     SET content = v_expected_after
   WHERE id = v_draft.id;

  INSERT INTO public.invitation_mutation_operation_receipts (
    operation_id, invitation_id, environment, project_ref, actor_type, origin,
    command_kind, input_hashes, expected_state, status, completed_steps, result
  ) VALUES (
    ${sqlLiteral(receiptOperationId)}::uuid, v_invitation_id, 'production', 'production',
    'operator', 'recovery', 'romina_draft_reset', ${inputHashes}, ${expectedState},
    'applied', ${sqlTextArray(['target_verified', 'draft_reset', 'schema_validated'])}, ${appliedResult}
  );
END;
$romina_draft_reset$;
SELECT row_to_json(result_row)
  FROM (
    SELECT d.content AS "draftContent", r.status, r.result,
           p.content AS "publishedContent", p.version AS "publishedVersion"
      FROM public.invitation_content_drafts d
      JOIN public.invitations i ON i.id = d.invitation_project_id
      JOIN public.invitation_mutation_operation_receipts r
        ON r.operation_id = ${sqlLiteral(receiptOperationId)}::uuid
      JOIN public.published_invitation_content p
        ON p.invitation_project_id = i.id AND p.deleted_at IS NULL
     WHERE i.slug = ${sqlLiteral(plan.slug)}
       AND i.archived_at IS NULL
       AND d.deleted_at IS NULL
     ORDER BY d.updated_at DESC, p.version DESC
     LIMIT 1
  ) result_row;
COMMIT;`;
}

export function applyRominaDraftReset(input: RominaDraftResetTransactionInput): {
	status: string;
	result: unknown;
	draftContent: Record<string, unknown>;
	publishedContent: Record<string, unknown>;
	publishedVersion: number | null;
} {
	const result = runPsql(buildRominaDraftResetTransactionSql(input), input.targetDbUrl, {
		tuplesOnly: true,
	});
	const line = result.stdout
		.trim()
		.split(/\r?\n/)
		.map((value) => value.trim())
		.find((value) => value.startsWith('{'));
	if (!line) {
		throw new Error('ROMINA_DRAFT_RESET_APPLY_NO_RESULT: transaction returned no receipt.');
	}
	const parsed = JSON.parse(line) as {
		draftContent: Record<string, unknown>;
		publishedContent: Record<string, unknown>;
		publishedVersion: number | null;
		status: string;
		result: unknown;
	};
	return parsed;
}
