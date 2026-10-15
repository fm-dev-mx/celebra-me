import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { isAuthorizedCronRequest } from '@/lib/server/cron-request';
import { getEnv } from '@/lib/server/env';
import { MEMORIES_ENV } from '@/lib/memories/server/config';
import {
	MEMORIES_CLEANUP_SCHEDULED_SOURCE,
	runMemoriesCleanupJob,
} from '@/lib/memories/server/cleanup-job';

export const prerender = false;

/** Vercel cron entry point; the job itself lives in `cleanup-job.ts`. */
export const GET: APIRoute = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, getEnv(MEMORIES_ENV.cronSecret).trim())) {
		return errorResponse(new ApiError(401, 'unauthorized', 'Unauthorized.'));
	}
	const outcome = await runMemoriesCleanupJob({ source: MEMORIES_CLEANUP_SCHEDULED_SOURCE });
	switch (outcome.kind) {
		case 'identity_missing':
			return errorResponse(
				new ApiError(503, 'service_unavailable', 'Deploy identity is not declared.'),
			);
		case 'completed':
			return withPrivateCache(jsonResponse(outcome.result));
		case 'inconsistent':
			return errorResponse(
				new ApiError(
					503,
					'service_unavailable',
					'La limpieza devolvió conteos inconsistentes.',
				),
			);
		case 'exception':
			return errorResponse(
				new ApiError(503, 'service_unavailable', 'La limpieza no pudo completarse.'),
			);
	}
};
