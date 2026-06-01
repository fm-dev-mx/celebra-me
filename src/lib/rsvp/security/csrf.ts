/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Synchronizer token pattern implementation.
 * - The server generates a CSRF token and stores a hash in a cookie.
 * - The client sends the raw token in the X-CSRF-Token header.
 * - The server validates that both tokens match.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generates a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
	return randomBytes(TOKEN_LENGTH).toString('base64url');
}

/**
 * Hashes a CSRF token before storing it.
 */
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('base64url');
}

/**
 * Creates and stores a fresh CSRF token in cookies.
 */
export function setCsrfToken(cookies: AstroCookies): string {
	const token = generateCsrfToken();
	const hashedToken = hashToken(token);

	// Restrict cookie transport in production.
	const isProduction = process.env.NODE_ENV === 'production';

	cookies.set(CSRF_COOKIE_NAME, hashedToken, {
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict',
		path: '/',
		maxAge: 60 * 60 * 24, // 24 hours
	});

	return token;
}

/**
 * Reads the hashed CSRF token from cookies.
 */
export function getCsrfTokenFromCookies(cookies: AstroCookies): string | undefined {
	return cookies.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Reads the raw CSRF token from the request header.
 */
export function getCsrfTokenFromHeader(request: Request): string | undefined {
	return request.headers.get(CSRF_HEADER_NAME)?.trim() || undefined;
}

/**
 * Validates the request CSRF token against the cookie token.
 */
export function validateCsrfToken(request: Request, cookies: AstroCookies): void {
	// Only enforce CSRF for state-changing methods.
	const method = request.method.toUpperCase();
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		return; // GET, HEAD, and OPTIONS do not mutate state.
	}

	// Development keeps a looser policy to simplify local testing.
	const isProduction = process.env.NODE_ENV === 'production';

	const cookieToken = getCsrfTokenFromCookies(cookies);
	const headerToken = getCsrfTokenFromHeader(request);

	// No cookie token usually means there is no authenticated session yet.
	if (!cookieToken) {
		return;
	}

	// A missing header token while a cookie token exists is suspicious.
	if (!headerToken) {
		if (isProduction) {
			throw new ApiError(
				403,
				'forbidden',
				'Token CSRF faltante. Por favor recarga la página e intenta de nuevo.',
			);
		}
		console.warn('Missing CSRF token in development mode');
		return;
	}

	// Compare the hashed request token with the stored cookie hash.
	const hashedHeaderToken = hashToken(headerToken);

	// Use constant-time comparison to reduce timing side channels.
	if (
		cookieToken.length !== hashedHeaderToken.length ||
		!timingSafeEqual(Buffer.from(cookieToken), Buffer.from(hashedHeaderToken))
	) {
		throw new ApiError(
			403,
			'forbidden',
			'Token CSRF inválido. Por favor recarga la página e intenta de nuevo.',
		);
	}
}

/**
 * Removes the CSRF token cookie.
 */
export function clearCsrfToken(cookies: AstroCookies): void {
	cookies.delete(CSRF_COOKIE_NAME, { path: '/' });
}

/**
 * Returns true when a path should bypass CSRF validation.
 */
export function shouldSkipCsrfValidation(pathname: string): boolean {
	// Webhooks and externally authenticated integrations do not use CSRF.
	const skipPaths = ['/api/webhook', '/api/stripe', '/api/supabase'];

	return skipPaths.some((path) => pathname.startsWith(path));
}
