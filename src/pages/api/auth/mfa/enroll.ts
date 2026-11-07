import type { APIRoute } from 'astro';
import { errorResponse } from '@/lib/rsvp/core/http';
import { ApiError, isAuthRequestError } from '@/lib/rsvp/core/errors';
import { requireSessionContext } from '@/lib/rsvp/auth/auth';
import {
	challengeMfaFactor,
	enrollMfaTotp,
	listMfaFactors,
	unenrollMfaFactor,
} from '@/lib/rsvp/auth/auth-api';
import { assertSameOrigin, enforceAuthRateLimit } from '@/lib/rsvp/security/auth-security';
import { safeErr } from '@/lib/server/safe-error';

const newestFirst = (a: { created_at?: string }, b: { created_at?: string }) =>
	(Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0);

/**
 * Starts the TOTP setup for a super admin with the httpOnly session: reuses a verified factor
 * (returns a fresh challenge) or enrolls a new one (returns QR and manual secret). The tokens never
 * reach the browser.
 */
export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);
		await enforceAuthRateLimit({ request, entityId: 'mfa-enroll', maxHits: 10, windowSec: 60 });

		const session = await requireSessionContext(request);
		if (!session.isSuperAdmin) {
			throw new ApiError(403, 'forbidden', 'Forbidden.');
		}

		try {
			const totpFactors = (await listMfaFactors(session.accessToken)).filter(
				(factor) => factor.factor_type === 'totp',
			);
			const verified = totpFactors
				.filter((factor) => factor.status === 'verified')
				.sort(newestFirst)[0];

			if (verified) {
				const challengeId = await challengeMfaFactor(session.accessToken, verified.id);
				return jsonResponse({
					ok: true,
					mode: 'verify',
					factorId: verified.id,
					challengeId,
				});
			}

			for (const factor of totpFactors.filter((item) => item.status === 'unverified')) {
				await unenrollMfaFactor(session.accessToken, factor.id);
			}
			const enrollment = await enrollMfaTotp(session.accessToken);
			const challengeId = await challengeMfaFactor(session.accessToken, enrollment.id);
			return jsonResponse({
				ok: true,
				mode: 'enroll',
				factorId: enrollment.id,
				challengeId,
				qrCode: enrollment.qrCode,
				secret: enrollment.secret,
			});
		} catch (error) {
			if (isAuthRequestError(error)) {
				console.error('[mfa-enroll] Enrollment failed:', safeErr(error));
				throw new ApiError(
					error.status === 401 || error.status === 403 ? 401 : 503,
					error.status === 401 || error.status === 403
						? 'unauthorized'
						: 'service_unavailable',
					'No se pudo preparar la verificación en dos pasos. Inténtelo de nuevo.',
				);
			}
			throw error;
		}
	} catch (error) {
		return errorResponse(error);
	}
};

function jsonResponse(body: Record<string, unknown>): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
	});
}
