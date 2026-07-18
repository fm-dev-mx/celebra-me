import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { getInvitationEditorContext } from '@/lib/intake/services/invitation-editor.service';
import { publishDraft } from '@/lib/intake/services/publishing.service';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';

const PublishPreflightSchema = z.object({
	draftRevision: z.string().min(1),
	publishedVersion: z.number().int().positive().nullable(),
	publicMetadataHash: z.string().regex(/^[a-f0-9]{32}$/),
	projectionHash: z.string().regex(/^[a-f0-9]{32}$/),
	idempotencyKey: z.uuid(),
});

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		const result = await publishDraft(
			invitationId,
			PublishPreflightSchema.parse(await request.json()),
		);
		const response = jsonResponse({
			publishedContent: result.publishedContent,
			idempotent: result.idempotent ?? false,
			context: await getInvitationEditorContext(invitationId),
		});
		response.headers.set('Cache-Control', 'no-store, private');
		return response;
	} catch (error) {
		const response = errorResponse(error);
		response.headers.set('Cache-Control', 'no-store, private');
		return response;
	}
};
