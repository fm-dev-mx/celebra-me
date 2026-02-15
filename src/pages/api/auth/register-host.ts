import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { errorResponse } from '@/lib/rsvp-v2/http';
import { findAuthUserByEmail, sendMagicLink, signUpWithPassword } from '@/lib/rsvp-v2/authApi';
import { buildSessionCookie } from '@/lib/rsvp-v2/cookies';
import {
	claimEventForUser,
	ensureUserRole,
	generateTemporaryPassword,
} from '@/lib/rsvp-v2/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request, url }) => {
	try {
		const body = (await request.json()) as {
			email?: string;
			password?: string;
			eventSlug?: string;
			claimCode?: string;
			method?: 'password' | 'magic_link';
		};

		const email = sanitize(body.email, 320).toLowerCase();
		const eventSlug = sanitize(body.eventSlug, 120);
		const claimCode = sanitize(body.claimCode, 256);
		const method = body.method === 'magic_link' ? 'magic_link' : 'password';

		if (!email || !eventSlug || !claimCode) {
			throw new ApiError(
				400,
				'bad_request',
				'email, eventSlug y claimCode son obligatorios.',
			);
		}

		const chosenPassword =
			method === 'password' ? sanitize(body.password, 200) : generateTemporaryPassword();
		if (method === 'password' && !chosenPassword) {
			throw new ApiError(400, 'bad_request', 'Password es obligatoria.');
		}

		let accessToken = '';
		let userId = '';
		let userEmail = email;
		try {
			const signed = await signUpWithPassword({
				email,
				password: chosenPassword,
			});
			userId = sanitize(signed.user?.id, 120);
			userEmail = sanitize(signed.user?.email || email, 320).toLowerCase();
			accessToken = sanitize(signed.access_token, 4096);
		} catch {
			const existing = await findAuthUserByEmail({
				email,
			});
			if (!existing) {
				throw new ApiError(
					409,
					'conflict',
					'No se pudo crear cuenta. Verifica el email o intenta iniciar sesión.',
				);
			}
			userId = existing.id;
		}

		if (!userId) {
			throw new ApiError(409, 'conflict', 'No se pudo resolver el usuario para el registro.');
		}

		await claimEventForUser({
			userId,
			eventSlug,
			claimCode,
		});
		await ensureUserRole({
			userId,
			email: userEmail,
			defaultRole: 'host_client',
		});

		if (method === 'magic_link') {
			await sendMagicLink({
				email,
				redirectTo: `${url.origin}/dashboard/invitados`,
			});
		}

		const payload = {
			ok: true,
			message:
				method === 'magic_link'
					? 'Cuenta creada. Revisa tu correo para ingresar con Magic Link.'
					: 'Cuenta creada correctamente.',
			next: '/dashboard/invitados',
		};

		if (accessToken) {
			return new Response(JSON.stringify(payload), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Set-Cookie': buildSessionCookie(accessToken),
				},
			});
		}
		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	} catch (error) {
		return errorResponse(error);
	}
};
