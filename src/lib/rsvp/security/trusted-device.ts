import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getEnv } from '@/lib/server/env';
import { normalizeAppRole } from '@/lib/rsvp/auth/roles';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { AppUserRole } from '@/interfaces/auth/session.interface';

/**
 * Trusted devices are rows in `public.trusted_devices`. The `sb-trust-device` cookie carries
 * `<device id>.<random secret>`; only the SHA-256 of the secret is stored, so a leaked table
 * cannot mint cookies and the account can revoke every device from the server.
 */

interface TrustedDeviceRow {
	id: string;
	user_id: string;
	secret_hash: string;
	user_agent_hash: string;
	created_at: string;
	last_seen_at: string;
	revoked_at: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

function sanitize(value: unknown, maxLen = 4096): string {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLen);
}

/**
 * SHA-256 of the value, keyed with the optional server pepper so a leaked table alone cannot be
 * matched against guessed secrets or user agents. The secret itself is 256 random bits.
 */
function sha256Hex(value: string): string {
	return createHmac('sha256', getEnv('TRUST_DEVICE_SECRET') || '')
		.update(value)
		.digest('hex');
}

function getMaxAgeSeconds(): number {
	const raw = sanitize(getEnv('TRUST_DEVICE_MAX_AGE_DAYS'), 16);
	const days = Number.parseInt(raw || '30', 10);
	const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
	return safeDays * 24 * 60 * 60;
}

function hashUserAgent(userAgent: string): string {
	return sha256Hex(sanitize(userAgent, 1024));
}

function hashesMatch(provided: string, expected: string): boolean {
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function createTrustedDevice(input: {
	userId: string;
	role: AppUserRole;
	userAgent: string;
}): Promise<{ token: string; maxAgeSeconds: number }> {
	if (normalizeAppRole(input.role) !== 'super_admin') {
		throw new Error('Only super administrators can trust a device.');
	}
	const secret = randomBytes(32).toString('base64url');
	const rows = await supabaseRestRequest<Array<{ id: string }>>({
		pathWithQuery: 'trusted_devices?select=id',
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			user_id: sanitize(input.userId, 120),
			secret_hash: sha256Hex(secret),
			user_agent_hash: hashUserAgent(input.userAgent),
		},
	});
	const id = rows[0]?.id;
	if (!id) throw new Error('The trusted device could not be stored.');
	return { token: `${id}.${secret}`, maxAgeSeconds: getMaxAgeSeconds() };
}

/**
 * Fails closed: any malformed cookie, missing or revoked row, expired age, user agent mismatch,
 * or storage error means the device is not trusted.
 */
export async function verifyTrustedDevice(input: {
	token: string;
	userId: string;
	userAgent: string;
	role?: AppUserRole | null;
	nowMs?: number;
}): Promise<boolean> {
	const rawToken = sanitize(input.token);
	const separator = rawToken.indexOf('.');
	if (separator <= 0) return false;
	const deviceId = rawToken.slice(0, separator);
	const secret = rawToken.slice(separator + 1);
	if (!UUID_PATTERN.test(deviceId) || !secret) return false;
	if (input.role !== undefined && normalizeAppRole(input.role) !== 'super_admin') return false;

	try {
		const rows = await supabaseRestRequest<TrustedDeviceRow[]>({
			pathWithQuery:
				`trusted_devices?select=*&id=eq.${encodeURIComponent(deviceId)}` +
				`&user_id=eq.${encodeURIComponent(sanitize(input.userId, 120))}&limit=1`,
			useServiceRole: true,
		});
		const row = rows[0];
		if (!row || row.revoked_at) return false;

		const now = input.nowMs ?? Date.now();
		if (Date.parse(row.created_at) + getMaxAgeSeconds() * 1000 <= now) return false;
		if (!hashesMatch(sha256Hex(secret), row.secret_hash)) return false;
		if (!hashesMatch(hashUserAgent(input.userAgent), row.user_agent_hash)) return false;

		if (now - Date.parse(row.last_seen_at) > LAST_SEEN_REFRESH_MS) {
			void touchTrustedDevice(row.id);
		}
		return true;
	} catch {
		return false;
	}
}

async function touchTrustedDevice(deviceId: string): Promise<void> {
	try {
		await supabaseRestRequest<unknown>({
			pathWithQuery: `trusted_devices?id=eq.${encodeURIComponent(deviceId)}&revoked_at=is.null`,
			method: 'PATCH',
			useServiceRole: true,
			prefer: 'return=minimal',
			body: { last_seen_at: new Date().toISOString() },
		});
	} catch {
		// last_seen_at is informational; a failed refresh never changes trust.
	}
}

/** Marks every active trusted device of the user revoked. Returns how many were closed. */
export async function revokeTrustedDevices(userId: string): Promise<number> {
	const rows = await supabaseRestRequest<Array<{ id: string }>>({
		pathWithQuery:
			`trusted_devices?select=id&user_id=eq.${encodeURIComponent(sanitize(userId, 120))}` +
			'&revoked_at=is.null',
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: { revoked_at: new Date().toISOString() },
	});
	return rows.length;
}
