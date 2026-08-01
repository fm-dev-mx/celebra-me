import type { APIRoute } from 'astro';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { requireLocalObservabilityAccess } from '@/lib/observability/access';
import { buildObservabilitySnapshot } from '@/lib/observability/server/snapshot';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'admin:observabilidad');
		await requireLocalObservabilityAccess(request);

		const snapshot = await buildObservabilitySnapshot();
		return withPrivateCache(jsonResponse(snapshot));
	} catch (error) {
		return withPrivateCache(errorResponse(error));
	}
};
