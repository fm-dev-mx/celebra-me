import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { cleanupValentinaMemoryObjects } from '@/lib/memories/valentina-memories-cleanup.service';
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

export const GET: APIRoute = async ({ request }) => {
	const secret = getEnv('CRON_SECRET').trim();
	if (!isAuthorizedCronRequest(request, secret)) {
		return new Response(null, { status: 401 });
	}
	try {
		const result = await cleanupValentinaMemoryObjects();
		return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
	} catch {
		return Response.json(
			{ error: { code: 'cleanup_failed', message: 'La limpieza no pudo completarse.' } },
			{ status: 503, headers: { 'Cache-Control': 'no-store' } },
		);
	}
};
