import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import {
	ENGAGEMENT_MAINTENANCE_SCHEDULED_SOURCE,
	runEngagementMaintenanceJob,
} from '@/lib/rsvp/engagement/engagement-maintenance-job';
import { isAuthorizedCronRequest } from '@/lib/server/cron-request';
import { getEnv } from '@/lib/server/env';

export const prerender = false;

/**
 * Vercel cron entry point for daily snapshots and anonymization; the job itself lives in
 * `engagement-maintenance-job.ts`. Spec: docs/domains/rsvp/engagement-analytics.md
 */
export const GET: APIRoute = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, getEnv('CRON_SECRET').trim())) {
		return errorResponse(new ApiError(401, 'unauthorized', 'Unauthorized.'));
	}
	const outcome = await runEngagementMaintenanceJob({
		source: ENGAGEMENT_MAINTENANCE_SCHEDULED_SOURCE,
	});
	if (outcome.kind === 'exception') {
		return errorResponse(
			new ApiError(503, 'service_unavailable', 'El mantenimiento no pudo completarse.'),
		);
	}
	return withPrivateCache(jsonResponse(outcome.result));
};
