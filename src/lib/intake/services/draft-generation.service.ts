import type { InvitationContentDraft } from '@/lib/intake/types';
import {
	findDraftByInvitationId,
	updateDraftStatus,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	applyDraftMutation,
	DraftRevisionConflictError,
} from '@/lib/intake/services/draft-mutation.service';
import type { InvitationMutationCommandContext } from '@/lib/intake/mutations/command-context';
import { recordInvitationMutationOutcome } from '@/lib/intake/services/mutation-operation.service';

export async function createDraftRevision(invitationId: string): Promise<InvitationContentDraft> {
	const draft = await findDraftByInvitationId(invitationId);
	if (!draft) {
		throw new ApiError(404, 'not_found', 'No se encontro un borrador para esta invitación.');
	}
	if (draft.status === 'draft') return draft;
	return updateDraftStatus(draft.id, 'draft');
}
export async function getDraft(invitationId: string): Promise<InvitationContentDraft | null> {
	return findDraftByInvitationId(invitationId);
}

export async function updateDraftContentByInvitation(
	invitationId: string,
	input: { expectedUpdatedAt: string; content: Record<string, unknown> },
	commandContext?: InvitationMutationCommandContext,
): Promise<InvitationContentDraft> {
	let draftSaved = false;
	const draft = await findDraftByInvitationId(invitationId);
	if (!draft) {
		throw new ApiError(404, 'not_found', 'No se encontro un borrador para esta invitación.');
	}

	if (draft.status !== 'draft') {
		throw new ApiError(
			422,
			'invalid_draft_status',
			'Solo se puede editar un borrador en estado "draft". Estado actual: ' + draft.status,
		);
	}

	try {
		const result = await applyDraftMutation({
			invitationId,
			expectedDraftUpdatedAt: input.expectedUpdatedAt,
			patch: { kind: 'overlay', content: input.content },
			actor: 'editor',
		});
		draftSaved = true;
		if (commandContext) {
			await recordInvitationMutationOutcome({
				context: commandContext,
				invitationId,
				commandKind: 'save_legacy_draft',
				status: 'applied',
				completedSteps: ['draft_saved'],
				expectedState: { draftUpdatedAt: input.expectedUpdatedAt },
				result: { draftUpdatedAt: result.draftUpdatedAt },
			});
		}
		return result.draft;
	} catch (error) {
		if (commandContext && !draftSaved) {
			await recordInvitationMutationOutcome({
				context: commandContext,
				invitationId,
				commandKind: 'save_legacy_draft',
				status: 'not_applied',
				expectedState: { draftUpdatedAt: input.expectedUpdatedAt },
				error,
			});
		}
		if (commandContext && draftSaved) {
			throw new ApiError(
				503,
				'internal_error',
				'El borrador se guardó, pero no se pudo registrar el resultado de la operación.',
				{ operationId: commandContext.operationId, status: 'partial' },
			);
		}
		if (error instanceof DraftRevisionConflictError) {
			throw new ApiError(
				409,
				'conflict',
				'Otra persona guardó cambios antes que tú. Recarga los datos para continuar.',
				{ currentDraftUpdatedAt: error.currentDraftUpdatedAt },
			);
		}
		throw error;
	}
}
