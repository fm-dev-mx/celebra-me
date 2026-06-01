import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { reconcileInvitationRsvp } from '@/lib/intake/services/invitation-editor.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		return jsonResponse(await reconcileInvitationRsvp(requireInvitationId(params.id)));
	} catch (error) {
		return errorResponse(error);
	}
};
