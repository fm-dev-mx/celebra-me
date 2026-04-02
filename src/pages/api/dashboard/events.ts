import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { getSessionDebugSnapshotFromRequest } from '@/lib/rsvp/auth/auth';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import { listHostEvents, listHostEventsWithDebug } from '@/lib/rsvp/services/event-admin.service';
import type { DashboardEventListResponse } from '@/interfaces/dashboard/admin.interface';

export const GET: APIRoute = async ({ request }) => {
	try {
		const url = new URL(request.url);
		const debugEnabled =
			process.env.NODE_ENV !== 'production' && url.searchParams.get('debug') === '1';
		const sessionSnapshot = await getSessionDebugSnapshotFromRequest(request);
		if (!sessionSnapshot.context) {
			throw new ApiError(
				401,
				'unauthorized',
				'Unauthorized.',
				debugEnabled
					? {
							debug: {
								hasAccessToken: sessionSnapshot.hasAccessToken,
								tokenSource: sessionSnapshot.tokenSource,
								reason: sessionSnapshot.reason,
							},
						}
					: undefined,
			);
		}

		let payload: DashboardEventListResponse;
		if (debugEnabled) {
			const result = await listHostEventsWithDebug({
				hostUserId: sessionSnapshot.context.userId,
				hostAccessToken: sessionSnapshot.context.accessToken,
				expectedSlug: 'ximena-meza-trasvina',
			});
			const debug = {
				...result.debug,
				session: {
					hasAccessToken: sessionSnapshot.hasAccessToken,
					tokenSource: sessionSnapshot.tokenSource,
					reason: sessionSnapshot.reason,
					userId: sessionSnapshot.context.userId,
					email: sessionSnapshot.context.email,
					role: sessionSnapshot.context.role,
					isSuperAdmin: sessionSnapshot.context.isSuperAdmin,
				},
			};
			console.log('[dashboard/events][debug]', {
				hostUserId: sessionSnapshot.context.userId,
				tokenSource: sessionSnapshot.tokenSource,
				ownerEvents: debug.ownerEvents.length,
				visibleEvents: debug.visibleEvents.length,
				memberships: debug.memberships.length,
				unresolvedMembershipEventIds: debug.unresolvedMembershipEventIds,
				slugCheck: debug.slugCheck,
				items: result.events.map((event) => event.id),
			});
			payload = {
				items: result.events.map((event) => ({
					id: event.id,
					title: event.title,
					slug: event.slug,
					eventType: event.eventType,
					status: event.status,
				})),
				debug,
			};
		} else {
			const events = await listHostEvents({
				hostUserId: sessionSnapshot.context.userId,
				hostAccessToken: sessionSnapshot.context.accessToken,
			});
			payload = {
				items: events.map((event) => ({
					id: event.id,
					title: event.title,
					slug: event.slug,
					eventType: event.eventType,
					status: event.status,
				})),
			};
		}
		return jsonResponse(payload);
	} catch (error) {
		return errorResponse(error);
	}
};
