import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { sendMagicLink, signUpWithPassword } from '@/lib/rsvp/auth/auth-api';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
} from '@/lib/rsvp/auth/cookies';
import {
	assertSameOrigin,
	assertValidClaimCode,
	assertValidEmail,
	assertValidPassword,
	enforceAuthRateLimit,
	normalizeEmail,
	sanitizeClaimCode,
	sanitizePassword,
} from '@/lib/rsvp/security/auth-security';
import {
	claimEventForUserByClaimCode,
	ensureUserRole,
	isSuperAdminEmail,
} from '@/lib/rsvp/services/auth-access.service';
import { generateTemporaryPassword } from '@/lib/rsvp/services/user-admin.service';
import { findExistingAuthUserByEmail } from '@/lib/rsvp/services/auth-identifier.service';

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
				isAdhocAdmin ? 'email is required.' : 'email and claimCode are required.',
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

		const { userId, userEmail, accessToken, refreshToken } = await resolveUser(
			email,
			chosenPassword,
		);

		if (claimCode) {
			await claimEventAndRole(userId, userEmail, claimCode);
		} else {
			await ensureUserRole({
				userId,
				email: userEmail,
				defaultRole: 'host_client',
			});
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
					? 'Account created. Check your email to continue with a magic link.'
					: 'Account created successfully.',
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
			return errorResponse(new ApiError(400, 'bad_request', 'Invalid JSON.'));
		}
		return errorResponse(error);
	}
};

async function resolveUser(email: string, chosenPassword: string) {
	try {
		const signed = await signUpWithPassword({
			email,
			password: chosenPassword,
		});

		return {
			userId: sanitize(signed.user?.id || (signed as { id?: string }).id, 120),
			userEmail: sanitize(
				signed.user?.email || (signed as { email?: string }).email || email,
				320,
			).toLowerCase(),
			accessToken: signed.access_token || '',
			refreshToken: signed.refresh_token || '',
		};
	} catch {
		const existing = await findExistingAuthUserByEmail(email);
		if (!existing) {
			throw new ApiError(
				409,
				'conflict',
				'Unable to complete registration. Verify the data or try signing in.',
			);
		}
		return {
			userId: existing.id,
			userEmail: existing.email || email,
			accessToken: '',
			refreshToken: '',
		};
	}
}

async function claimEventAndRole(userId: string, userEmail: string, claimCode: string) {
	try {
		await claimEventForUserByClaimCode({ userId, claimCode });
		await ensureUserRole({
			userId,
			email: userEmail,
			defaultRole: 'host_client',
		});
	} catch (error) {
		console.error('[Register Host] Post-registration error:', error);
		if (error instanceof ApiError) {
			throw new ApiError(
				error.status,
				error.code,
				error.status === 400
					? `The invitation code is invalid or has already been used. ${error.message}`
					: error.message,
			);
		}
		throw error;
	}
}
