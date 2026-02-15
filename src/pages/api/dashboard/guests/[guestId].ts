import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { badRequest, internalError, jsonResponse, unauthorizedResponse } from '@/lib/rsvp-v2/http';
import { deleteDashboardGuest, updateDashboardGuest } from '@/lib/rsvp-v2/service';
import type { AttendanceStatus } from '@/lib/rsvp-v2/types';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function parseStatus(raw: string): AttendanceStatus | undefined {
	if (raw === 'pending' || raw === 'confirmed' || raw === 'declined') return raw;
	return undefined;
}

export const PATCH: APIRoute = async ({ params, request, url }) => {
	try {
		const session = await requireHostSession(request);
		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId es obligatorio.');

		const body = (await request.json()) as {
			fullName?: string;
			phoneE164?: string;
			maxAllowedAttendees?: number;
			attendanceStatus?: string;
			attendeeCount?: number;
			guestMessage?: string;
		};

		const item = await updateDashboardGuest({
			guestId,
			hostAccessToken: session.accessToken,
			origin: url.origin,
			fullName: body.fullName !== undefined ? sanitize(body.fullName, 140) : undefined,
			phoneE164: body.phoneE164 !== undefined ? sanitize(body.phoneE164, 40) : undefined,
			maxAllowedAttendees:
				typeof body.maxAllowedAttendees === 'number' ? body.maxAllowedAttendees : undefined,
			attendanceStatus: parseStatus(sanitize(body.attendanceStatus, 20)),
			attendeeCount: typeof body.attendeeCount === 'number' ? body.attendeeCount : undefined,
			guestMessage:
				body.guestMessage !== undefined ? sanitize(body.guestMessage, 500) : undefined,
		});

		return jsonResponse({ item });
	} catch (error) {
		if (error instanceof Error && error.message.includes('No autorizado')) {
			return unauthorizedResponse();
		}
		return internalError(error);
	}
};

export const DELETE: APIRoute = async ({ params, request }) => {
	try {
		const session = await requireHostSession(request);
		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId es obligatorio.');

		await deleteDashboardGuest({ guestId, hostAccessToken: session.accessToken });
		return jsonResponse({ message: 'Invitado eliminado.' });
	} catch (error) {
		if (error instanceof Error && error.message.includes('No autorizado')) {
			return unauthorizedResponse();
		}
		return internalError(error);
	}
};
