import type { APIRoute } from 'astro';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { serializeOperationalEvidenceEvent } from '@/lib/operations/operational-evidence';
import { getEnv } from '@/lib/server/env';
import { MEMORIES_ENV } from '@/lib/memories/server/config';
import { runMemoriesCleanup } from '@/lib/memories/server/cleanup.service';
import {
	MEMORIES_CLEANUP_EVENT_NAME,
	createMemoriesCleanupCompletedEvidence,
	createMemoriesCleanupFailedEvidence,
	createMemoriesCleanupStartedEvidence,
	resolveMemoriesRuntimeEnvironment,
} from '@/lib/memories/server/cleanup-evidence';

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

export const GET: APIRoute = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, getEnv(MEMORIES_ENV.cronSecret).trim())) {
		return errorResponse(new ApiError(401, 'unauthorized', 'Unauthorized.'));
	}
	const context = {
		environment: resolveMemoriesRuntimeEnvironment(getEnv('VERCEL_ENV')),
		runId: randomUUID(),
		startedAt: new Date().toISOString(),
		invocationId: request.headers.get('x-vercel-id'),
		commitSha: getEnv('VERCEL_GIT_COMMIT_SHA'),
		deploymentId: getEnv('VERCEL_DEPLOYMENT_ID'),
	};
	console.info(
		serializeOperationalEvidenceEvent(
			MEMORIES_CLEANUP_EVENT_NAME,
			'started',
			createMemoriesCleanupStartedEvidence({ ...context, completedAt: null }),
		),
	);
	try {
		const result = await runMemoriesCleanup();
		const evidence = createMemoriesCleanupCompletedEvidence(
			{ ...context, completedAt: new Date().toISOString() },
			result,
		);
		const serialized = serializeOperationalEvidenceEvent(
			MEMORIES_CLEANUP_EVENT_NAME,
			'completed',
			evidence,
		);
		if (evidence.status === 'FAILED') console.error(serialized);
		else if (evidence.status === 'WARNING') console.warn(serialized);
		else console.info(serialized);
		if (evidence.status === 'FAILED') {
			return errorResponse(
				new ApiError(
					503,
					'service_unavailable',
					'La limpieza devolvió conteos inconsistentes.',
				),
			);
		}
		return withPrivateCache(jsonResponse(result));
	} catch {
		console.error(
			serializeOperationalEvidenceEvent(
				MEMORIES_CLEANUP_EVENT_NAME,
				'completed',
				createMemoriesCleanupFailedEvidence({
					...context,
					completedAt: new Date().toISOString(),
				}),
			),
		);
		return errorResponse(
			new ApiError(503, 'service_unavailable', 'La limpieza no pudo completarse.'),
		);
	}
};
