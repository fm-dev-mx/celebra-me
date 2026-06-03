import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { uploadAsset } from '@/lib/intake/services/asset.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);

		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || typeof file === 'string') {
			throw new ApiError(400, 'bad_request', 'No se envió ningún archivo.');
		}

		const blob = file as Blob;

		if (!blob.type.startsWith('image/')) {
			throw new ApiError(
				400,
				'bad_request',
				'Tipo de archivo no soportado. Solo se aceptan imágenes.',
			);
		}

		const displayName = (formData.get('displayName') as string) || file.name || undefined;
		const defaultAltText = (formData.get('defaultAltText') as string) || undefined;

		const result = await uploadAsset(
			invitationId,
			blob,
			blob.type,
			displayName,
			defaultAltText,
		);

		return jsonResponse({
			assetId: result.asset.id,
			displayName: result.asset.displayName,
			src: result.src,
			width: result.asset.width,
			height: result.asset.height,
			fileSize: result.asset.fileSize,
		});
	} catch (error) {
		return errorResponse(error);
	}
};
