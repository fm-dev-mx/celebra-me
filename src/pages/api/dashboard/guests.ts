import type { APIRoute } from 'astro';
import { getSessionContextFromRequest } from '@/lib/rsvp/auth/auth';
import { ApiError } from '@/lib/rsvp/core/errors';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import {
	createDashboardGuest,
	listDashboardGuests,
} from '@/lib/rsvp/services/dashboard-guests.service';
import type { AttendanceStatus } from '@/lib/rsvp/core/types';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function parseStatus(raw: string): AttendanceStatus | 'all' | 'viewed' {
	if (raw === 'pending' || raw === 'confirmed' || raw === 'declined' || raw === 'viewed')
		return raw;
	return 'all';
}

function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		const session = await getSessionContextFromRequest(request);
		if (!session) {
			throw new ApiError(401, 'unauthorized', 'No autorizado.');
		}
		const eventId = sanitize(url.searchParams.get('eventId'), 120);
		const search = sanitize(url.searchParams.get('search'), 120);
		const status = parseStatus(sanitize(url.searchParams.get('status'), 20));

		if (!eventId) return badRequest('eventId es obligatorio.');

		const data = await listDashboardGuests({
			eventId,
			status,
			search,
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
			throw new ApiError(401, 'unauthorized', 'No autorizado.');
		}
		const allowed = await checkRateLimit({
			namespace: 'dashboard',
			entityId: `create:${session.userId}`,
			ip: getIp(request),
			maxHits: 30,
			windowSec: 60,
		});
		if (!allowed) {
			throw new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.');
		}

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const eventId = sanitize(body.eventId as string, 120);
		const fullName = sanitize(body.fullName as string, 140);
		const phone = sanitize(body.phone as string, 40);
		const maxAllowedAttendees =
			typeof body.maxAllowedAttendees === 'number' ? body.maxAllowedAttendees : 1;

		if (!eventId || !fullName) {
			return badRequest('eventId y fullName son obligatorios.');
		}

		const result = await createDashboardGuest({
			eventId,
			fullName,
			phone,
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
