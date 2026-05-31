import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { InvitationContentDraft, InvitationContentDraftStatus } from '@/lib/intake/types';
import { ACTIVE_FILTER } from '@/lib/intake/repositories/_constants';

interface InvitationContentDraftRow {
	id: string;
	invitation_project_id: string;
	submission_id: string | null;
	content: Record<string, unknown>;
	status: string;
	created_at: string;
	updated_at: string;
}

function toDraft(row: InvitationContentDraftRow): InvitationContentDraft {
	return {
		id: row.id,
		invitationId: row.invitation_project_id,
		submissionId: row.submission_id,
		content: row.content,
		status: row.status as InvitationContentDraft['status'],
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const SELECT_COLUMNS =
	'id,invitation_project_id,submission_id,content,status,created_at,updated_at';

export async function findDraftByInvitationId(
	invitationId: string,
): Promise<InvitationContentDraft | null> {
	const rows = await supabaseRestRequest<InvitationContentDraftRow[]>({
		pathWithQuery: `invitation_content_drafts?select=${SELECT_COLUMNS}&invitation_project_id=eq.${encodeURIComponent(invitationId)}&${ACTIVE_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toDraft(rows[0]) : null;
}

export async function updateDraftContent(
	draftId: string,
	content: Record<string, unknown>,
): Promise<InvitationContentDraft> {
	const rows = await supabaseRestRequest<InvitationContentDraftRow[]>({
		pathWithQuery: `invitation_content_drafts?id=eq.${encodeURIComponent(draftId)}&select=${SELECT_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			content,
		},
	});

	if (!rows[0]) throw new Error('Invitation content draft not found.');
	return toDraft(rows[0]);
}

export async function upsertDraft(input: {
	invitationId: string;
	submissionId: string | null;
	content: Record<string, unknown>;
}): Promise<InvitationContentDraft> {
	const existing = await findDraftByInvitationId(input.invitationId);

	if (existing) {
		const rows = await supabaseRestRequest<InvitationContentDraftRow[]>({
			pathWithQuery: `invitation_content_drafts?id=eq.${encodeURIComponent(existing.id)}&select=${SELECT_COLUMNS}`,
			method: 'PATCH',
			useServiceRole: true,
			prefer: 'return=representation',
			body: {
				submission_id: input.submissionId,
				content: input.content,
				status: 'draft',
			},
		});
		if (!rows[0]) throw new Error('Failed to update invitation content draft.');
		return toDraft(rows[0]);
	}

	const rows = await supabaseRestRequest<InvitationContentDraftRow[]>({
		pathWithQuery: `invitation_content_drafts?select=${SELECT_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			invitation_project_id: input.invitationId,
			submission_id: input.submissionId,
			content: input.content,
			status: 'draft',
		},
	});

	if (!rows[0]) throw new Error('Failed to create invitation content draft.');
	return toDraft(rows[0]);
}

export async function updateDraftStatus(
	draftId: string,
	status: InvitationContentDraftStatus,
): Promise<InvitationContentDraft> {
	const rows = await supabaseRestRequest<InvitationContentDraftRow[]>({
		pathWithQuery: `invitation_content_drafts?id=eq.${encodeURIComponent(draftId)}&select=${SELECT_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			status,
		},
	});
	if (!rows[0]) throw new Error('Invitation content draft not found.');
	return toDraft(rows[0]);
}
