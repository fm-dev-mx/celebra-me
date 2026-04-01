import { ApiError } from '@/lib/rsvp/core/errors';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { sanitize } from '@/lib/rsvp/core/utils';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLAIM_CODE_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

export function normalizeEmail(value: unknown): string {
	return sanitize(value, 320).toLowerCase();
}

export function sanitizePassword(value: unknown): string {
	return sanitize(value, 200);
}

export function sanitizeToken(value: unknown): string {
	return sanitize(value, 4096);
}

export function sanitizeClaimCode(value: unknown): string {
	return sanitize(value, 128);
}

export function assertValidEmail(email: string): void {
	if (!email || !EMAIL_PATTERN.test(email)) {
		throw new ApiError(400, 'bad_request', 'El correo electrónico es inválido.');
	}
}

export function assertValidPassword(password: string): void {
	if (!password) {
		throw new ApiError(400, 'bad_request', 'La contraseña es requerida.');
	}
	if (password.length < 8 || password.length > 200) {
		throw new ApiError(
			400,
			'bad_request',
			'La contraseña debe tener entre 8 y 200 caracteres.',
		);
	}
}

export function assertValidClaimCode(claimCode: string): void {
	if (!claimCode || !CLAIM_CODE_PATTERN.test(claimCode)) {
		throw new ApiError(400, 'bad_request', 'El código de invitación es inválido.');
	}
}

export function assertSameOrigin(request: Request, expectedOrigin: string): void {
	const origin = sanitize(request.headers.get('origin'), 512);
	if (origin && origin !== expectedOrigin) {
		throw new ApiError(403, 'forbidden', 'El origen es inválido.');
	}

	const referer = sanitize(request.headers.get('referer'), 1024);
	if (referer) {
		try {
			const refererOrigin = new URL(referer).origin;
			if (refererOrigin !== expectedOrigin) {
				throw new ApiError(403, 'forbidden', 'El origen es inválido.');
			}
		} catch {
			throw new ApiError(403, 'forbidden', 'El referente es inválido.');
		}
	}
}

export function readClientIp(request: Request): string {
	const forwardedFor = sanitize(request.headers.get('x-forwarded-for'), 200);
	if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';
	const realIp = sanitize(request.headers.get('x-real-ip'), 120);
	if (realIp) return realIp;
	return 'unknown';
}

export async function enforceAuthRateLimit(input: {
	request: Request;
	entityId: string;
	maxHits: number;
	windowSec: number;
}): Promise<void> {
	const allowed = await checkRateLimit({
		namespace: 'auth',
		entityId: input.entityId,
		ip: readClientIp(input.request),
		maxHits: input.maxHits,
		windowSec: input.windowSec,
	});
	if (!allowed) {
		throw new ApiError(
			429,
			'rate_limited',
			'Demasiados intentos. Inténtalo de nuevo más tarde.',
		);
	}
}
