import type { IntakeRequest, IntakeBlockType, IntakeSubmission } from '@/lib/intake/types';
import { INTAKE_BLOCK_TYPES } from '@/lib/intake/types';
import { ApiError } from '@/lib/rsvp/core/errors';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import {
	createIntakeRequest,
	findIntakeRequestsByInvitationId,
} from '@/lib/intake/repositories/intake-request.repository';
import {
	createIntakeSubmission,
	findSubmissionByRequestId,
	updateIntakeSubmission,
} from '@/lib/intake/repositories/intake-submission.repository';
import { hashIntakeToken } from '@/lib/intake/services/intake-token.service';

async function findOrCreateInternalRequest(
	invitationId: string,
	enabledBlocks: IntakeBlockType[],
): Promise<IntakeRequest> {
	const requests = await findIntakeRequestsByInvitationId(invitationId);
	const existing = requests.find((r) => r.origin === 'internal');
	if (existing) return existing;

	return createIntakeRequest({
		invitationId: invitationId,
		tokenHash: hashIntakeToken(`internal-edit:${invitationId}`),
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

export async function ensureAdminEditContext(invitationId: string) {
	const invitation = await findInvitationById(invitationId);
	if (!invitation) {
		throw new ApiError(404, 'not_found', 'Invitación no encontrada.');
	}

	const requests = await findIntakeRequestsByInvitationId(invitationId);
	const clientRequest = requests.find((r) => r.origin === 'client');
	const clientSubmission = clientRequest
		? await findSubmissionByRequestId(clientRequest.id)
		: null;

	let enabledBlocks = clientRequest?.enabledBlocks ?? invitation.snapshot.recommendedBlocks;
	if (!enabledBlocks || enabledBlocks.length === 0) {
		enabledBlocks = [...INTAKE_BLOCK_TYPES];
	}

	const request = await findOrCreateInternalRequest(invitationId, enabledBlocks);
	const submission = await findOrCreateSubmission(request.id, clientSubmission?.blockData ?? {});

	return { invitation, request, submission };
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
