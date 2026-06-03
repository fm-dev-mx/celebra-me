import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { importDemoAsset } from '@/lib/intake/services/asset.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);

		const body = (await request.json()) as { demoKey?: string };
		if (!body.demoKey) {
			throw new ApiError(
				400,
				'bad_request',
				'No se especificó la clave de la imagen de demo.',
			);
		}

		const result = await importDemoAsset(invitationId, body.demoKey, request.url);

		return jsonResponse({
			assetId: result.asset.id,
			displayName: result.asset.displayName,
			src: result.src,
		});
	} catch (error) {
		return errorResponse(error);
	}
};
