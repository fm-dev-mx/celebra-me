import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, jsonResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { sendMagicLink, signInWithPassword } from '@/lib/rsvp/auth/auth-api';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
} from '@/lib/rsvp/auth/cookies';
import {
	assertSameOrigin,
	assertValidEmail,
	assertValidLoginIdentifier,
	assertValidPassword,
	enforceAuthRateLimit,
	normalizeEmail,
	normalizeLoginIdentifier,
	sanitizePassword,
} from '@/lib/rsvp/security/auth-security';
import { resolvePasswordAuthEmail } from '@/lib/rsvp/services/auth-identifier.service';

/**
 * Classifies an error thrown during signInWithPassword into an appropriate
 * ApiError with a safe user-facing message.  No internal hostnames, keys,
 * upstream bodies or stack traces are exposed to the client.
 */
function classifySignInError(cause: unknown, identifier: string): ApiError {
	if (!(cause instanceof Error)) {
		return new ApiError(500, 'internal_error', 'Error interno del servidor.');
	}

	// Network-level failure — Supabase is unreachable.
	if (cause.message === 'auth-request-failed') {
		console.error('[login] auth: unreachable (503)');
		return new ApiError(503, 'service_unavailable', 'Servicio de autenticación no disponible.');
	}

	// Upstream responded with an error status.
	const match = cause.message.match(/^Supabase auth error \((\d+)\)\.$/);
	if (match) {
		const status = Number(match[1]);
		const stage = (cause as Error & { _stage?: string })._stage ?? 'response';

		if (status === 401 || status === 400) {
			console.error('[login] auth: invalid credentials (401)', JSON.stringify({ identifier }));
			return new ApiError(401, 'unauthorized', 'Credenciales inválidas.');
		}

		if (status >= 500) {
			console.error('[login] auth: upstream 5xx', JSON.stringify({ status, stage }));
			return new ApiError(502, 'upstream_error', 'Error del servicio de autenticación.');
		}

		// Other 4xx statuses (429, 403, etc.) — return as-is.
		console.error('[login] auth: unexpected response', JSON.stringify({ status, stage }));
		return new ApiError(status, 'upstream_error', 'Error del servicio de autenticación.');
	}

	// Unknown error type — log and return generic 500.
	console.error('[login] auth: unhandled error', JSON.stringify({
		errorName: cause.constructor.name,
		errorMessage: cause.message,
	}));
	return new ApiError(500, 'internal_error', 'Error interno del servidor.');
}

export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const identifier = normalizeLoginIdentifier(body.email as string);
		const method = body.method === 'magic_link' ? 'magic_link' : 'password';

		if (method === 'magic_link') {
			const email = normalizeEmail(body.email as string);
			assertValidEmail(email);
			await enforceAuthRateLimit({
				request,
				entityId: `login:${email}`,
				maxHits: 8,
				windowSec: 60,
			});
			await sendMagicLink({
				email,
				redirectTo: `${url.origin}/dashboard/invitados`,
			});
			return jsonResponse({
				ok: true,
				message: 'Revisa tu correo para iniciar sesión con un enlace mágico.',
			});
		}

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
			throw classifySignInError(cause, identifier);
		}
		const payload = {
			ok: true,
			message: 'Sesión iniciada con éxito.',
			next: '/dashboard/invitados',
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
