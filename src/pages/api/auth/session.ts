import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	getHostSessionFromRequest,
	getSessionDebugSnapshotFromRequest,
} from '@/lib/rsvp/auth/auth';
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/rsvp/core/http';
import { buildAuthSessionDto } from '@/lib/rsvp/services/auth-access.service';
import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';

async function buildDebugPayload(
	dto: Awaited<ReturnType<typeof buildAuthSessionDto>>,
	sessionSnapshot: NonNullable<Awaited<ReturnType<typeof getSessionDebugSnapshotFromRequest>>>,
	requestedSlug: string,
) {
	const normalizedRequestedSlug = requestedSlug.trim();
	const requestedEvent = normalizedRequestedSlug
		? await findEventBySlugService(normalizedRequestedSlug)
		: null;
	const payload = {
		...dto,
		debug: {
			hasAccessToken: sessionSnapshot?.hasAccessToken ?? true,
			tokenSource: sessionSnapshot?.tokenSource ?? 'cookie',
			reason: sessionSnapshot?.reason ?? 'session_role_resolved',
			membershipCount: dto.memberships.length,
			membershipEventIds: dto.memberships.map((membership) => membership.eventId),
			requestedSlugCheck: normalizedRequestedSlug
				? {
						requestedSlug: normalizedRequestedSlug,
						slugExistsInDb: Boolean(requestedEvent),
						eventId: requestedEvent?.id || null,
						ownerUserId: requestedEvent?.ownerUserId || null,
					}
				: null,
		},
	};
	console.log('[auth/session][debug]', {
		userId: dto.userId,
		email: dto.email,
		role: dto.role,
		memberships: dto.memberships.length,
		requestedSlug: normalizedRequestedSlug || null,
		requestedEventId: payload.debug.requestedSlugCheck?.eventId || null,
	});
	return payload;
}

export const GET: APIRoute = async ({ request }) => {
	try {
		const url = new URL(request.url);
		const debugEnabled =
			process.env.NODE_ENV !== 'production' && url.searchParams.get('debug') === '1';
		const requestedSlug = url.searchParams.get('slug') || '';
		const sessionSnapshot = debugEnabled
			? await getSessionDebugSnapshotFromRequest(request)
			: null;
		const session = sessionSnapshot?.context ?? (await getHostSessionFromRequest(request));
		if (!session) {
			if (!debugEnabled || !sessionSnapshot) return unauthorizedResponse();
			return errorResponse(
				new ApiError(401, 'unauthorized', 'Unauthorized.', {
					debug: {
						hasAccessToken: sessionSnapshot.hasAccessToken,
						tokenSource: sessionSnapshot.tokenSource,
						reason: sessionSnapshot.reason,
					},
				}),
			);
		}
		const dto = await buildAuthSessionDto({
			userId: session.userId,
			email: session.email,
			accessToken: session.accessToken,
		});
		if (!debugEnabled) {
			return jsonResponse(dto);
		}
		const payload = await buildDebugPayload(dto, sessionSnapshot!, requestedSlug);
		return jsonResponse(payload);
	} catch (error) {
		return errorResponse(error);
	}
};
