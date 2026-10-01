import type { APIRoute } from 'astro';
import {
	badRequest,
	errorResponse,
	jsonResponse,
	parseJsonBody,
	withPrivateCache,
} from '@/lib/rsvp/core/http';
import { parseCookieHeader } from '@/lib/rsvp/core/utils';
import { buildMemoriesSessionCookieName } from '@/lib/memories/contract/private-request';
import {
	clearGuestSessionCookie,
	createGuestSession,
	getGuestSessionFromRequest,
	recoverGuestSession,
	setGuestSessionCookie,
	toGuestProfile,
	updateGuestProfile,
} from '@/lib/memories/server/guest-session.service';
import { requireMemoriesRateLimit } from '@/lib/memories/server/rate-limit';
import { requireGuestContext } from '@/lib/memories/server/route-guards';
import {
	assertMemorySpaceAcceptsGuests,
	requirePublicMemorySpace,
} from '@/lib/memories/server/space.service';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
	try {
		const space = await requirePublicMemorySpace(params.slug);
		const hasCookie = Boolean(
			parseCookieHeader(request.headers.get('cookie'))[
				buildMemoriesSessionCookieName(space.publicSlug)
			],
		);
		if (!hasCookie) return withPrivateCache(jsonResponse({ profile: null }));
		const session = await getGuestSessionFromRequest(space, request);
		if (!session) return withPrivateCache(jsonResponse({ profile: null }));
		await requireMemoriesRateLimit(request, 'read', session.id);
		return withPrivateCache(jsonResponse({ profile: toGuestProfile(session) }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, params, cookies }) => {
	try {
		await requireMemoriesRateLimit(request, 'session');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const space = await requirePublicMemorySpace(params.slug);
		assertMemorySpaceAcceptsGuests(space);
		if (bodyResult.action === 'recover') {
			await requireMemoriesRateLimit(request, 'recover');
			const recovered = await recoverGuestSession(space, bodyResult.recoveryCode);
			setGuestSessionCookie(cookies, space, recovered.sessionToken);
			return withPrivateCache(jsonResponse({ profile: recovered.profile, recovered: true }));
		}
		if (bodyResult.action !== 'create') return badRequest('La acción de sesión no es válida.');
		const existing = await getGuestSessionFromRequest(space, request);
		if (existing) {
			return withPrivateCache(
				jsonResponse({ profile: toGuestProfile(existing), recovered: false }),
			);
		}
		const created = await createGuestSession(space, bodyResult.displayName);
		setGuestSessionCookie(cookies, space, created.sessionToken);
		return withPrivateCache(
			jsonResponse(
				{ profile: created.profile, recoveryCode: created.recoveryCode, recovered: false },
				201,
			),
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const PATCH: APIRoute = async ({ request, params }) => {
	try {
		const { space, session } = await requireGuestContext(request, params, 'mutate');
		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const profile = await updateGuestProfile(space, session, bodyResult.displayName);
		return withPrivateCache(jsonResponse({ profile }));
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
	try {
		const space = await requirePublicMemorySpace(params.slug);
		clearGuestSessionCookie(cookies, space);
		return withPrivateCache(jsonResponse({ success: true }));
	} catch (error) {
		return errorResponse(error);
	}
};
