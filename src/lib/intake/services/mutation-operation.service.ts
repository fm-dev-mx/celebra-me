import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import {
	createMutationOutcome,
	type MutationOutcome,
	type MutationOutcomeStatus,
} from '@/lib/intake/mutations/outcome';
import { appendMutationOperationReceipt } from '@/lib/intake/repositories/mutation-operation.repository';
import { findMutationOperationReceipt } from '@/lib/intake/repositories/mutation-operation.repository';

export async function recordInvitationMutationOutcome<Result>(input: {
	context: InvitationMutationCommandContext;
	invitationId?: string | null;
	commandKind: string;
	status: MutationOutcomeStatus;
	completedSteps?: string[];
	result?: Result;
	error?: unknown;
	inputHashes?: Record<string, string>;
	expectedState?: Record<string, unknown>;
}): Promise<MutationOutcome<Result>> {
	const outcome = createMutationOutcome({
		operationId: input.context.operationId,
		status: input.status,
		completedSteps: input.completedSteps,
		result: input.result,
		error: input.error,
		...(input.status === 'replayed' && input.context.retryOfOperationId
			? { replayedFromOperationId: input.context.retryOfOperationId }
			: {}),
	});

	await appendMutationOperationReceipt({
		operationId: input.context.operationId,
		invitationId: input.invitationId,
		environment: input.context.environment,
		projectRef: input.context.projectRef,
		actorId: input.context.actorId,
		actorType: input.context.actorType,
		origin: input.context.origin,
		commandKind: input.commandKind,
		inputHashes: input.inputHashes,
		expectedState: input.expectedState,
		status: input.status,
		completedSteps: input.completedSteps,
		result:
			input.result && typeof input.result === 'object'
				? (input.result as Record<string, unknown>)
				: {},
		error: input.error,
		retryOfOperationId: input.context.retryOfOperationId,
	});

	return outcome;
}

/** Ensure a durable parent exists before appending a retry/replay receipt. */
export async function ensurePartialMutationParent(input: {
	context: InvitationMutationCommandContext;
	invitationId?: string | null;
	commandKind: string;
	completedSteps: string[];
	result?: Record<string, unknown>;
}): Promise<void> {
	const existing = await findMutationOperationReceipt(input.context.operationId);
	if (existing) return;
	await recordInvitationMutationOutcome({
		context: input.context,
		invitationId: input.invitationId,
		commandKind: input.commandKind,
		status: 'partial',
		completedSteps: input.completedSteps,
		result: input.result,
		error: new Error('downstream_receipt_missing_after_durable_mutation'),
	});
}
