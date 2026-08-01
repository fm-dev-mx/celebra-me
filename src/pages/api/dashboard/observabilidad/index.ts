import type { APIRoute } from 'astro';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { requireLocalObservabilityAccess } from '@/lib/observability/access';
import { buildObservabilitySnapshot } from '@/lib/observability/server/snapshot';

export const prerender = false;

/** Canonical rate-limit key for this route — must exist in admin-rate-limit.ts. */
export const OBSERVABILITY_RATE_LIMIT_OPERATION = 'admin:observabilidad' as const;

export const GET: APIRoute = async ({ request }) => {
	try {
		// 1) strong super_admin → 2) Local runtime → 3) rate limit → 4) probes
		const session = await requireLocalObservabilityAccess(request);
		await requireAdminRateLimit(request, OBSERVABILITY_RATE_LIMIT_OPERATION, session.userId);

		const snapshot = await buildObservabilitySnapshot();
		return withPrivateCache(jsonResponse(snapshot));
	} catch (error) {
		return withPrivateCache(errorResponse(error));
	}
};
