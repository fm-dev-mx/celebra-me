import type { APIRoute } from 'astro';
import {
	getAdminRsvpList,
	parseAttendanceInput,
	saveRsvp,
	type AttendanceStatus,
} from '@/lib/rsvp/service';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;
const MAX_NAME_LENGTH = 200;

function sanitize(value: unknown, maxLen = MAX_NAME_LENGTH): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function parseAttendeeCount(value: unknown): number {
	if (typeof value !== 'number') return 0;
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(Math.trunc(value), 20));
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const eventSlug = sanitize(url.searchParams.get('eventSlug'));
		if (!eventSlug) {
			return new Response(JSON.stringify({ message: 'eventSlug es obligatorio.' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		const rawStatus = sanitize(url.searchParams.get('status'));
		const search = sanitize(url.searchParams.get('search'), 120);
		const status: AttendanceStatus | 'all' =
			rawStatus === 'pending' || rawStatus === 'confirmed' || rawStatus === 'declined'
				? rawStatus
				: 'all';

		const result = await getAdminRsvpList({ eventSlug, status, search });
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: JSON_HEADERS,
		});
	} catch (error) {
		console.error('RSVP API GET Error:', error);
		return new Response(JSON.stringify({ message: 'Error interno del servidor.' }), {
			status: 500,
			headers: JSON_HEADERS,
		});
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const raw = await request.json();

		const eventSlug = sanitize(raw.eventSlug, 120);
		const token = sanitize(raw.token, 2048);
		const guestName = sanitize(raw.guestName || raw.name);
		const attendanceStatus = parseAttendanceInput(raw.attendanceStatus ?? raw.attendance);
		const attendeeCount = parseAttendeeCount(raw.attendeeCount ?? raw.guestCount);
		const notes = sanitize(raw.notes);
		const dietary = sanitize(raw.dietary);

		if (!eventSlug || !attendanceStatus) {
			return new Response(
				JSON.stringify({ message: 'eventSlug y attendanceStatus son obligatorios.' }),
				{
					status: 400,
					headers: JSON_HEADERS,
				},
			);
		}

		const { rsvp, contextMode } = await saveRsvp({
			eventSlug,
			token: token || undefined,
			guestName,
			attendanceStatus,
			attendeeCount,
			notes,
			dietary,
		});

		return new Response(
			JSON.stringify({
				message: '¡Confirmación recibida con éxito!',
				rsvpId: rsvp.rsvpId,
				status: rsvp.attendanceStatus,
				updatedAt: rsvp.lastUpdatedAt,
				contextMode,
				whatsappTemplatePayload: {
					name: rsvp.guestNameEntered,
					attendanceStatus: rsvp.attendanceStatus,
					attendeeCount: rsvp.attendeeCount,
				},
			}),
			{
				status: 200,
				headers: JSON_HEADERS,
			},
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Error interno del servidor.';
		const status = message.includes('obligatorio') || message.includes('inválido') ? 400 : 500;
		return new Response(JSON.stringify({ message }), {
			status,
			headers: JSON_HEADERS,
		});
	}
};
