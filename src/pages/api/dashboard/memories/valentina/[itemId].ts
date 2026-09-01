import type { APIRoute } from 'astro';
import {
	errorResponse,
	jsonResponse,
	parseJsonBody,
	badRequest,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { requireDashboardMutationAccess, requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import { retrieveValentinaMemoryObject } from '@/lib/memories/valentina-memories-retrieval';
import {
	assertValentinaOrganizerAccess,
	getMediaObjectForPrivateRetrieval,
	updateOrganizerMemoryItem,
} from '@/lib/memories/valentina-memories.service';
import { recordValentinaMemoryAccess } from '@/lib/memories/valentina-memories-audit';
import { requireDashboardRateLimit } from '@/pages/api/dashboard/guests/dashboard-guests-lib';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals, params, cookies }) => {
	try {
		if (!params.itemId) return badRequest('No se especificó el recuerdo.');
		const session = await requireDashboardMutationAccess(request, cookies, locals);
		await requireDashboardRateLimit(`valentina:update:${session.userId}`, request);
		await assertValentinaOrganizerAccess({
			userId: session.userId,
			accessToken: session.accessToken,
		});
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const item = await updateOrganizerMemoryItem({
			mediaItemId: params.itemId,
			caption: bodyResult.caption,
			status: bodyResult.status,
			actorId: session.userId,
		});
		return withPrivateCache(jsonResponse({ item }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const GET: APIRoute = async ({ request, locals, params }) => {
	try {
		if (!params.itemId) return badRequest('No se especificó el recuerdo.');
		const session = requireDashboardSessionFromLocals(locals);
		await assertValentinaOrganizerAccess({
			userId: session.userId,
			accessToken: session.accessToken,
		});
		const mode =
			new URL(request.url).searchParams.get('mode') === 'preview' ? 'inline' : 'attachment';
		const object = await getMediaObjectForPrivateRetrieval(params.itemId);
		const response = await retrieveValentinaMemoryObject({
			...object,
			mode,
			range: request.headers.get('range'),
		});
		if (!response.ok) return new Response(null, { status: response.status });
		await recordValentinaMemoryAccess({
			mediaItemId: params.itemId,
			actorType: 'organizer',
			actorId: session.userId,
			mode,
		});
		return response;
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ locals, params, request, cookies }) => {
	try {
		if (!params.itemId) return badRequest('No se especificó el recuerdo.');
		const session = await requireDashboardMutationAccess(request, cookies, locals);
		await requireDashboardRateLimit(`valentina:delete:${session.userId}`, request);
		await assertValentinaOrganizerAccess({
			userId: session.userId,
			accessToken: session.accessToken,
		});
		await updateOrganizerMemoryItem({
			mediaItemId: params.itemId,
			status: 'deleted',
			actorId: session.userId,
		});
		return withPrivateCache(jsonResponse({ success: true }));
	} catch (error) {
		return errorResponse(error);
	}
};
