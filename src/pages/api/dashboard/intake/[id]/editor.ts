import type { APIRoute } from 'astro';
import { requireEditorReadAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { getInvitationEditorContext } from '@/lib/intake/services/invitation-editor.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireEditorReadAccess(request);
		return jsonResponse(await getInvitationEditorContext(requireInvitationId(params.id)));
	} catch (error) {
		return errorResponse(error);
	}
};
