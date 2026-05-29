import type { InvitationContentDraft } from '@/lib/intake/types';
import { getInvitationProjectById } from '@/lib/intake/services/invitation-project.service';
import { getIntakeRequestsByProjectId } from '@/lib/intake/services/intake-request.service';
import { getSubmissionByRequestId } from '@/lib/intake/services/intake-submission.service';
import {
	findDraftByProjectId,
	updateDraftContent,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { mapBlockDataToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import { ApiError } from '@/lib/rsvp/core/errors';

export async function generateDraft(projectId: string): Promise<InvitationContentDraft> {
	const project = await getInvitationProjectById(projectId);
	if (!project) {
		throw new ApiError(404, 'not_found', 'Invitation project not found.');
	}

	const requests = await getIntakeRequestsByProjectId(projectId);
	const activeRequest = requests[0];
	if (!activeRequest) {
		throw new ApiError(404, 'not_found', 'No intake request found for this project.');
	}

	const submission = await getSubmissionByRequestId(activeRequest.id);
	if (!submission) {
		throw new ApiError(404, 'not_found', 'No submission found for this request.');
	}

	if (submission.status !== 'approved') {
		throw new ApiError(
			422,
			'invalid_submission_status',
			'La captura debe estar aprobada para generar un borrador. Estado actual: ' +
				submission.status,
		);
	}

	const content = mapBlockDataToDraftContent(submission.blockData, activeRequest.enabledBlocks);

	return upsertDraft({
		invitationProjectId: projectId,
		submissionId: submission.id,
		content: content as Record<string, unknown>,
	});
}

export async function getDraft(projectId: string): Promise<InvitationContentDraft | null> {
	return findDraftByProjectId(projectId);
}

export async function updateDraftContentByProject(
	projectId: string,
	content: Record<string, unknown>,
): Promise<InvitationContentDraft> {
	const draft = await findDraftByProjectId(projectId);
	if (!draft) {
		throw new ApiError(404, 'not_found', 'No se encontro un borrador para este proyecto.');
	}

	if (draft.status !== 'draft') {
		throw new ApiError(
			422,
			'invalid_draft_status',
			'Solo se puede editar un borrador en estado "draft". Estado actual: ' + draft.status,
		);
	}

	return updateDraftContent(draft.id, content);
}
