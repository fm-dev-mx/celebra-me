import type { APIRoute } from 'astro';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { cleanupValentinaMemoryObjects } from '@/lib/memories/valentina-memories-cleanup.service';
import {
	VALENTINA_CLEANUP_EVENT_NAME,
	createValentinaCleanupCompletedEvidence,
	createValentinaCleanupFailedEvidence,
	createValentinaCleanupStartedEvidence,
} from '@/lib/operations/valentina-cleanup-evidence';
import { serializeOperationalEvidenceEvent } from '@/lib/operations/operational-evidence';
import { getEnv } from '@/lib/server/env';

export const prerender = false;

function isAuthorizedCronRequest(request: Request, secret: string): boolean {
	const provided = request.headers.get('authorization') ?? '';
	const expected = `Bearer ${secret}`;
	const providedBytes = Buffer.from(provided);
	const expectedBytes = Buffer.from(expected);
	return (
		secret.length > 0 &&
		providedBytes.length === expectedBytes.length &&
		timingSafeEqual(providedBytes, expectedBytes)
	);
}

function noStoreJson(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			'Cache-Control': 'no-store',
			'Content-Type': 'application/json',
		},
	});
}

export const GET: APIRoute = async ({ request }) => {
	const secret = getEnv('CRON_SECRET').trim();
	if (!isAuthorizedCronRequest(request, secret)) {
		return new Response(null, { status: 401 });
	}
	const runId = randomUUID();
	const startedAt = new Date().toISOString();
	const context = {
		runId,
		startedAt,
		invocationId: request.headers.get('x-vercel-id'),
		commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
		deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
	};
	console.info(
		serializeOperationalEvidenceEvent(
			VALENTINA_CLEANUP_EVENT_NAME,
			'started',
			createValentinaCleanupStartedEvidence({ ...context, completedAt: null }),
		),
	);
	try {
		const result = await cleanupValentinaMemoryObjects();
		const evidence = createValentinaCleanupCompletedEvidence(
			{ ...context, completedAt: new Date().toISOString() },
			result,
		);
		const serialized = serializeOperationalEvidenceEvent(
			VALENTINA_CLEANUP_EVENT_NAME,
			'completed',
			evidence,
		);
		if (evidence.status === 'FAILED') console.error(serialized);
		else if (evidence.status === 'WARNING') console.warn(serialized);
		else console.info(serialized);
		if (evidence.status === 'FAILED') {
			return noStoreJson(
				{
					error: {
						code: 'cleanup_count_invariant_failed',
						message: 'La limpieza devolvió conteos inconsistentes.',
					},
				},
				503,
			);
		}
		return noStoreJson(result);
	} catch {
		const evidence = createValentinaCleanupFailedEvidence({
			...context,
			completedAt: new Date().toISOString(),
		});
		console.error(
			serializeOperationalEvidenceEvent(VALENTINA_CLEANUP_EVENT_NAME, 'completed', evidence),
		);
		return noStoreJson(
			{ error: { code: 'cleanup_failed', message: 'La limpieza no pudo completarse.' } },
			503,
		);
	}
};
