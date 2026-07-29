import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { UpdateInvitationEditorMetadataSchema } from '@/lib/intake/schemas/invitation-editor.schema';
import { saveInvitationEditorMetadata } from '@/lib/intake/services/invitation-editor.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { createRuntimeMutationCommandContext } from '@/lib/server/runtime-mutation-context';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireEditorMutationAccess(request, cookies);
		const parsed = await validateBodyOrRespond(request, UpdateInvitationEditorMetadataSchema);
		if (parsed instanceof Response) return parsed;
		const commandContext = await createRuntimeMutationCommandContext(
			session,
			'editor',
			parsed.operationId,
		);
		return jsonResponse(
			await saveInvitationEditorMetadata(
				requireInvitationId(params.id),
				parsed,
				commandContext,
			),
		);
	} catch (error) {
		return errorResponse(error);
	}
};
