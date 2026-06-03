import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { deleteAsset } from '@/lib/intake/services/asset.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);

		if (!params.assetId) {
			throw new ApiError(400, 'bad_request', 'No se especificó el recurso a eliminar.');
		}

		await deleteAsset(invitationId, params.assetId);
		return jsonResponse({ success: true });
	} catch (error) {
		return errorResponse(error);
	}
};
