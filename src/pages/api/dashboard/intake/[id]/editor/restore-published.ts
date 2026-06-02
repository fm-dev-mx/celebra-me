import { z } from 'zod';
import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import {
	getInvitationEditorContext,
	restoreInvitationEditorFromPublished,
} from '@/lib/intake/services/invitation-editor.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const RestorePublishedSchema = z.object({ expectedUpdatedAt: z.string().min(1) });

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		const parsed = await validateBodyOrRespond(request, RestorePublishedSchema);
		if (parsed instanceof Response) return parsed;
		await restoreInvitationEditorFromPublished(invitationId, parsed);
		return jsonResponse({ context: await getInvitationEditorContext(invitationId) });
	} catch (error) {
		return errorResponse(error);
	}
};
