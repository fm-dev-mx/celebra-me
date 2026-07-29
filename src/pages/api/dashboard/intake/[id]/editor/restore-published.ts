import { z } from 'zod';
import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import {
	getInvitationEditorContext,
	restoreInvitationEditorFromPublished,
} from '@/lib/intake/services/invitation-editor.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { createRuntimeMutationCommandContext } from '@/lib/server/runtime-mutation-context';

const RestorePublishedSchema = z.object({
	operationId: z.uuid(),
	expectedDraftUpdatedAt: z.string().min(1).nullable(),
	expectedInvitationUpdatedAt: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		const parsed = await validateBodyOrRespond(request, RestorePublishedSchema);
		if (parsed instanceof Response) return parsed;
		await restoreInvitationEditorFromPublished(
			invitationId,
			parsed,
			await createRuntimeMutationCommandContext(session, 'editor', parsed.operationId),
		);
		return jsonResponse({ context: await getInvitationEditorContext(invitationId) });
	} catch (error) {
		return errorResponse(error);
	}
};
