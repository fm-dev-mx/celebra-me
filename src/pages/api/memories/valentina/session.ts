import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import {
	clearGuestMemorySessionCookie,
	createGuestMemorySession,
	getGuestMemoryProfile,
	getGuestMemorySessionFromRequest,
	recoverGuestMemorySession,
	setGuestMemorySessionCookie,
	updateGuestMemoryProfile,
} from '@/lib/memories/valentina-memories.service';
import { requireValentinaMemoryRateLimit } from '@/lib/memories/valentina-memories-rate-limit';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		const session = await getGuestMemorySessionFromRequest(request);
		if (!session) return withPrivateCache(jsonResponse({ profile: null }));
		await requireValentinaMemoryRateLimit(request, 'read', session.id);
		return withPrivateCache(jsonResponse({ profile: getGuestMemoryProfile(session) }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireValentinaMemoryRateLimit(request, 'session');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		if (bodyResult.action === 'recover') {
			await requireValentinaMemoryRateLimit(request, 'recover');
			const recovered = await recoverGuestMemorySession(bodyResult.recoveryCode);
			setGuestMemorySessionCookie(cookies, recovered.sessionToken);
			return withPrivateCache(
				jsonResponse({
					profile: recovered.profile,
					recovered: true,
				}),
			);
		}
		if (bodyResult.action !== 'create') return badRequest('La acción de sesión no es válida.');
		const existing = await getGuestMemorySessionFromRequest(request);
		if (existing) {
			return withPrivateCache(
				jsonResponse({
					profile: getGuestMemoryProfile(existing),
					recovered: false,
				}),
			);
		}
		const created = await createGuestMemorySession(bodyResult.displayName);
		setGuestMemorySessionCookie(cookies, created.sessionToken);
		return withPrivateCache(
			jsonResponse(
				{
					profile: created.profile,
					recoveryCode: created.recoveryCode,
					recovered: false,
				},
				201,
			),
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ request }) => {
	try {
		const session = await getGuestMemorySessionFromRequest(request);
		if (!session) return new Response(null, { status: 401 });
		await requireValentinaMemoryRateLimit(request, 'mutate', session.id);
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const profile = await updateGuestMemoryProfile({
			session,
			displayName: bodyResult.displayName,
		});
		return withPrivateCache(jsonResponse({ profile }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ cookies }) => {
	clearGuestMemorySessionCookie(cookies);
	return withPrivateCache(jsonResponse({ success: true }));
};
