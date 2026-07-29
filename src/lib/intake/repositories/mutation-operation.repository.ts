import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import {
	sanitizeMutationEvidence,
	type MutationActorType,
	type MutationOrigin,
	type MutationOutcomeStatus,
} from '@/lib/intake/mutations/outcome';
import type { InvitationMutationEnvironment } from '@/lib/intake/mutations/environment-identity';

export interface AppendMutationOperationReceiptInput {
	operationId: string;
	invitationId?: string | null;
	environment: InvitationMutationEnvironment;
	projectRef: string;
	actorId?: string | null;
	actorType: MutationActorType;
	origin: MutationOrigin;
	commandKind: string;
	inputHashes?: Record<string, string>;
	expectedState?: Record<string, unknown>;
	status: MutationOutcomeStatus;
	completedSteps?: string[];
	result?: Record<string, unknown>;
	error?: unknown;
	retryOfOperationId?: string;
}

export interface MutationOperationReceiptRow {
	operationId: string;
	status: MutationOutcomeStatus;
	commandKind: string;
	completedSteps: string[];
	retryOfOperationId: string | null;
}

export async function findMutationOperationReceipt(
	operationId: string,
): Promise<MutationOperationReceiptRow | null> {
	const rows = await supabaseRestRequest<
		Array<{
			operation_id: string;
			status: MutationOutcomeStatus;
			command_kind: string;
			completed_steps: string[];
			retry_of_operation_id: string | null;
		}>
	>({
		pathWithQuery: `invitation_mutation_operation_receipts?operation_id=eq.${encodeURIComponent(operationId)}&select=operation_id,status,command_kind,completed_steps,retry_of_operation_id&limit=1`,
		method: 'GET',
		useServiceRole: true,
	});
	const row = rows[0];
	return row
		? {
				operationId: row.operation_id,
				status: row.status,
				commandKind: row.command_kind,
				completedSteps: row.completed_steps ?? [],
				retryOfOperationId: row.retry_of_operation_id,
			}
		: null;
}

/** Append a final, immutable operation outcome. Receipts are never updated in place. */
export async function appendMutationOperationReceipt(
	input: AppendMutationOperationReceiptInput,
): Promise<void> {
	await supabaseRestRequest({
		pathWithQuery: 'invitation_mutation_operation_receipts',
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=minimal',
		body: {
			operation_id: input.operationId,
			invitation_id: input.invitationId ?? null,
			environment: input.environment,
			project_ref: input.projectRef,
			actor_id: input.actorId ?? null,
			actor_type: input.actorType,
			origin: input.origin,
			command_kind: input.commandKind,
			input_hashes: sanitizeMutationEvidence(input.inputHashes ?? {}),
			expected_state: sanitizeMutationEvidence(input.expectedState ?? {}),
			status: input.status,
			completed_steps: input.completedSteps ?? [],
			result: sanitizeMutationEvidence(input.result ?? {}),
			sanitized_error: input.error
				? sanitizeMutationEvidence(
						input.error instanceof Error
							? { name: input.error.name, message: input.error.message }
							: { value: input.error },
					)
				: {},
			retry_of_operation_id: input.retryOfOperationId ?? null,
		},
	});
}
