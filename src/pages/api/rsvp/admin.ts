import type { APIRoute } from 'astro';
import { getAdminRsvpList, type AttendanceStatus } from '@/lib/rsvp/service';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function sanitize(value: unknown, maxLen = 120): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function parseStatus(value: string): AttendanceStatus | 'all' {
	if (value === 'pending' || value === 'confirmed' || value === 'declined') return value;
	return 'all';
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const eventSlug = sanitize(url.searchParams.get('eventSlug'));
		const status = parseStatus(sanitize(url.searchParams.get('status')));
		const search = sanitize(url.searchParams.get('search'));

		if (!eventSlug) {
			return new Response(JSON.stringify({ message: 'eventSlug es obligatorio.' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		const data = await getAdminRsvpList({
			eventSlug,
			status,
			search,
		});

		return new Response(JSON.stringify(data), {
			status: 200,
			headers: JSON_HEADERS,
		});
	} catch (error) {
		console.error('RSVP admin list error:', error);
		return new Response(JSON.stringify({ message: 'Error interno del servidor.' }), {
			status: 500,
			headers: JSON_HEADERS,
		});
	}
};
