import type { APIRoute } from 'astro';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import {
	InvitationEditorSectionKeySchema,
	SaveInvitationEditorSectionSchema,
} from '@/lib/intake/schemas/invitation-editor.schema';
import { saveInvitationEditorSection } from '@/lib/intake/services/invitation-editor.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const sectionResult = InvitationEditorSectionKeySchema.safeParse(params.section);
		if (!sectionResult.success) {
			throw new ApiError(404, 'not_found', 'No se encontró la sección solicitada.');
		}
		const parsed = await validateBodyOrRespond(request, SaveInvitationEditorSectionSchema);
		if (parsed instanceof Response) return parsed;
		return jsonResponse(
			await saveInvitationEditorSection(
				requireInvitationId(params.id),
				sectionResult.data,
				parsed,
			),
		);
	} catch (error) {
		return errorResponse(error);
	}
};
