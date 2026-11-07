import type { APIRoute } from 'astro';
import { errorResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import { ApiError, isAuthRequestError } from '@/lib/rsvp/core/errors';
import { getSupabaseUserByAccessToken, requireSessionContext } from '@/lib/rsvp/auth/auth';
import { challengeMfaFactor, verifyMfaFactor } from '@/lib/rsvp/auth/auth-api';
import { hasMfaEvidence } from '@/lib/rsvp/auth/auth-mfa-evidence';
import { buildElevatedSessionHeaders } from '@/lib/rsvp/auth/elevated-session';
import { assertSameOrigin, enforceAuthRateLimit } from '@/lib/rsvp/security/auth-security';
import { logSecurityEvent } from '@/lib/server/security-events';
import { safeErr } from '@/lib/server/safe-error';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^\d{6}$/;

function parseVerifyInput(body: Record<string, unknown>) {
	const factorId = typeof body.factorId === 'string' ? body.factorId : '';
	const code = typeof body.code === 'string' ? body.code.trim() : '';
	const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
	if (!UUID_PATTERN.test(factorId) || (challengeId && !UUID_PATTERN.test(challengeId))) {
		throw new ApiError(400, 'bad_request', 'Invalid factor.');
	}
	if (!CODE_PATTERN.test(code)) {
		throw new ApiError(400, 'bad_request', 'El código debe tener 6 dígitos.');
	}
	return { factorId, challengeId, code };
}

function mapVerifyFailure(error: unknown): unknown {
	if (!isAuthRequestError(error)) return error;
	logSecurityEvent('mfa_failed', { reason: 'verify_rejected' });
	console.error('[mfa-verify] Verification failed:', safeErr(error));
	if (error.status === 400 || error.status === 422) {
		return new ApiError(
			400,
			'bad_request',
			'El código ingresado no es válido. Verifique su app e inténtelo otra vez.',
		);
	}
	return new ApiError(
		503,
		'service_unavailable',
		'No se pudo validar el código. Inténtelo de nuevo.',
	);
}

/**
 * Verifies the TOTP code server-side and, on success, replaces the session cookies with the
 * MFA-elevated httpOnly tokens (and stores the trusted device). The browser never sees a token.
 */
export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);
		await enforceAuthRateLimit({ request, entityId: 'mfa-verify', maxHits: 10, windowSec: 60 });

		const session = await requireSessionContext(request);
		if (!session.isSuperAdmin) {
			throw new ApiError(403, 'forbidden', 'Forbidden.');
		}

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;

		const input = parseVerifyInput(bodyResult);
		let { challengeId } = input;

		let verified;
		try {
			if (!challengeId) {
				challengeId = await challengeMfaFactor(session.accessToken, input.factorId);
			}
			verified = await verifyMfaFactor({
				accessToken: session.accessToken,
				factorId: input.factorId,
				challengeId,
				code: input.code,
			});
		} catch (error) {
			throw mapVerifyFailure(error);
		}

		const elevatedUser = await getSupabaseUserByAccessToken(verified.accessToken);
		if (
			!elevatedUser ||
			elevatedUser.id !== session.userId ||
			!hasMfaEvidence({ token: verified.accessToken, amr: elevatedUser.amr })
		) {
			logSecurityEvent('mfa_failed', { reason: 'missing_mfa_evidence' });
			throw new ApiError(403, 'forbidden', 'The session does not contain MFA verification.');
		}

		const headers = await buildElevatedSessionHeaders({
			accessToken: verified.accessToken,
			refreshToken: verified.refreshToken,
			userId: elevatedUser.id,
			role: elevatedUser.app_metadata?.role,
			userAgent: request.headers.get('user-agent') || '',
		});
		return new Response(JSON.stringify({ ok: true, next: '/dashboard/admin' }), {
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
