import type { APIRoute } from 'astro';
import { requireEditorReadAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { listAssets } from '@/lib/intake/services/asset.service';
import { findInvitationById } from '@/lib/intake/repositories/invitation.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { resolveAssetSlug } from '@/lib/assets/asset-slug';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';

export const GET: APIRoute = async ({ request, params }) => {
	try {
		await requireEditorReadAccess(request);
		const invitationId = requireInvitationId(params.id);
		const url = new URL(request.url);
		const filter =
			(url.searchParams.get('filter') as 'active' | 'archived' | null) ?? undefined;
		const invitation = await findInvitationById(invitationId);
		if (!invitation) {
			return jsonResponse({ error: 'Invitación no encontrada' }, 404);
		}
		if (filter === 'archived') {
			const assets = await listAssets(invitationId, undefined, filter);
			return jsonResponse({ assets });
		}
		const published = await findPublishedByInvitationId(invitationId);
		const assetSlug = resolveAssetSlug(invitation, published?.content);
		const assets = await listAssets(invitationId, assetSlug, filter);
		return jsonResponse({ assets });
	} catch (error) {
		return errorResponse(error);
	}
};
