import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireEditorMutationAccess, requireInvitationId } from '@/lib/intake/editor-api';
import { getInvitationEditorContext } from '@/lib/intake/services/invitation-editor.service';
import { publishDraft } from '@/lib/intake/services/publishing.service';
import { errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { createRuntimeMutationCommandContext } from '@/lib/server/runtime-mutation-context';

const PublishPreflightSchema = z.object({
	draftRevision: z.string().min(1),
	publishedVersion: z.number().int().positive().nullable(),
	publicMetadataHash: z.string().regex(/^[a-f0-9]{32}$/),
	projectionHash: z.string().regex(/^[a-f0-9]{32}$/),
	idempotencyKey: z.uuid(),
});

export const POST: APIRoute = async ({ request, cookies, params }) => {
	try {
		const session = await requireEditorMutationAccess(request, cookies);
		const invitationId = requireInvitationId(params.id);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const preflight = PublishPreflightSchema.parse(bodyResult);
		const result = await publishDraft(
			invitationId,
			preflight,
			await createRuntimeMutationCommandContext(session, 'editor', preflight.idempotencyKey),
		);
		const response = jsonResponse({
			publishedContent: result.publishedContent,
			idempotent: result.idempotent ?? false,
			outcome: result.outcome,
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
