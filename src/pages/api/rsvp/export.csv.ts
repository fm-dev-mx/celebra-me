import type { APIRoute } from 'astro';
import { getAdminRsvpCsv } from '@/lib/rsvp/service';

function sanitize(value: unknown, maxLen = 120): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const eventSlug = sanitize(url.searchParams.get('eventSlug'));
		if (!eventSlug) {
			return new Response('eventSlug es obligatorio.', { status: 400 });
		}

		const csv = await getAdminRsvpCsv(eventSlug);
		const filename = `rsvp-${eventSlug}-${new Date().toISOString().slice(0, 10)}.csv`;

		return new Response(csv, {
			status: 200,
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		console.error('RSVP export error:', error);
		return new Response('Error interno del servidor.', { status: 500 });
	}
};
