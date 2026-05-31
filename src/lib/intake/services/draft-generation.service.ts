import type { InvitationContentDraft } from '@/lib/intake/types';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { getIntakeRequestsByInvitationId } from '@/lib/intake/services/intake-request.service';
import { getSubmissionByRequestId } from '@/lib/intake/services/intake-submission.service';
import {
	findDraftByInvitationId,
	updateDraftContent,
	updateDraftStatus,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { createIntakeRequest } from '@/lib/intake/repositories/intake-request.repository';
import { createIntakeSubmission } from '@/lib/intake/repositories/intake-submission.repository';
import { mapBlockDataToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import { deepMerge } from '@/lib/intake/utils';
import { ApiError } from '@/lib/rsvp/core/errors';

export async function generateDraft(invitationId: string): Promise<InvitationContentDraft> {
	const invitation = await findInvitationById(invitationId);
	if (!invitation) {
		throw new ApiError(404, 'not_found', 'Invitation not found.');
	}

	// Must have an approved intake submission to generate a draft
	const requests = await getIntakeRequestsByInvitationId(invitationId);
	if (requests.length === 0) {
		throw new ApiError(
			422,
			'no_approved_submission',
			'No se encontró una captura de cliente. El cliente debe enviar su información antes de generar un borrador.',
		);
	}

	const findByOrigin = async (origin: string) => {
		const req = requests.find((r) => r.origin === origin);
		if (!req) return null;
		const sub = await getSubmissionByRequestId(req.id);
		return sub?.status === 'approved' ? { request: req, submission: sub } : null;
	};
	const result = (await findByOrigin('internal')) ?? (await findByOrigin('client'));
	if (!result) {
		throw new ApiError(
			422,
			'no_approved_submission',
			'La captura del cliente debe estar aprobada antes de generar un borrador. Revisa la captura en la página de revisión.',
		);
	}

	const content = mapBlockDataToDraftContent(
		result.submission.blockData,
		result.request.enabledBlocks,
	) as Record<string, unknown>;

	return upsertDraft({
		invitationId: invitationId,
		submissionId: result.submission.id,
		content,
	});
}

export async function createDraftRevision(invitationId: string): Promise<InvitationContentDraft> {
	const draft = await findDraftByInvitationId(invitationId);
	if (!draft) {
		throw new ApiError(404, 'not_found', 'No se encontro un borrador para esta invitación.');
	}
	if (draft.status === 'draft') return draft;
	return updateDraftStatus(draft.id, 'draft');
}

/**
 * Creates a draft from admin-provided content by persisting through a real
 * intake submission. The submission is left as `in_progress` (not `approved`)
 * to distinguish it from client-submitted data. Intended for dashboard direct
 * editing only — not exposed via any client API.
 */
export async function createDraftFromAdmin(
	invitationId: string,
	content: Record<string, unknown>,
): Promise<InvitationContentDraft> {
	const invitation = await findInvitationById(invitationId);
	if (!invitation) {
		throw new ApiError(404, 'not_found', 'Invitation not found.');
	}

	// Persist content through a real intake chain so it has a durable source.
	// tokenHash prefix identifies this as admin-created vs client intake.
	const request = await createIntakeRequest({
		invitationId: invitationId,
		tokenHash: 'admin-created-' + invitationId.slice(0, 8),
		tokenCiphertext: '',
		origin: 'internal',
		enabledBlocks: [],
		expiresAt: null,
	});

	const submission = await createIntakeSubmission({
		intakeRequestId: request.id,
		blockData: content,
	});

	return upsertDraft({
		invitationId: invitationId,
		submissionId: submission.id,
		content,
	});
}

export async function getDraft(invitationId: string): Promise<InvitationContentDraft | null> {
	return findDraftByInvitationId(invitationId);
}

export async function updateDraftContentByInvitation(
	invitationId: string,
	content: Record<string, unknown>,
): Promise<InvitationContentDraft> {
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

	const existing = (draft.content ?? {}) as Record<string, unknown>;
	const merged = deepMerge(existing, content);

	return updateDraftContent(draft.id, merged);
}
