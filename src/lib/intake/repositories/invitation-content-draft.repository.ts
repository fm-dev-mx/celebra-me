import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { InvitationContentDraft } from '@/lib/intake/types';

interface InvitationContentDraftRow {
	id: string;
	invitation_project_id: string;
	submission_id: string;
	content: Record<string, unknown>;
	status: string;
	created_at: string;
	updated_at: string;
}

function toDraft(row: InvitationContentDraftRow): InvitationContentDraft {
	return {
		id: row.id,
		invitationProjectId: row.invitation_project_id,
		submissionId: row.submission_id,
		content: row.content,
		status: row.status as InvitationContentDraft['status'],
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const SELECT_COLUMNS =
	'id,invitation_project_id,submission_id,content,status,created_at,updated_at';

export async function findDraftByProjectId(
	invitationProjectId: string,
): Promise<InvitationContentDraft | null> {
	const rows = await supabaseRestRequest<InvitationContentDraftRow[]>({
		pathWithQuery: `invitation_content_drafts?select=${SELECT_COLUMNS}&invitation_project_id=eq.${encodeURIComponent(invitationProjectId)}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toDraft(rows[0]) : null;
}

export async function upsertDraft(input: {
	invitationProjectId: string;
	submissionId: string;
	content: Record<string, unknown>;
}): Promise<InvitationContentDraft> {
	const existing = await findDraftByProjectId(input.invitationProjectId);

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
			invitation_project_id: input.invitationProjectId,
			submission_id: input.submissionId,
			content: input.content,
			status: 'draft',
		},
	});

	if (!rows[0]) throw new Error('Failed to create invitation content draft.');
	return toDraft(rows[0]);
}
