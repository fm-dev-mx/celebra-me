import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import {
	deleteAsset,
	updateAssetMetadata,
	restoreAsset,
} from '@/lib/intake/services/asset.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';

function guardAssetId(assetId: string | undefined): asserts assetId is string {
	if (!assetId) {
		throw new ApiError(400, 'bad_request', 'No se especificó el recurso.');
	}
}

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		guardAssetId(params.assetId);

		await deleteAsset(invitationId, params.assetId);
		return jsonResponse({ success: true });
	} catch (error) {
		return errorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		guardAssetId(params.assetId);

		const body = (await request.json()) as { displayName?: string; defaultAltText?: string };

		const updated = await updateAssetMetadata(
			params.assetId,
			{ displayName: body.displayName, defaultAltText: body.defaultAltText },
			invitationId,
		);

		return jsonResponse({ asset: updated });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		guardAssetId(params.assetId);

		const updated = await restoreAsset(params.assetId, invitationId);

		return jsonResponse({ asset: updated });
	} catch (error) {
		return errorResponse(error);
	}
};
