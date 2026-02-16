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
			return new Response(
				JSON.stringify({
					success: false,
					error: {
						code: 'bad_request',
						message: 'eventSlug es obligatorio.',
					},
				}),
				{
					status: 400,
					headers: JSON_HEADERS,
				},
			);
		}

		const rawStatus = sanitize(url.searchParams.get('status'));
		const search = sanitize(url.searchParams.get('search'), 120);
		const status: AttendanceStatus | 'all' =
			rawStatus === 'pending' || rawStatus === 'confirmed' || rawStatus === 'declined'
				? rawStatus
				: 'all';

		const result = await getAdminRsvpList({ eventSlug, status, search });
		return new Response(
			JSON.stringify({
				success: true,
				data: result,
			}),
			{
				status: 200,
				headers: JSON_HEADERS,
			},
		);
	} catch (error) {
		console.error('RSVP API GET Error:', error);
		return new Response(
			JSON.stringify({
				success: false,
				error: {
					code: 'internal_error',
					message: 'Error interno del servidor.',
					details: error instanceof Error ? { stack: error.stack } : undefined,
				},
			}),
			{
				status: 500,
				headers: JSON_HEADERS,
			},
		);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		// Check if request body is empty
		const contentType = request.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			return new Response(
				JSON.stringify({
					success: false,
					error: {
						code: 'bad_request',
						message: 'Content-Type must be application/json',
					},
				}),
				{ status: 400, headers: JSON_HEADERS },
			);
		}

		// Try to parse JSON with error handling
		let rawText: string;
		try {
			rawText = await request.text();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to read request body';
			return new Response(
				JSON.stringify({
					success: false,
					error: {
						code: 'bad_request',
						message: `Failed to read request body: ${message}`,
					},
				}),
				{ status: 400, headers: JSON_HEADERS },
			);
		}

		// Check if body is empty
		if (!rawText.trim()) {
			return new Response(
				JSON.stringify({
					success: false,
					error: {
						code: 'bad_request',
						message: 'Request body is empty',
					},
				}),
				{
					status: 400,
					headers: JSON_HEADERS,
				},
			);
		}

		// Parse JSON
		let raw: unknown;
		try {
			raw = JSON.parse(rawText);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Invalid JSON';
			return new Response(
				JSON.stringify({
					success: false,
					error: {
						code: 'bad_request',
						message: `Invalid JSON format: ${message}`,
					},
				}),
				{
					status: 400,
					headers: JSON_HEADERS,
				},
			);
		}

		// Ensure raw is an object
		if (typeof raw !== 'object' || raw === null) {
			return new Response(
				JSON.stringify({
					success: false,
					error: {
						code: 'bad_request',
						message: 'Request body must be a JSON object',
					},
				}),
				{
					status: 400,
					headers: JSON_HEADERS,
				},
			);
		}

		const body = raw as Record<string, unknown>;

		const eventSlug = sanitize(body.eventSlug, 120);
		const token = sanitize(body.token, 2048);
		const guestName = sanitize(body.guestName || body.name);
		const attendanceStatus = parseAttendanceInput(body.attendanceStatus ?? body.attendance);
		const attendeeCount = parseAttendeeCount(body.attendeeCount ?? body.guestCount);
		const notes = sanitize(body.notes);
		const dietary = sanitize(body.dietary);

		if (!eventSlug || !attendanceStatus) {
			return new Response(
				JSON.stringify({
					success: false,
					error: {
						code: 'bad_request',
						message: 'eventSlug y attendanceStatus son obligatorios.',
					},
				}),
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
				success: true,
				data: {
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
				},
			}),
			{
				status: 200,
				headers: JSON_HEADERS,
			},
		);
	} catch (error) {
		// Log the error for debugging
		console.error('RSVP API POST Error:', error);

		// Always return valid JSON, even for unexpected errors
		const message =
			error instanceof Error ? error.message : String(error || 'Error interno del servidor.');
		const status =
			typeof message === 'string' &&
			(message.includes('obligatorio') || message.includes('inválido'))
				? 400
				: 500;
		return new Response(
			JSON.stringify({
				success: false,
				error: {
					code: status === 400 ? 'bad_request' : 'internal_error',
					message,
					details: error instanceof Error ? { stack: error.stack } : undefined,
				},
			}),
			{
				status,
				headers: JSON_HEADERS,
			},
		);
	}
};
