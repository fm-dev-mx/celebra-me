import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { confirmDemoPublish } from '@/lib/content-publication/demo-publish';

const DemoPublishConfirmBodySchema = z.object({
	event_type: z.string().min(1),
	slug: z.string().min(1),
	expected_prod_hash: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminRateLimit(request, 'admin:demo-publish-confirm');
		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}
		const session = await requireAdminStrongSession(request);

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
