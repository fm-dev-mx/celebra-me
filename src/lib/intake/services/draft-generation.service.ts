import type { InvitationContentDraft } from '@/lib/intake/types';
import { findInvitationProjectById } from '@/lib/intake/repositories/invitation-project.repository';
import { getIntakeRequestsByProjectId } from '@/lib/intake/services/intake-request.service';
import { getSubmissionByRequestId } from '@/lib/intake/services/intake-submission.service';
import {
	findDraftByProjectId,
	updateDraftContent,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { createIntakeRequest } from '@/lib/intake/repositories/intake-request.repository';
import { createIntakeSubmission } from '@/lib/intake/repositories/intake-submission.repository';
import { mapBlockDataToDraftContent } from '@/lib/intake/services/draft-content-mapper';
import { ApiError } from '@/lib/rsvp/core/errors';

function deepMerge(
	base: Record<string, unknown>,
	overlay: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...base };
	for (const key of Object.keys(overlay)) {
		const baseVal = result[key];
		const overlayVal = overlay[key];
		if (
			baseVal !== null &&
			overlayVal !== null &&
			typeof baseVal === 'object' &&
			typeof overlayVal === 'object' &&
			!Array.isArray(baseVal) &&
			!Array.isArray(overlayVal)
		) {
			result[key] = deepMerge(
				baseVal as Record<string, unknown>,
				overlayVal as Record<string, unknown>,
			);
		} else {
			result[key] = overlayVal;
		}
	}
	return result;
}

export async function generateDraft(projectId: string): Promise<InvitationContentDraft> {
	const project = await findInvitationProjectById(projectId);
	if (!project) {
		throw new ApiError(404, 'not_found', 'Invitation project not found.');
	}

	// Must have an approved intake submission to generate a draft
	const requests = await getIntakeRequestsByProjectId(projectId);
	const activeRequest = requests[0];
	if (!activeRequest) {
		throw new ApiError(
			422,
			'no_approved_submission',
			'No se encontró una captura de cliente. El cliente debe enviar su información antes de generar un borrador.',
		);
	}

	const sub = await getSubmissionByRequestId(activeRequest.id);
	if (!sub || sub.status !== 'approved') {
		throw new ApiError(
			422,
			'no_approved_submission',
			'La captura del cliente debe estar aprobada antes de generar un borrador. Revisa la captura en la página de revisión.',
		);
	}

	const content = mapBlockDataToDraftContent(
		sub.blockData,
		activeRequest.enabledBlocks,
	) as Record<string, unknown>;

	return upsertDraft({
		invitationProjectId: projectId,
		submissionId: sub.id,
		content,
	});
}

/**
 * Creates a draft from admin-provided content by persisting through a real
 * intake submission. The submission is left as `in_progress` (not `approved`)
 * to distinguish it from client-submitted data. Intended for dashboard direct
 * editing only — not exposed via any client API.
 */
export async function createDraftFromAdmin(
	projectId: string,
	content: Record<string, unknown>,
): Promise<InvitationContentDraft> {
	const project = await findInvitationProjectById(projectId);
	if (!project) {
		throw new ApiError(404, 'not_found', 'Invitation project not found.');
	}

	// Persist content through a real intake chain so it has a durable source.
	// tokenHash prefix identifies this as admin-created vs client intake.
	const request = await createIntakeRequest({
		invitationProjectId: projectId,
		tokenHash: 'admin-created-' + projectId.slice(0, 8),
		tokenCiphertext: '',
		enabledBlocks: [],
		expiresAt: null,
	});

	const submission = await createIntakeSubmission({
		intakeRequestId: request.id,
		blockData: content,
	});

	return upsertDraft({
		invitationProjectId: projectId,
		submissionId: submission.id,
		content,
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

	const existing = (draft.content ?? {}) as Record<string, unknown>;
	const merged = deepMerge(existing, content);

	return updateDraftContent(draft.id, merged);
}
