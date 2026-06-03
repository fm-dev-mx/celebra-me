import type { APIRoute } from 'astro';
import { requireEditorReadAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { listAssets } from '@/lib/intake/services/asset.service';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireEditorReadAccess(request);
		const invitationId = requireInvitationId(params.id);
		const url = new URL(request.url);
		const filter =
			(url.searchParams.get('filter') as 'active' | 'archived' | null) ?? undefined;
		const invitation = await findInvitationById(invitationId);
		const previewSlug = filter === 'archived' ? undefined : invitation?.snapshot?.previewSlug;
		const assets = await listAssets(invitationId, previewSlug, filter);
		return jsonResponse({ assets });
	} catch (error) {
		return errorResponse(error);
	}
};
