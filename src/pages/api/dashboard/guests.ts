import type { APIRoute } from 'astro';
import { getSessionContextFromRequest } from '@/lib/rsvp/auth/auth';
import type { DeliveryFilter } from '@/interfaces/rsvp/domain.interface';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	badRequest,
	errorResponse,
	getIp,
	jsonResponse,
	parseJsonBody,
} from '@/lib/rsvp/core/http';
import { sanitize } from '@/lib/rsvp/core/utils';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import {
	createDashboardGuest,
	listDashboardGuests,
} from '@/lib/rsvp/services/dashboard-guests.service';
import type { AttendanceStatus } from '@/interfaces/rsvp/domain.interface';

function parseStatus(raw: string): AttendanceStatus | 'all' | 'viewed' {
	if (raw === 'pending' || raw === 'confirmed' || raw === 'declined' || raw === 'viewed')
		return raw;
	return 'all';
}

function parseDelivery(raw: string): DeliveryFilter {
	if (raw === 'generated' || raw === 'shared') return raw;
	return 'all';
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		const session = await getSessionContextFromRequest(request);
		if (!session) {
			throw new ApiError(
				401,
				'unauthorized',
				'No tienes autorización para realizar esta acción.',
			);
		}
		const eventId = sanitize(url.searchParams.get('eventId'), 120);
		const search = sanitize(url.searchParams.get('search'), 120);
		const status = parseStatus(sanitize(url.searchParams.get('status'), 20));
		const delivery = parseDelivery(sanitize(url.searchParams.get('delivery'), 20));

		if (!eventId) return badRequest('eventId is required.');

		const data = await listDashboardGuests({
			eventId,
			status,
			search,
			delivery,
			hostAccessToken: session.accessToken,
			origin: url.origin,
		});
		return jsonResponse(data);
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, url }) => {
	try {
		const session = await getSessionContextFromRequest(request);
		if (!session) {
			throw new ApiError(
				401,
				'unauthorized',
				'No tienes autorización para realizar esta acción.',
			);
		}
		const allowed = await checkRateLimit({
			namespace: 'dashboard',
			entityId: `create:${session.userId}`,
			ip: getIp(request),
			maxHits: 30,
			windowSec: 60,
		});
		if (!allowed) {
			throw new ApiError(429, 'rate_limited', 'Too many requests.');
		}

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const eventId = sanitize(body.eventId as string, 120);
		const fullName = sanitize(body.fullName as string, 140);
		const phone = sanitize(body.phone as string, 40);
		const countryCode =
			typeof body.countryCode === 'string' ? body.countryCode.trim() : undefined;
		const maxAllowedAttendees =
			typeof body.maxAllowedAttendees === 'number' ? body.maxAllowedAttendees : 1;

		if (!eventId || !fullName) {
			return badRequest('eventId and fullName are required.');
		}

		const result = await createDashboardGuest({
			eventId,
			fullName,
			phone,
			countryCode,
			maxAllowedAttendees,
			hostAccessToken: session.accessToken,
			origin: url.origin,
			actorUserId: session.userId,
			isSuperAdmin: session.isSuperAdmin,
			tags: Array.isArray(body.tags)
				? body.tags.filter((tag): tag is string => typeof tag === 'string')
				: undefined,
		});

		return jsonResponse(result, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
