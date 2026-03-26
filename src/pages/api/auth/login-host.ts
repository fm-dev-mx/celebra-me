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
	assertValidPassword,
	enforceAuthRateLimit,
	normalizeEmail,
	sanitizePassword,
} from '@/lib/rsvp/security/auth-security';

export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;
		const body = bodyResult;

		const email = normalizeEmail(body.email as string);
		const method = body.method === 'magic_link' ? 'magic_link' : 'password';
		assertValidEmail(email);
		await enforceAuthRateLimit({
			request,
			entityId: `login:${email}`,
			maxHits: 8,
			windowSec: 60,
		});

		if (method === 'magic_link') {
			await sendMagicLink({
				email,
				redirectTo: `${url.origin}/dashboard/invitados`,
			});
			return jsonResponse({
				ok: true,
				message: 'Check your email to sign in with a magic link.',
			});
		}

		const password = sanitizePassword(body.password as string);
		assertValidPassword(password);
		let auth: Awaited<ReturnType<typeof signInWithPassword>>;
		try {
			auth = await signInWithPassword({
				email,
				password,
			});
		} catch {
			throw new ApiError(401, 'unauthorized', 'Invalid credentials.');
		}
		const payload = {
			ok: true,
			message: 'Sign-in completed successfully.',
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
			return errorResponse(new ApiError(400, 'bad_request', 'Invalid JSON.'));
		}
		return errorResponse(error);
	}
};
