import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { confirmDemoPublish } from '@/lib/content-publication/demo-publish';

const DemoPublishConfirmBodySchema = z.object({
	event_type: z.string().min(1),
	slug: z.string().min(1),
	expected_prod_hash: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		const session = await requireAdminMutationAccess(
			request,
			cookies,
			'admin:demo-publish-confirm',
		);

		const parsed = await validateBodyOrRespond(request, DemoPublishConfirmBodySchema);
		if (parsed instanceof Response) return parsed;

		const result = await confirmDemoPublish({
			eventType: parsed.event_type,
			slug: parsed.slug,
			expectedProdHash: parsed.expected_prod_hash,
			actorUserId: session.userId,
		});
		return jsonResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
