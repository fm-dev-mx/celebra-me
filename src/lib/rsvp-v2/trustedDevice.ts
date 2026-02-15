import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '@/utils/env';
import { normalizeAppRole } from './roles';
import type { AppUserRole } from './types';

interface TrustedDevicePayload {
	sub: string;
	role: AppUserRole;
	iat: number;
	exp: number;
	uaHash: string;
	ver: number;
}

const TRUST_DEVICE_VERSION = 1;

function sanitize(value: unknown, maxLen = 4096): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

function toBase64Url(input: string): string {
	return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
	return Buffer.from(input, 'base64url').toString('utf8');
}

function getSecret(): string {
	const secret = sanitize(getEnv('TRUST_DEVICE_SECRET'), 512);
	if (process.env.NODE_ENV === 'production' && !secret) {
		throw new Error('TRUST_DEVICE_SECRET es obligatoria en producción.');
	}
	return secret || 'dev-trust-device-secret';
}

function getMaxAgeSeconds(): number {
	const raw = sanitize(getEnv('TRUST_DEVICE_MAX_AGE_DAYS'), 16);
	const days = Number.parseInt(raw || '30', 10);
	const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
	return safeDays * 24 * 60 * 60;
}

function hashUserAgent(userAgent: string): string {
	return createHash('sha256').update(sanitize(userAgent, 1024)).digest('hex');
}

function signPayload(payloadBase64: string): string {
	return createHmac('sha256', getSecret()).update(payloadBase64).digest('base64url');
}

export function createTrustedDeviceToken(input: {
	userId: string;
	role: AppUserRole;
	userAgent: string;
	nowUnix?: number;
}): { token: string; maxAgeSeconds: number } {
	const maxAgeSeconds = getMaxAgeSeconds();
	const now = input.nowUnix ?? Math.floor(Date.now() / 1000);
	const payload: TrustedDevicePayload = {
		sub: sanitize(input.userId, 120),
		role: input.role,
		iat: now,
		exp: now + maxAgeSeconds,
		uaHash: hashUserAgent(input.userAgent),
		ver: TRUST_DEVICE_VERSION,
	};
	const encoded = toBase64Url(JSON.stringify(payload));
	const signature = signPayload(encoded);
	return { token: `${encoded}.${signature}`, maxAgeSeconds };
}

export function verifyTrustedDeviceToken(input: {
	token: string;
	userId: string;
	userAgent: string;
	role?: AppUserRole | null;
	nowUnix?: number;
}): boolean {
	const rawToken = sanitize(input.token);
	if (!rawToken || !rawToken.includes('.')) return false;
	const [encodedPayload, providedSignature] = rawToken.split('.');
	if (!encodedPayload || !providedSignature) return false;

	const expectedSignature = signPayload(encodedPayload);
	const provided = Buffer.from(providedSignature);
	const expected = Buffer.from(expectedSignature);
	if (provided.length !== expected.length) return false;
	if (!timingSafeEqual(provided, expected)) return false;

	let payload: TrustedDevicePayload;
	try {
		payload = JSON.parse(fromBase64Url(encodedPayload)) as TrustedDevicePayload;
	} catch {
		return false;
	}

	const now = input.nowUnix ?? Math.floor(Date.now() / 1000);
	if (payload.ver !== TRUST_DEVICE_VERSION) return false;
	if (payload.sub !== sanitize(input.userId, 120)) return false;
	if (payload.exp <= now || payload.iat > now) return false;
	if (payload.uaHash !== hashUserAgent(input.userAgent)) return false;
	if (normalizeAppRole(payload.role) !== 'super_admin') return false;
	if (input.role && payload.role !== input.role) return false;
	return true;
}
