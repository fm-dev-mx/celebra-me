import type { APIRoute } from 'astro';
import {
	requireDashboardMutationAccess,
	requireDashboardSessionFromLocals,
} from '@/lib/rsvp/auth/authorization';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { isMemoriesMediaStatus } from '@/lib/memories/contract/catalog';
import {
	listOrganizerMemoryItems,
	requireOrganizerMemorySpace,
	revokeGuestMemorySession,
} from '@/lib/memories/server/organizer.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireEventIdParam } from '@/lib/memories/server/route-guards';
import { toMemorySpaceSummary } from '@/lib/memories/server/space.service';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params, url }) => {
	try {
		const eventId = requireEventIdParam(params);
		const session = requireDashboardSessionFromLocals(locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		const rawPage = url.searchParams.get('page') ?? '0';
		if (!/^\d{1,4}$/.test(rawPage)) return badRequest('La página no es válida.');
		const rawStatus = url.searchParams.get('status');
		if (rawStatus !== null && !isMemoriesMediaStatus(rawStatus)) {
			return badRequest('El estado no es válido.');
		}
		const list = await listOrganizerMemoryItems(space, {
			page: Number(rawPage),
			status: rawStatus ?? undefined,
			uploader: url.searchParams.get('uploader') ?? undefined,
			createdFrom: url.searchParams.get('createdFrom') ?? undefined,
			createdTo: url.searchParams.get('createdTo') ?? undefined,
		});
		return withPrivateCache(jsonResponse({ ...list, space: toMemorySpaceSummary(space) }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, locals, params, cookies }) => {
	try {
		const eventId = requireEventIdParam(params);
		const session = await requireDashboardMutationAccess(request, cookies, locals);
		await requireMemoriesRateLimit(request, 'organizer', session.userId);
		const space = await requireOrganizerMemorySpace(eventId, session);
		const body = await parseJsonBody(request);
		if (body instanceof Response) return body;
		if (body.action !== 'revoke_session') return badRequest('La acción no es válida.');
		await revokeGuestMemorySession({
			space,
			guestAlias: body.guestAlias,
			actorId: session.userId,
		});
		return withPrivateCache(jsonResponse({ success: true }));
	} catch (error) {
		return errorResponse(error);
	}
};
