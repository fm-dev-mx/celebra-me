import type { APIRoute } from 'astro';

const MAX_FIELD_LENGTH = 200;
const VALID_ATTENDANCE = ['yes', 'no'] as const;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Trim and cap a string field to prevent abuse. */
function sanitize(value: unknown, maxLen = MAX_FIELD_LENGTH): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const raw = await request.json();

		// Sanitise inputs
		const name = sanitize(raw.name);
		const attendance = sanitize(raw.attendance);
		const guestCount =
			typeof raw.guestCount === 'number' ? Math.max(0, Math.min(raw.guestCount, 20)) : 0;
		const notes = sanitize(raw.notes);
		const dietary = sanitize(raw.dietary);

		// Validation
		if (!name || !attendance) {
			return new Response(JSON.stringify({ message: 'Faltan campos obligatorios.' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		if (!VALID_ATTENDANCE.includes(attendance as (typeof VALID_ATTENDANCE)[number])) {
			return new Response(JSON.stringify({ message: 'Valor de asistencia inválido.' }), {
				status: 400,
				headers: JSON_HEADERS,
			});
		}

		// TODO: Replace with real persistence (Astro DB / Supabase).
		// For now, we simulate a successful submission.
		const payload = { name, attendance, guestCount, notes, dietary };
		console.info('[RSVP] Confirmation received:', JSON.stringify(payload));
		await new Promise((resolve) => setTimeout(resolve, 800));

		return new Response(JSON.stringify({ message: '¡Confirmación recibida con éxito!' }), {
			status: 200,
			headers: JSON_HEADERS,
		});
	} catch (error) {
		console.error('RSVP API Error:', error);
		return new Response(JSON.stringify({ message: 'Error interno del servidor.' }), {
			status: 500,
			headers: JSON_HEADERS,
		});
	}
};
