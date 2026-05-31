import type { IntakeSubmission } from '@/lib/intake/types';
import { ApiError } from '@/lib/rsvp/core/errors';
import { findInvitationProjectById } from '@/lib/intake/repositories/invitation-project.repository';
import {
	createIntakeRequest,
	findIntakeRequestsByProjectId,
} from '@/lib/intake/repositories/intake-request.repository';
import {
	createIntakeSubmission,
	findSubmissionByRequestId,
	updateIntakeSubmission,
} from '@/lib/intake/repositories/intake-submission.repository';

const INTERNAL_TOKEN_HASH = 'internal-edit';

export async function ensureInternalEditContext(projectId: string) {
	const project = await findInvitationProjectById(projectId);
	if (!project) {
		throw new ApiError(404, 'not_found', 'Proyecto no encontrado.');
	}

	const requests = await findIntakeRequestsByProjectId(projectId);
	const request =
		requests[0] ??
		(await createIntakeRequest({
			invitationProjectId: projectId,
			tokenHash: INTERNAL_TOKEN_HASH,
			tokenCiphertext: null,
			enabledBlocks: project.snapshot.recommendedBlocks,
			expiresAt: null,
		}));

	const submission =
		(await findSubmissionByRequestId(request.id)) ??
		(await createIntakeSubmission({ intakeRequestId: request.id }));

	return { project, request, submission };
}

export async function saveInternalComments(
	submissionId: string,
	clientComments: string,
): Promise<IntakeSubmission> {
	return updateIntakeSubmission(submissionId, { clientComments });
}
