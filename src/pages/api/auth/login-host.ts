import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { errorResponse, jsonResponse } from '@/lib/rsvp-v2/http';
import { sendMagicLink, signInWithPassword } from '@/lib/rsvp-v2/authApi';
import { buildSessionCookie } from '@/lib/rsvp-v2/cookies';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request, url }) => {
	try {
		const body = (await request.json()) as {
			email?: string;
			password?: string;
			method?: 'password' | 'magic_link';
		};

		const email = sanitize(body.email, 320).toLowerCase();
		const method = body.method === 'magic_link' ? 'magic_link' : 'password';
		if (!email) throw new ApiError(400, 'bad_request', 'Email es obligatorio.');

		if (method === 'magic_link') {
			await sendMagicLink({
				email,
				redirectTo: `${url.origin}/dashboard/invitados`,
			});
			return jsonResponse({
				ok: true,
				message: 'Revisa tu correo para iniciar sesión con Magic Link.',
			});
		}

		const password = sanitize(body.password, 200);
		if (!password) throw new ApiError(400, 'bad_request', 'Password es obligatoria.');
		const auth = await signInWithPassword({
			email,
			password,
		});
		return new Response(
			JSON.stringify({
				ok: true,
				message: 'Inicio de sesión exitoso.',
				next: '/dashboard/invitados',
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Set-Cookie': buildSessionCookie(auth.access_token),
				},
			},
		);
	} catch (error) {
		return errorResponse(error);
	}
};
