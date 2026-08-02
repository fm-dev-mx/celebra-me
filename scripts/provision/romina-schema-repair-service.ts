import { runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { rominaReceiptOperationId, type RominaSchemaRepairPlan } from './romina-schema-repair.ts';

export interface RominaSchemaRepairTransactionInput {
	plan: RominaSchemaRepairPlan;
	draftContent: Record<string, unknown>;
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

export function buildRominaSchemaRepairTransactionSql(
	input: RominaSchemaRepairTransactionInput,
): string {
	const { plan } = input;
	const receiptOperationId = rominaReceiptOperationId(plan.operationId);
	const expectedBefore = sqlJson(input.draftContent);
	const expectedAfter = sqlJson({
		...input.draftContent,
		location: {
			...((input.draftContent.location ?? {}) as Record<string, unknown>),
			venues: (
				(input.draftContent.location as Record<string, unknown>).venues as unknown[]
			).map((venue, index) => ({
				...((venue ?? {}) as Record<string, unknown>),
				venueEvent: plan.after.venueEvents[index],
			})),
		},
		family: {
			...((input.draftContent.family ?? {}) as Record<string, unknown>),
			godparents: plan.after.godparents,
		},
	});
	const inputHashes = sqlJson({
		operationId: plan.operationId,
		operationFingerprint: plan.operationFingerprint,
		beforeHash: plan.hashes.before,
		afterHash: plan.hashes.after,
		unrelatedBefore: plan.hashes.unrelatedBefore,
		unrelatedAfter: plan.hashes.unrelatedAfter,
		changedPaths: plan.changedPaths,
	});
	const expectedState = sqlJson({
		draftStatus: input.draftStatus,
		draftUpdatedAt: input.draftUpdatedAt,
		publishedVersion: plan.publishedVersion,
	});
	const appliedResult = sqlJson({
		slug: plan.slug,
		operationId: plan.operationId,
		operationFingerprint: plan.operationFingerprint,
		beforeHash: plan.hashes.before,
		afterHash: plan.hashes.after,
		changedPaths: plan.changedPaths,
		provenance: 'romina_schema_repair',
		idempotent: false,
	});
	const replayedResult = sqlJson({
		slug: plan.slug,
		operationId: plan.operationId,
		operationFingerprint: plan.operationFingerprint,
		beforeHash: plan.hashes.before,
		afterHash: plan.hashes.after,
		changedPaths: plan.changedPaths,
		provenance: 'romina_schema_repair',
		idempotent: true,
	});

	return `BEGIN;
DO $romina_schema_repair$
DECLARE
  v_invitation_id uuid;
  v_draft public.invitation_content_drafts%rowtype;
  v_receipt public.invitation_mutation_operation_receipts%rowtype;
  v_expected_before jsonb := ${expectedBefore};
  v_expected_after jsonb := ${expectedAfter};
BEGIN
  SELECT i.id INTO v_invitation_id
    FROM public.invitations i
   WHERE i.slug = ${sqlLiteral(plan.slug)}
     AND i.archived_at IS NULL
   ORDER BY i.id
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROMINA_REPAIR_TARGET_NOT_FOUND';
  END IF;

  SELECT d.* INTO v_draft
    FROM public.invitation_content_drafts d
   WHERE d.invitation_project_id = v_invitation_id
     AND d.deleted_at IS NULL
   ORDER BY d.updated_at DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROMINA_REPAIR_DRAFT_NOT_FOUND';
  END IF;

  SELECT * INTO v_receipt
    FROM public.invitation_mutation_operation_receipts r
   WHERE r.operation_id = ${sqlLiteral(receiptOperationId)}::uuid;
  IF FOUND THEN
    IF v_receipt.command_kind <> 'romina_schema_repair'
       OR v_receipt.input_hashes->>'operationId' <> ${sqlLiteral(plan.operationId)}
       OR v_receipt.input_hashes->>'operationFingerprint' <> ${sqlLiteral(plan.operationFingerprint)}
       OR v_draft.content <> v_expected_after THEN
      RAISE EXCEPTION 'ROMINA_REPAIR_OPERATION_ID_REUSED';
    END IF;
    RETURN;
  END IF;

  IF v_draft.content = v_expected_after THEN
    INSERT INTO public.invitation_mutation_operation_receipts (
      operation_id, invitation_id, environment, project_ref, actor_type, origin,
      command_kind, input_hashes, expected_state, status, completed_steps, result
    ) VALUES (
      ${sqlLiteral(receiptOperationId)}::uuid, v_invitation_id, 'production', 'production',
      'operator', 'recovery', 'romina_schema_repair', ${inputHashes}, ${expectedState},
      'replayed', ${sqlTextArray(['target_verified', 'already_repaired'])}, ${replayedResult}
    );
    RETURN;
  END IF;

  IF v_draft.content <> v_expected_before THEN
    RAISE EXCEPTION 'ROMINA_REPAIR_STALE_DRAFT';
  END IF;

  UPDATE public.invitation_content_drafts
     SET content = v_expected_after
   WHERE id = v_draft.id;

  INSERT INTO public.invitation_mutation_operation_receipts (
    operation_id, invitation_id, environment, project_ref, actor_type, origin,
    command_kind, input_hashes, expected_state, status, completed_steps, result
  ) VALUES (
    ${sqlLiteral(receiptOperationId)}::uuid, v_invitation_id, 'production', 'production',
    'operator', 'recovery', 'romina_schema_repair', ${inputHashes}, ${expectedState},
    'applied', ${sqlTextArray(['target_verified', 'draft_repaired', 'schema_validated'])}, ${appliedResult}
  );
END;
$romina_schema_repair$;
SELECT row_to_json(result_row)
  FROM (
    SELECT d.content AS "draftContent", r.status, r.result
      FROM public.invitation_content_drafts d
      JOIN public.invitations i ON i.id = d.invitation_project_id
      JOIN public.invitation_mutation_operation_receipts r
        ON r.operation_id = ${sqlLiteral(receiptOperationId)}::uuid
     WHERE i.slug = ${sqlLiteral(plan.slug)}
       AND i.archived_at IS NULL
       AND d.deleted_at IS NULL
     ORDER BY d.updated_at DESC
     LIMIT 1
  ) result_row;
COMMIT;`;
}

export function applyRominaSchemaRepair(input: RominaSchemaRepairTransactionInput): {
	status: string;
	result: unknown;
	draftContent: Record<string, unknown>;
} {
	const result = runPsql(buildRominaSchemaRepairTransactionSql(input), input.targetDbUrl, {
		tuplesOnly: true,
	});
	const line = result.stdout
		.trim()
		.split(/\r?\n/)
		.map((value) => value.trim())
		.find((value) => value.startsWith('{'));
	if (!line) throw new Error('ROMINA_REPAIR_APPLY_NO_RESULT: transaction returned no receipt.');
	const parsed = JSON.parse(line) as {
		draftContent: Record<string, unknown>;
		status: string;
		result: unknown;
	};
	return parsed;
}
