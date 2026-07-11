/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Synchronizer token pattern implementation.
 * - The server stores the raw token in an HttpOnly cookie.
 * - Authenticated dashboard pages receive the same token in metadata.
 * - The client sends that token in the X-CSRF-Token header.
 * - The server validates that both values match.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

interface CsrfTokenCookieStore {
	get(name: string): { value: string } | undefined;
	set(
		name: string,
		value: string,
		options: {
			httpOnly: boolean;
			secure: boolean;
			sameSite: 'strict';
			path: string;
			maxAge: number;
		},
	): void;
}

/**
 * Generates a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
	return randomBytes(TOKEN_LENGTH).toString('base64url');
}

/**
 * Returns the existing session token or creates one when the dashboard first
 * needs it. Reusing the token keeps independently open dashboard tabs valid.
 */
export function setCsrfToken(cookies: CsrfTokenCookieStore): string {
	const existingToken = cookies.get(CSRF_COOKIE_NAME)?.value;
	if (existingToken) return existingToken;

	const token = generateCsrfToken();

	// Restrict cookie transport in production.
	const isProduction = process.env.NODE_ENV === 'production';

	cookies.set(CSRF_COOKIE_NAME, token, {
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict',
		path: '/',
		maxAge: 60 * 60 * 24, // 24 hours
	});

	return token;
}

/**
 * Reads the raw CSRF token from the HttpOnly cookie.
 */
export function getCsrfTokenFromCookies(cookies: Pick<CsrfTokenCookieStore, 'get'>): string | undefined {
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

	const cookieToken = getCsrfTokenFromCookies(cookies);
	const headerToken = getCsrfTokenFromHeader(request);

	if (!cookieToken) {
		throw new ApiError(
			403,
			'forbidden',
			'Token CSRF faltante. Por favor recarga la página e intenta de nuevo.',
		);
	}

	if (!headerToken) {
		throw new ApiError(
			403,
			'forbidden',
			'Token CSRF faltante. Por favor recarga la página e intenta de nuevo.',
		);
	}

	// Use constant-time comparison to reduce timing side channels.
	if (
		cookieToken.length !== headerToken.length ||
		!timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
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
