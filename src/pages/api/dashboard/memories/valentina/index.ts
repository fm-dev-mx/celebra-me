import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { requireDashboardMutationAccess, requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import {
	assertValentinaOrganizerAccess,
	listOrganizerMemoryItems,
	revokeGuestMemorySession,
} from '@/lib/memories/valentina-memories.service';
import {
	VALENTINA_MEMORIES_MEDIA_STATUSES,
	type ValentinaMemoriesMediaStatus,
} from '@/data/valentina-memories-media.contract';
import { requireDashboardRateLimit } from '@/pages/api/dashboard/guests/dashboard-guests-lib';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await assertValentinaOrganizerAccess({
			userId: session.userId,
			accessToken: session.accessToken,
		});
		const rawPage = url.searchParams.get('page') ?? '0';
		if (!/^\d{1,2}$/.test(rawPage)) return badRequest('La página no es válida.');
		const rawStatus = url.searchParams.get('status');
		if (
			rawStatus !== null &&
			!VALENTINA_MEMORIES_MEDIA_STATUSES.includes(rawStatus as ValentinaMemoriesMediaStatus)
		) {
			return badRequest('El estado no es válido.');
		}
		return withPrivateCache(
			jsonResponse(
				await listOrganizerMemoryItems({
					page: Number(rawPage),
					status: (rawStatus ?? undefined) as ValentinaMemoriesMediaStatus | undefined,
					uploader: url.searchParams.get('uploader') ?? undefined,
					createdFrom: url.searchParams.get('createdFrom') ?? undefined,
					createdTo: url.searchParams.get('createdTo') ?? undefined,
				}),
			),
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
	try {
		const session = await requireDashboardMutationAccess(request, cookies, locals);
		await requireDashboardRateLimit(`valentina:revoke-session:${session.userId}`, request);
		await assertValentinaOrganizerAccess({
			userId: session.userId,
			accessToken: session.accessToken,
		});
		const body = await parseJsonBody(request);
		if (body instanceof Response) return body;
		if (body.action !== 'revoke_session') return badRequest('La acción no es válida.');
		await revokeGuestMemorySession({ guestAlias: body.guestAlias, actorId: session.userId });
		return withPrivateCache(jsonResponse({ success: true }));
	} catch (error) {
		return errorResponse(error);
	}
};
