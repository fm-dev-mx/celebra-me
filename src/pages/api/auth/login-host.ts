import { normalizeAppRole } from '@/lib/rsvp/auth/roles';
import type { APIRoute } from 'astro';
import { ApiError, isAuthRequestError, isRejectedAuthCredential } from '@/lib/rsvp/core/errors';
import { errorResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { signInWithPassword } from '@/lib/rsvp/auth/auth-api';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
} from '@/lib/rsvp/auth/cookies';
import {
	assertSameOrigin,
	assertValidLoginIdentifier,
	assertValidPassword,
	enforceAuthRateLimit,
	normalizeLoginIdentifier,
	sanitizePassword,
} from '@/lib/rsvp/security/auth-security';
import { resolvePasswordAuthEmail } from '@/lib/rsvp/services/auth-identifier.service';

/**
 * Classifies an error thrown during signInWithPassword into an appropriate
 * ApiError with a safe user-facing message.  No internal hostnames, keys,
 * upstream bodies or stack traces are exposed to the client.
 */
function classifySignInError(cause: unknown): Error {
	if (isRejectedAuthCredential(cause) && (cause.status === 400 || cause.status === 401)) {
		return new ApiError(401, 'unauthorized', 'Credenciales inválidas.');
	}
	if (isAuthRequestError(cause)) {
		if (cause.retryable) return cause;
		return new ApiError(
			cause.status && cause.status >= 400 && cause.status < 500 ? cause.status : 502,
			'upstream_error',
			'Error del servicio de autenticación.',
		);
	}
	return new ApiError(500, 'internal_error', 'Error interno del servidor.');
}

export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		// Hosts sign in with a password only; any other method is a bad request.
		if (body.method !== undefined && body.method !== 'password') {
			throw new ApiError(400, 'bad_request', 'El método de acceso es inválido.');
		}

		const identifier = normalizeLoginIdentifier(body.email as string);
		assertValidLoginIdentifier(identifier);
		await enforceAuthRateLimit({
			request,
			entityId: `login:${identifier}`,
			maxHits: 8,
			windowSec: 60,
		});

		const password = sanitizePassword(body.password as string);
		assertValidPassword(password);
		const authEmail = await resolvePasswordAuthEmail(identifier);
		if (!authEmail) {
			return errorResponse(new ApiError(401, 'unauthorized', 'Credenciales inválidas.'));
		}
		let auth: Awaited<ReturnType<typeof signInWithPassword>>;
		try {
			auth = await signInWithPassword({
				email: authEmail,
				password,
			});
		} catch (cause) {
			throw classifySignInError(cause);
		}
		if (!normalizeAppRole(auth.user.app_metadata?.role)) {
			throw new ApiError(
				403,
				'account_access_incomplete',
				'Su cuenta requiere que el administrador complete el acceso. Comuníquese con él para continuar.',
			);
		}
		const payload = {
			ok: true,
			message: 'Sesión iniciada con éxito.',
			next:
				auth.user.app_metadata?.must_change_password === true
					? '/dashboard/cambiar-contrasena'
					: '/dashboard/invitados',
		};

		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', buildSessionCookie(auth.access_token));
		headers.append('Set-Cookie', buildIdleActivityCookie(Math.floor(Date.now() / 1000)));
		if (auth.refresh_token) {
			headers.append('Set-Cookie', buildRefreshTokenCookie(auth.refresh_token));
		}

		return new Response(JSON.stringify(payload), {
			status: 200,
			headers,
		});
	} catch (error: unknown) {
		if (error instanceof SyntaxError) {
			return errorResponse(new ApiError(400, 'bad_request', 'JSON inválido.'));
		}
		return errorResponse(error);
	}
};
