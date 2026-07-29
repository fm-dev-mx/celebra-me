import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import {
	createMutationOutcome,
	type MutationOutcome,
	type MutationOutcomeStatus,
} from '@/lib/intake/mutations/outcome';
import { appendMutationOperationReceipt } from '@/lib/intake/repositories/mutation-operation.repository';

export async function recordInvitationMutationOutcome<Result>(input: {
	context: InvitationMutationCommandContext;
	invitationId: string;
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
