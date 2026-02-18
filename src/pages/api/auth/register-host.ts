import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/errors';
import { errorResponse, parseJsonBody } from '@/lib/rsvp/http';
import { findAuthUserByEmail, sendMagicLink, signUpWithPassword } from '@/lib/rsvp/authApi';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
} from '@/lib/rsvp/cookies';
import {
	assertSameOrigin,
	assertValidClaimCode,
	assertValidEmail,
	assertValidPassword,
	enforceAuthRateLimit,
	normalizeEmail,
	sanitizeClaimCode,
	sanitizePassword,
} from '@/lib/rsvp/authSecurity';
import {
	claimEventForUserByClaimCode,
	ensureUserRole,
	generateTemporaryPassword,
	isSuperAdminEmail,
} from '@/lib/rsvp/service';

function sanitize(value: unknown, maxLen = 200): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const email = normalizeEmail(body.email as string);
		void sanitize(body.eventSlug as string, 120);
		const claimCode = sanitizeClaimCode(body.claimCode as string);
		const method = body.method === 'magic_link' ? 'magic_link' : 'password';
		assertValidEmail(email);
		await enforceAuthRateLimit({
			request,
			entityId: `register:${email}`,
			maxHits: 6,
			windowSec: 60,
		});

		const isAdhocAdmin = isSuperAdminEmail(email);

		if (!claimCode && !isAdhocAdmin) {
			throw new ApiError(
				400,
				'bad_request',
				isAdhocAdmin ? 'email es obligatorio.' : 'email y claimCode son obligatorios.',
			);
		}
		if (claimCode) assertValidClaimCode(claimCode);

		const chosenPassword =
			method === 'password'
				? sanitizePassword(body.password as string)
				: generateTemporaryPassword();
		if (method === 'password') {
			assertValidPassword(chosenPassword);
		}

		let accessToken = '';
		let refreshToken = '';
		let userId = '';
		let userEmail = email;
		try {
			const signed = await signUpWithPassword({
				email,
				password: chosenPassword,
			});
			// Supabase returns { user: { id } } if confirmation is OFF,
			// but might return the user object directly { id } if confirmation is ON.
			userId = sanitize(signed.user?.id || (signed as { id?: string }).id, 120);
			userEmail = sanitize(
				signed.user?.email || (signed as { email?: string }).email || email,
				320,
			).toLowerCase();
			accessToken = signed.access_token || '';
			refreshToken = signed.refresh_token || '';
		} catch {
			const existing = await findAuthUserByEmail({
				email,
			});
			if (!existing) {
				throw new ApiError(
					409,
					'conflict',
					'No se pudo completar el registro. Verifica los datos o intenta iniciar sesión.',
				);
			}
			userId = existing.id;
			userEmail = existing.email || email;
		}

		if (!userId) {
			throw new ApiError(409, 'conflict', 'No se pudo resolver el usuario para el registro.');
		}

		if (claimCode) {
			try {
				await claimEventForUserByClaimCode({
					userId,
					claimCode,
				});
			} catch (claimError) {
				console.error('[Register Host] Claim code error:', claimError);
				if (claimError instanceof ApiError) {
					throw new ApiError(
						claimError.status,
						claimError.code,
						`El código de invitación no es válido o ya fue usado. ${claimError.message}`,
					);
				}
				throw new ApiError(
					400,
					'bad_request',
					`Error al procesar el código de invitación. ${claimError instanceof Error ? claimError.message : 'Detalles no disponibles'}`,
				);
			}
		}
		try {
			await ensureUserRole({
				userId,
				email: userEmail,
				defaultRole: 'host_client',
			});
		} catch (roleError) {
			console.error('[Register Host] Error ensuring user role:', roleError);
			throw new ApiError(
				500,
				'internal_error',
				'Error al configurar los permisos de usuario.',
			);
		}

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
			const headers = new Headers({ 'Content-Type': 'application/json' });
			headers.append('Set-Cookie', buildSessionCookie(accessToken));
			headers.append('Set-Cookie', buildIdleActivityCookie(Math.floor(Date.now() / 1000)));
			if (refreshToken) {
				headers.append('Set-Cookie', buildRefreshTokenCookie(refreshToken));
			}
			return new Response(JSON.stringify(payload), {
				status: 200,
				headers,
			});
		}

		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	} catch (error: unknown) {
		if (error instanceof SyntaxError) {
			return errorResponse(new ApiError(400, 'bad_request', 'JSON inválido.'));
		}
		return errorResponse(error);
	}
};
