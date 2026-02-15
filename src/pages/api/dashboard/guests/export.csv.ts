import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp-v2/auth';
import { badRequest, csvResponse, internalError, unauthorizedResponse } from '@/lib/rsvp-v2/http';
import { listDashboardGuests } from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		const session = await requireHostSession(request);
		const eventId = sanitize(url.searchParams.get('eventId'), 120);
		if (!eventId) return badRequest('eventId es obligatorio.');

		const data = await listDashboardGuests({
			eventId,
			status: 'all',
			search: '',
			hostAccessToken: session.accessToken,
			origin: url.origin,
		});

		const header = [
			'guest_id',
			'invite_id',
			'full_name',
			'phone_e164',
			'attendance_status',
			'attendee_count',
			'max_allowed_attendees',
			'delivery_status',
			'first_viewed_at',
			'responded_at',
			'updated_at',
			'guest_message',
		];

		const rows = data.items.map((item) =>
			[
				item.guestId,
				item.inviteId,
				item.fullName,
				item.phoneE164,
				item.attendanceStatus,
				String(item.attendeeCount),
				String(item.maxAllowedAttendees),
				item.deliveryStatus,
				item.firstViewedAt ?? '',
				item.respondedAt ?? '',
				item.updatedAt,
				item.guestMessage,
			]
				.map((value) => `"${String(value).replace(/"/g, '""')}"`)
				.join(','),
		);

		return csvResponse(
			[header.join(','), ...rows].join('\n'),
			`dashboard-guests-${eventId}.csv`,
		);
	} catch (error) {
		if (error instanceof Error && error.message.includes('No autorizado')) {
			return unauthorizedResponse();
		}
		return internalError(error);
	}
};
