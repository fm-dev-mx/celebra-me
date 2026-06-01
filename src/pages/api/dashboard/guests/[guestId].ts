import type { APIRoute } from 'astro';
import { badRequest, errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { sanitize } from '@/lib/rsvp/core/utils';
import { requireDashboardSessionFromLocals } from '@/lib/rsvp/auth/authorization';
import {
	deleteDashboardGuest,
	updateDashboardGuest,
} from '@/lib/rsvp/services/dashboard-guests.service';
import type { AttendanceStatus } from '@/interfaces/rsvp/domain.interface';
import {
	requireDashboardRateLimit,
	validateGuestPhoneInput,
} from '@/pages/api/dashboard/guests/dashboard-guests-lib';

function parseStatus(raw: string): AttendanceStatus | undefined {
	if (raw === 'pending' || raw === 'confirmed' || raw === 'declined') return raw;
	return undefined;
}

function parsePhoneUpdate(
	body: Record<string, unknown>,
): { ok: true; phone?: string | null; countryCode?: string } | { ok: false; message: string } {
	const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim() : undefined;

	if (body.phone === undefined) {
		return { ok: true, phone: undefined, countryCode: undefined };
	}

	const rawPhone = typeof body.phone === 'string' ? body.phone : '';
	return validateGuestPhoneInput(rawPhone, countryCode);
}

export const PATCH: APIRoute = async ({ params, request, url, locals }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await requireDashboardRateLimit(`patch:${session.userId}`, request);

		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId is required.');

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const phoneUpdate = parsePhoneUpdate(body);
		if (!phoneUpdate.ok) return badRequest(phoneUpdate.message);

		const result = await updateDashboardGuest({
			guestId,
			hostAccessToken: session.accessToken,
			origin: url.origin,
			actorUserId: session.userId,
			isSuperAdmin: session.isSuperAdmin,
			fullName: body.fullName !== undefined ? sanitize(body.fullName, 140) : undefined,
			phone: phoneUpdate.phone,
			countryCode: phoneUpdate.countryCode,
			maxAllowedAttendees:
				typeof body.maxAllowedAttendees === 'number' ? body.maxAllowedAttendees : undefined,
			attendanceStatus: parseStatus(sanitize(body.attendanceStatus, 20)),
			attendeeCount: typeof body.attendeeCount === 'number' ? body.attendeeCount : undefined,
			tags: Array.isArray(body.tags)
				? body.tags.filter((tag): tag is string => typeof tag === 'string')
				: undefined,
			deliveryStatus:
				body.deliveryStatus === 'generated' || body.deliveryStatus === 'shared'
					? body.deliveryStatus
					: undefined,
		});

		return jsonResponse(result);
	} catch (error) {
		return errorResponse(error);
	}
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
	try {
		const session = requireDashboardSessionFromLocals(locals);
		await requireDashboardRateLimit(`delete:${session.userId}`, request);

		const guestId = sanitize(params.guestId, 120);
		if (!guestId) return badRequest('guestId is required.');

		await deleteDashboardGuest({
			guestId,
			hostAccessToken: session.accessToken,
			actorUserId: session.userId,
			isSuperAdmin: session.isSuperAdmin,
		});
		return jsonResponse({
			source: 'mutation',
			updatedAt: new Date().toISOString(),
			message: 'Guest deleted.',
		});
	} catch (error) {
		return errorResponse(error);
	}
};
