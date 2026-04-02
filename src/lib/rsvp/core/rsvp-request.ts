import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import type { EventRecord, GuestRSVPSubmitDTO } from '@/interfaces/rsvp/domain.interface';
import { badRequest, parseJsonBody } from '@/lib/rsvp/core/http';
import { normalizePhone, sanitize } from '@/lib/rsvp/core/utils';

export interface PublicGuestRsvpRequest {
	fullName: string;
	phone: string;
	payload: GuestRSVPSubmitDTO;
}

export function isEventType(value: string): value is EventRecord['eventType'] {
	return (EVENT_TYPES as readonly string[]).includes(value);
}

function parseRsvpPayload(body: Record<string, unknown>): GuestRSVPSubmitDTO | Response {
	const attendanceStatus =
		body.attendanceStatus === 'confirmed' || body.attendanceStatus === 'declined'
			? body.attendanceStatus
			: null;
	if (!attendanceStatus) {
		return badRequest('attendanceStatus is invalid.');
	}

	return {
		attendanceStatus,
		attendeeCount: typeof body.attendeeCount === 'number' ? body.attendeeCount : 0,
		guestComment: sanitize(body.guestComment as string, 500),
	};
}

export async function parseInviteGuestRsvpRequest(
	request: Request,
): Promise<GuestRSVPSubmitDTO | Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) return body;
	return parseRsvpPayload(body);
}

export async function parsePublicGuestRsvpRequest(
	request: Request,
): Promise<PublicGuestRsvpRequest | Response> {
	const body = await parseJsonBody(request);
	if (body instanceof Response) return body;

	const payload = parseRsvpPayload(body);
	if (payload instanceof Response) return payload;

	const fullName = sanitize(body.fullName as string, 140);
	const phone = normalizePhone(sanitize(body.phone as string, 40));
	if (!fullName) {
		return badRequest('fullName is required.');
	}

	return {
		fullName,
		phone,
		payload,
	};
}
