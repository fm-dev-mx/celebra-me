import type { APIRoute } from 'astro';
import { requireEditorReadAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { getPublicationPreflight } from '@/lib/intake/services/publishing.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireEditorReadAccess(request);
		const response = jsonResponse(
			await getPublicationPreflight(requireInvitationId(params.id)),
		);
		response.headers.set('Cache-Control', 'no-store, private');
		return response;
	} catch (error) {
		const response = errorResponse(error);
		response.headers.set('Cache-Control', 'no-store, private');
		return response;
	}
};
