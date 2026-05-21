import type { APIRoute } from 'astro';
import { requireHostSession } from '@/lib/rsvp/auth/auth';
import { badRequest, csvResponse, errorResponse } from '@/lib/rsvp/core/http';
import { splitPhoneForExport } from '@/lib/rsvp/core/utils';
import { listDashboardGuests } from '@/lib/rsvp/services/dashboard-guests.service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

/**
 * Escapes a CSV value: wraps in double quotes, escapes embedded quotes,
 * and prevents CSV injection by prefixing values that start with =, +, -, @, tab, or CR.
 */
function escapeCsv(raw: unknown): string {
	let value = String(raw ?? '');
	if (
		value.startsWith('=') ||
		value.startsWith('+') ||
		value.startsWith('-') ||
		value.startsWith('@') ||
		value.startsWith('\t') ||
		value.startsWith('\r')
	) {
		value = '\t' + value;
	}
	return `"${value.replace(/"/g, '""')}"`;
}

export const GET: APIRoute = async ({ request, url }) => {
	try {
		const session = await requireHostSession(request);
		const eventId = sanitize(url.searchParams.get('eventId'), 120);
		if (!eventId) return badRequest('eventId is required.');

		const data = await listDashboardGuests({
			eventId,
			status: 'all',
			search: '',
			hostAccessToken: session.accessToken,
			origin: url.origin,
		});

		const header = [
			'full_name',
			'phone',
			'country_code',
			'attendance_status',
			'attendee_count',
			'max_allowed_attendees',
			'delivery_status',
			'tags',
			'guest_comment',
		];

		const rows = data.items.map((item) => {
			const split = splitPhoneForExport(item.phone);
			return [
				item.fullName,
				split ? split.localPhone : item.phone,
				split ? split.countryCode : '',
				item.attendanceStatus,
				String(item.attendeeCount),
				String(item.maxAllowedAttendees),
				item.deliveryStatus,
				(item.tags || []).join('; '),
				item.guestComment,
			]
				.map(escapeCsv)
				.join(',');
		});

		const content = '\uFEFF' + [header.join(','), ...rows].join('\n');

		return csvResponse(content, `invitados-${eventId}.csv`);
	} catch (error) {
		return errorResponse(error);
	}
};
