import type { APIRoute } from 'astro';
import { requireEditorReadAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { listAssets } from '@/lib/intake/services/asset.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireEditorReadAccess(request);
		const invitationId = requireInvitationId(params.id);
		const assets = await listAssets(invitationId);
		return jsonResponse({ assets });
	} catch (error) {
		return errorResponse(error);
	}
};
