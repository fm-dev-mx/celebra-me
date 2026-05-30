import type { InvitationContentDraft } from '@/lib/intake/types';
import { findInvitationProjectById } from '@/lib/intake/repositories/invitation-project.repository';
import { getIntakeRequestsByProjectId } from '@/lib/intake/services/intake-request.service';
import { getSubmissionByRequestId } from '@/lib/intake/services/intake-submission.service';
import {
	findDraftByProjectId,
	updateDraftContent,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
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

	// Try to use submission data if available and approved
	const requests = await getIntakeRequestsByProjectId(projectId);
	const activeRequest = requests[0];
	let submissionId = '';
	let content: Record<string, unknown> = {};

	if (activeRequest) {
		const sub = await getSubmissionByRequestId(activeRequest.id);
		if (sub && sub.status === 'approved') {
			submissionId = sub.id;
			content = mapBlockDataToDraftContent(
				sub.blockData,
				activeRequest.enabledBlocks,
			) as Record<string, unknown>;
		}
	}

	// If no submission data, check for existing draft content
	if (!submissionId) {
		const existingDraft = await findDraftByProjectId(projectId);
		if (existingDraft) {
			content = existingDraft.content as Record<string, unknown>;
			submissionId = existingDraft.submissionId;
		}
	}

	// If still no content, start with demo defaults using the project's snapshot
	if (Object.keys(content).length === 0 && project.snapshot) {
		const defaultSections = project.snapshot.defaultSections ?? [];
		for (const section of defaultSections) {
			content[section] = {};
		}
	}

	// If no submission exists, create a minimal intake chain for draft support
	if (!submissionId) {
		const requestRows = await supabaseRestRequest<Array<{ id: string }>>({
			pathWithQuery: `intake_requests?select=id`,
			method: 'POST',
			useServiceRole: true,
			prefer: 'return=representation',
			body: {
				invitation_project_id: projectId,
				token_hash: 'adopted-legacy',
				status: 'active',
				enabled_blocks: [],
				expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
			},
		});
		if (!requestRows[0])
			throw new ApiError(500, 'internal_error', 'Failed to create intake request.');
		const newRequestId = requestRows[0].id;

		const subRows = await supabaseRestRequest<Array<{ id: string }>>({
			pathWithQuery: `intake_submissions?select=id`,
			method: 'POST',
			useServiceRole: true,
			prefer: 'return=representation',
			body: {
				intake_request_id: newRequestId,
				status: 'approved',
				block_data: {},
			},
		});
		if (!subRows[0]) throw new ApiError(500, 'internal_error', 'Failed to create submission.');
		submissionId = subRows[0].id;
	}

	return upsertDraft({
		invitationProjectId: projectId,
		submissionId,
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
