import type { IntakeRequest, IntakeBlockType, IntakeSubmission } from '@/lib/intake/types';
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
import { hashIntakeToken } from '@/lib/intake/services/intake-token.service';
import { getBlockTypesForEventType } from '@/lib/intake/blocks';

async function findOrCreateInternalRequest(
	projectId: string,
	enabledBlocks: IntakeBlockType[],
): Promise<IntakeRequest> {
	const requests = await findIntakeRequestsByProjectId(projectId);
	const existing = requests.find((r) => r.origin === 'internal');
	if (existing) return existing;

	return createIntakeRequest({
		invitationProjectId: projectId,
		tokenHash: hashIntakeToken(`internal-edit:${projectId}`),
		tokenCiphertext: null,
		origin: 'internal',
		enabledBlocks,
		expiresAt: null,
	});
}

async function findOrCreateSubmission(
	internalRequestId: string,
	seedData: Record<string, unknown>,
): Promise<IntakeSubmission> {
	const existing = await findSubmissionByRequestId(internalRequestId);
	if (existing) return existing;
	return createIntakeSubmission({
		intakeRequestId: internalRequestId,
		blockData: seedData,
	});
}

export async function ensureInternalEditContext(projectId: string) {
	const project = await findInvitationProjectById(projectId);
	if (!project) {
		throw new ApiError(404, 'not_found', 'Proyecto no encontrado.');
	}

	const requests = await findIntakeRequestsByProjectId(projectId);
	const clientRequest = requests.find((r) => r.origin === 'client');
	const clientSubmission = clientRequest
		? await findSubmissionByRequestId(clientRequest.id)
		: null;

	let enabledBlocks = clientRequest?.enabledBlocks ?? project.snapshot.recommendedBlocks;
	if (!enabledBlocks || enabledBlocks.length === 0) {
		enabledBlocks = getBlockTypesForEventType(project.eventType);
	}

	const request = await findOrCreateInternalRequest(projectId, enabledBlocks);
	const submission = await findOrCreateSubmission(request.id, clientSubmission?.blockData ?? {});

	return { project, request, submission };
}

export async function saveInternalComments(
	submissionId: string,
	clientComments: string,
): Promise<IntakeSubmission> {
	return updateIntakeSubmission(submissionId, {
		status: 'approved',
		clientComments,
		reviewedAt: new Date().toISOString(),
	});
}
