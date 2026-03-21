import type { APIRoute } from 'astro';
import { getSessionContextFromRequest } from '@/lib/rsvp/auth/auth';
import { ApiError } from '@/lib/rsvp/core/errors';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import {
	deleteDashboardGuest,
	updateDashboardGuest,
} from '@/lib/rsvp/services/dashboard-guests.service';
import type { AttendanceStatus } from '@/lib/rsvp/core/types';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function parseStatus(raw: string): AttendanceStatus | undefined {
	if (raw === 'pending' || raw === 'confirmed' || raw === 'declined') return raw;
	return undefined;
}

function getIp(request: Request): string {
	const raw =
		request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
	return sanitize(raw.split(',')[0], 100);
}

export const PATCH: APIRoute = async ({ params, request, url }) => {
	try {
		const session = await getSessionContextFromRequest(request);
		if (!session) {
			throw new ApiError(401, 'unauthorized', 'No autorizado.');
		}
		const allowed = await checkRateLimit({
			namespace: 'dashboard',
			entityId: `patch:${session.userId}`,
			ip: getIp(request),
			maxHits: 30,
			windowSec: 60,
		});
		if (!allowed) {
			throw new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.');
		}

		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId es obligatorio.');

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const result = await updateDashboardGuest({
			guestId,
			hostAccessToken: session.accessToken,
			origin: url.origin,
			actorUserId: session.userId,
			isSuperAdmin: session.isSuperAdmin,
			fullName: body.fullName !== undefined ? sanitize(body.fullName, 140) : undefined,
			phone: body.phone !== undefined ? sanitize(body.phone, 40) : undefined,
			maxAllowedAttendees:
				typeof body.maxAllowedAttendees === 'number' ? body.maxAllowedAttendees : undefined,
			attendanceStatus: parseStatus(sanitize(body.attendanceStatus, 20)),
			attendeeCount: typeof body.attendeeCount === 'number' ? body.attendeeCount : undefined,
			guestMessage:
				body.guestMessage !== undefined ? sanitize(body.guestMessage, 500) : undefined,
			tags: Array.isArray(body.tags)
				? body.tags.filter((tag): tag is string => typeof tag === 'string')
				: undefined,
		});

		return jsonResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ params, request }) => {
	try {
		const session = await getSessionContextFromRequest(request);
		if (!session) {
			throw new ApiError(401, 'unauthorized', 'No autorizado.');
		}
		const allowed = await checkRateLimit({
			namespace: 'dashboard',
			entityId: `delete:${session.userId}`,
			ip: getIp(request),
			maxHits: 30,
			windowSec: 60,
		});
		if (!allowed) {
			throw new ApiError(429, 'rate_limited', 'Demasiadas solicitudes.');
		}

		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId es obligatorio.');

		await deleteDashboardGuest({
			guestId,
			hostAccessToken: session.accessToken,
			actorUserId: session.userId,
			isSuperAdmin: session.isSuperAdmin,
		});
		return jsonResponse({
			source: 'mutation',
			updatedAt: new Date().toISOString(),
			message: 'Invitado eliminado.',
		});
	} catch (error) {
		return errorResponse(error);
	}
};
