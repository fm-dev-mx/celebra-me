import type { APIRoute } from 'astro';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireLocalObservabilityAccess } from '@/lib/observability/access';
import {
	buildObservabilitySnapshot,
	buildObservabilitySummaryPayload,
} from '@/lib/observability/server/snapshot';

export const prerender = false;

/** Canonical rate-limit key for this route — must exist in admin-rate-limit.ts. */
export const OBSERVABILITY_RATE_LIMIT_OPERATION = 'admin:observabilidad' as const;

export const GET: APIRoute = async ({ request }) => {
	try {
		// 1) strong super_admin → 2) Local runtime → 3) rate limit → 4) probes
		const session = await requireLocalObservabilityAccess(request);
		await requireAdminRateLimit(request, OBSERVABILITY_RATE_LIMIT_OPERATION, session.userId);

		const url = new URL(request.url);
		const mode = url.searchParams.get('mode');

		if (mode !== null && mode !== 'summary' && mode !== 'detail') {
			throw new ApiError(
				400,
				'bad_request',
				'Parámetro mode inválido. Valores permitidos: summary, detail.',
			);
		}

		if (mode === 'detail') {
			const snapshot = await buildObservabilitySnapshot();
			return withPrivateCache(jsonResponse(snapshot));
		}

		const summary = await buildObservabilitySummaryPayload();
		return withPrivateCache(jsonResponse(summary));
	} catch (error) {
		return withPrivateCache(errorResponse(error));
	}
};
