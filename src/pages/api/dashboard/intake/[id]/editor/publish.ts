import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { getInvitationEditorContext } from '@/lib/intake/services/invitation-editor.service';
import { publishDraft } from '@/lib/intake/services/publishing.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		const result = await publishDraft(invitationId);
		return jsonResponse({
			publishedContent: result.publishedContent,
			context: await getInvitationEditorContext(invitationId),
		});
	} catch (error) {
		return errorResponse(error);
	}
};
