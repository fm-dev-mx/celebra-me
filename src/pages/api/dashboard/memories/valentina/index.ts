import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import {
	assertValentinaOrganizerAccess,
	listOrganizerMemoryItems,
	revokeGuestMemorySession,
} from '@/lib/memories/valentina-memories.service';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await assertValentinaOrganizerAccess({
			accessToken: session.accessToken,
		});
		const rawPage = url.searchParams.get('page') ?? '0';
		if (!/^\d{1,2}$/.test(rawPage)) return badRequest('La página no es válida.');
		return withPrivateCache(
			jsonResponse(await listOrganizerMemoryItems({ page: Number(rawPage) })),
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, locals }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await assertValentinaOrganizerAccess({ accessToken: session.accessToken });
		const body = await parseJsonBody(request);
		if (body instanceof Response) return body;
		if (body.action !== 'revoke_session') return badRequest('La acción no es válida.');
		await revokeGuestMemorySession({ guestAlias: body.guestAlias, actorId: session.userId });
		return withPrivateCache(jsonResponse({ success: true }));
	} catch (error) {
		return errorResponse(error);
	}
};
