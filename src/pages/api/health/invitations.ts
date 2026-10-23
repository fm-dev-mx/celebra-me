import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/rsvp/core/http';
import { listPublishedClientEntriesWithAccess } from '@/lib/intake/repositories/published-invitation-content.repository';
import { resolvePublishedClientEntry } from '@/lib/invitation/content-resolver';

const DATABASE_TIMEOUT_MS = 5_000;

/**
 * Uptime probe for every live client invitation: one read of the published rows, then the
 * same resolution the public route runs, without rendering. Only counts leave the endpoint;
 * the slugs of failing invitations go to the Worker logs.
 */
export const GET: APIRoute = async () => {
	let entries: Awaited<ReturnType<typeof listPublishedClientEntriesWithAccess>>;
	try {
		entries = await listPublishedClientEntriesWithAccess(DATABASE_TIMEOUT_MS);
	} catch (error: unknown) {
		console.error(
			`[health/invitations] database read failed: ${error instanceof Error ? error.name : 'unknown'}`,
		);
		return jsonResponse(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				checks: { database: { status: 'error' } },
			},
			503,
		);
	}

	const now = new Date();
	let active = 0;
	const failing: string[] = [];
	for (const entry of entries) {
		const route = `/${entry.eventType}/${entry.slug}`;
		try {
			const resolution = resolvePublishedClientEntry(entry, now);
			if (resolution?.source === 'unavailable') continue;
			active += 1;
			if (!resolution) failing.push(route);
		} catch (error: unknown) {
			active += 1;
			failing.push(route);
			console.error(
				`[health/invitations] ${route} failed to resolve: ${error instanceof Error ? error.name : 'unknown'}`,
			);
		}
	}

	if (failing.length > 0) {
		console.error(`[health/invitations] failing invitations: ${failing.join(', ')}`);
	}

	const healthy = failing.length === 0;
	return jsonResponse(
		{
			status: healthy ? 'healthy' : 'unhealthy',
			timestamp: now.toISOString(),
			checks: {
				database: { status: 'ok' },
				invitations: { active, failing: failing.length },
			},
		},
		healthy ? 200 : 503,
	);
};
