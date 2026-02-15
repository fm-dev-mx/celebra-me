import type { APIRoute } from 'astro';
import { clearSessionCookie } from '@/lib/rsvp-v2/cookies';

export const POST: APIRoute = async () =>
	new Response(JSON.stringify({ ok: true, message: 'Sesion cerrada.' }), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': clearSessionCookie(),
		},
	});
