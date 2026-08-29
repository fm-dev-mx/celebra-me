import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse, parseJsonBody, withPrivateCache } from '@/lib/rsvp/core/http';
import {
	clearGuestMemorySessionCookie,
	createGuestMemorySession,
	getGuestMemorySessionFromRequest,
	recoverGuestMemorySession,
	requireValentinaMemoryRateLimit,
	setGuestMemorySessionCookie,
} from '@/lib/memories/valentina-memories.service';

export const prerender = false;

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
					sessionId: recovered.sessionId,
					expiresAt: recovered.expiresAt,
					recovered: true,
				}),
			);
		}
		const existing = await getGuestMemorySessionFromRequest(request);
		if (existing) {
			return withPrivateCache(
				jsonResponse({
					sessionId: existing.id,
					expiresAt: existing.expires_at,
					recovered: false,
				}),
			);
		}
		const created = await createGuestMemorySession();
		setGuestMemorySessionCookie(cookies, created.sessionToken);
		return withPrivateCache(
			jsonResponse(
				{
					sessionId: created.sessionId,
					expiresAt: created.expiresAt,
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

export const DELETE: APIRoute = async ({ cookies }) => {
	clearGuestMemorySessionCookie(cookies);
	return withPrivateCache(jsonResponse({ success: true }));
};
