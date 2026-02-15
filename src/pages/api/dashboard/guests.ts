import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { badRequest, internalError, jsonResponse, unauthorizedResponse } from '@/lib/rsvp-v2/http';
import { createDashboardGuest, listDashboardGuests } from '@/lib/rsvp-v2/service';
import type { AttendanceStatus } from '@/lib/rsvp-v2/types';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function parseStatus(raw: string): AttendanceStatus | 'all' {
	if (raw === 'pending' || raw === 'confirmed' || raw === 'declined') return raw;
	return 'all';
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		const session = await requireHostSession(request);
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
		if (error instanceof Error && error.message.includes('No autorizado')) {
			return unauthorizedResponse();
		}
		return internalError(error);
	}
};

export const POST: APIRoute = async ({ request, url }) => {
	try {
		const session = await requireHostSession(request);
		const body = (await request.json()) as {
			eventId?: string;
			fullName?: string;
			phoneE164?: string;
			maxAllowedAttendees?: number;
		};

		const eventId = sanitize(body.eventId, 120);
		const fullName = sanitize(body.fullName, 140);
		const phoneE164 = sanitize(body.phoneE164, 40);
		const maxAllowedAttendees =
			typeof body.maxAllowedAttendees === 'number' ? body.maxAllowedAttendees : 1;

		if (!eventId || !fullName || !phoneE164) {
			return badRequest('eventId, fullName y phoneE164 son obligatorios.');
		}

		const item = await createDashboardGuest({
			eventId,
			fullName,
			phoneE164,
			maxAllowedAttendees,
			hostAccessToken: session.accessToken,
			origin: url.origin,
		});

		return jsonResponse({ item }, 201);
	} catch (error) {
		if (error instanceof Error && error.message.includes('No autorizado')) {
			return unauthorizedResponse();
		}
		return internalError(error);
	}
};
