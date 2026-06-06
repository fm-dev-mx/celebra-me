import type { APIRoute } from 'astro';
import { z } from 'zod';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { dryRunDemoPublish } from '@/lib/content-publication/demo-publish';

const DemoPublishBodySchema = z.object({
	event_type: z.string().min(1),
	slug: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminRateLimit(request, 'admin:demo-publish-dry-run');
		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}
		await requireAdminStrongSession(request);

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
