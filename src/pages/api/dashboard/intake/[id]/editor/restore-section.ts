import { z } from 'zod';
import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { InvitationEditorSectionKeySchema } from '@/lib/intake/schemas/invitation-editor.schema';
import {
	getInvitationEditorContext,
	restoreInvitationEditorSection,
} from '@/lib/intake/services/invitation-editor.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

const RestoreSectionSchema = z.object({
	section: InvitationEditorSectionKeySchema,
	expectedDraftUpdatedAt: z.string().min(1).nullable(),
});

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		const parsed = await validateBodyOrRespond(request, RestoreSectionSchema);
		if (parsed instanceof Response) return parsed;
		await restoreInvitationEditorSection(invitationId, parsed);
		return jsonResponse({ context: await getInvitationEditorContext(invitationId) });
	} catch (error) {
		return errorResponse(error);
	}
};
