import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminMutationAccess } from '@/lib/rsvp/auth/authorization';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { dryRunDemoPublish } from '@/lib/content-publication/demo-publish';

const DemoPublishBodySchema = z.object({
	event_type: z.string().min(1),
	slug: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminMutationAccess(request, cookies, 'admin:demo-publish-dry-run');

		const parsed = await validateBodyOrRespond(request, DemoPublishBodySchema);
		if (parsed instanceof Response) return parsed;

		const result = await dryRunDemoPublish({
			eventType: parsed.event_type,
			slug: parsed.slug,
		});
		return jsonResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};
