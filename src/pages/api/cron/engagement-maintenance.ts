import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { runEngagementMaintenance } from '@/lib/rsvp/engagement/engagement-maintenance.service';
import { getEnv } from '@/lib/server/env';

export const prerender = false;

function isAuthorizedCronRequest(request: Request, secret: string): boolean {
	const provided = Buffer.from(request.headers.get('authorization') ?? '');
	const expected = Buffer.from(`Bearer ${secret}`);
	return (
		secret.length > 0 &&
		provided.length === expected.length &&
		timingSafeEqual(provided, expected)
	);
}

/** Daily snapshots and anonymization. Spec: docs/domains/rsvp/engagement-analytics.md */
export const GET: APIRoute = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, getEnv('CRON_SECRET').trim())) {
		return errorResponse(new ApiError(401, 'unauthorized', 'Unauthorized.'));
	}
	try {
		const result = await runEngagementMaintenance();
		const log = result.snapshotsFailed > 0 ? console.warn : console.info;
		log('[engagement][maintenance] completed', result);
		return withPrivateCache(jsonResponse(result));
	} catch (error) {
		console.error('[engagement][maintenance] failed', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			new ApiError(503, 'service_unavailable', 'El mantenimiento no pudo completarse.'),
		);
	}
};
