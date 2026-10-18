import type { AstroCookies } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { parseCookieHeader } from '@/lib/rsvp/core/utils';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import {
	MEMORIES_RECOVERY_CODE_PATTERN,
	sanitizeMemoriesDisplayName,
	type MemoriesGuestProfile,
	type MemoriesSpaceRecord,
} from '@/lib/memories/contract/catalog';
import { MEMORIES_DISPLAY_NAME_MIN_LENGTH } from '@/lib/memories/contract/limits';
import { buildMemoriesSessionCookieName } from '@/lib/memories/contract/private-request';
import { appendMemoriesAudit } from './audit';
import {
	insertSession,
	recoverSessionByRecoveryHash,
	resolveSessionByTokenHash,
	updateSessionDisplayName,
	updateSessionRecoveryHash,
	type SessionRow,
} from './catalog.repository';
import {
	createMemoriesGuestAlias,
	createMemoriesRecoveryCode,
	createMemoriesSessionToken,
	hashMemoriesSecret,
} from './secrets';

const UNIQUE_VIOLATION = '23505';
const MIN_COOKIE_MAX_AGE_SECONDS = 60;
/**
 * A `__Host-` cookie is only accepted with Secure and Path=/ and no Domain.
 * Browsers also ignore a deletion that omits Secure, so set and delete share
 * the same attributes.
 */
const SESSION_COOKIE_ATTRIBUTES = {
	httpOnly: true,
	secure: true,
	sameSite: 'lax',
	path: '/',
} as const;

export type MemoriesGuestSession = SessionRow;

export function toGuestProfile(session: SessionRow): MemoriesGuestProfile {
	return { displayName: session.display_name, expiresAt: session.expires_at };
}

function requireDisplayName(value: unknown): string {
	const displayName = sanitizeMemoriesDisplayName(value);
	if (displayName.length < MEMORIES_DISPLAY_NAME_MIN_LENGTH) {
		throw new ApiError(400, 'bad_request', 'Escriba su nombre o apodo.');
	}
	return displayName;
}

function requireRecoveryCode(value: unknown): string {
	const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
	if (!MEMORIES_RECOVERY_CODE_PATTERN.test(code)) {
		throw new ApiError(400, 'bad_request', 'El código de recuperación no es válido.');
	}
	return code;
}

export async function getGuestSessionFromRequest(
	space: MemoriesSpaceRecord,
	request: Request,
): Promise<SessionRow | null> {
	const token = parseCookieHeader(request.headers.get('cookie'))[
		buildMemoriesSessionCookieName(space.publicSlug)
	];
	if (!token) return null;
	return resolveSessionByTokenHash(space.eventId, hashMemoriesSecret(token));
}

export function setGuestSessionCookie(
	cookies: AstroCookies,
	space: MemoriesSpaceRecord,
	token: string,
	now = new Date(),
): void {
	const maxAge = Math.max(
		MIN_COOKIE_MAX_AGE_SECONDS,
		Math.floor((Date.parse(space.retentionEndsAt) - now.getTime()) / 1000),
	);
	cookies.set(buildMemoriesSessionCookieName(space.publicSlug), token, {
		...SESSION_COOKIE_ATTRIBUTES,
		maxAge,
	});
}

export function clearGuestSessionCookie(cookies: AstroCookies, space: MemoriesSpaceRecord): void {
	cookies.delete(buildMemoriesSessionCookieName(space.publicSlug), SESSION_COOKIE_ATTRIBUTES);
}

export async function createGuestSession(
	space: MemoriesSpaceRecord,
	displayNameValue: unknown,
): Promise<{ sessionToken: string; recoveryCode: string; profile: MemoriesGuestProfile }> {
	const displayName = requireDisplayName(displayNameValue);
	const sessionToken = createMemoriesSessionToken();
	const recoveryCode = createMemoriesRecoveryCode();
	let session: SessionRow | null = null;
	// The alias is random and unique per space; a rare collision is retried.
	for (let attempt = 0; attempt < 3 && !session; attempt += 1) {
		try {
			session = await insertSession({
				eventId: space.eventId,
				tokenHash: hashMemoriesSecret(sessionToken),
				recoveryCodeHash: hashMemoriesSecret(recoveryCode),
				displayName,
				guestAlias: createMemoriesGuestAlias(),
				expiresAt: space.retentionEndsAt,
			});
		} catch (error) {
			if (
				!(error instanceof SupabaseHttpError) ||
				error.code !== UNIQUE_VIOLATION ||
				attempt === 2
			)
				throw error;
		}
	}
	if (!session) {
		throw new ApiError(
			503,
			'service_unavailable',
			'No se pudo iniciar la sesión de recuerdos.',
		);
	}
	return { sessionToken, recoveryCode, profile: toGuestProfile(session) };
}

export async function recoverGuestSession(
	space: MemoriesSpaceRecord,
	value: unknown,
): Promise<{ sessionToken: string; profile: MemoriesGuestProfile }> {
	const recoveryCode = requireRecoveryCode(value);
	const sessionToken = createMemoriesSessionToken();
	const session = await recoverSessionByRecoveryHash(
		space.eventId,
		hashMemoriesSecret(recoveryCode),
		hashMemoriesSecret(sessionToken),
	);
	if (!session) {
		throw new ApiError(401, 'unauthorized', 'El código de recuperación expiró o no es válido.');
	}
	return { sessionToken, profile: toGuestProfile(session) };
}

/**
 * Issues a new recovery code for the guest's own session. Only the hash is
 * stored, so the previous code can never be shown again and stops working.
 */
export async function rotateGuestRecoveryCode(
	space: MemoriesSpaceRecord,
	session: SessionRow,
): Promise<string> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const recoveryCode = createMemoriesRecoveryCode();
		let updated: SessionRow | null;
		try {
			updated = await updateSessionRecoveryHash(session.id, hashMemoriesSecret(recoveryCode));
		} catch (error) {
			// A rare collision with another session's code is retried with a fresh code.
			if (
				error instanceof SupabaseHttpError &&
				error.code === UNIQUE_VIOLATION &&
				attempt < 2
			)
				continue;
			throw error;
		}
		if (!updated) throw new ApiError(404, 'not_found', 'La sesión ya no está disponible.');
		await appendMemoriesAudit({
			eventId: space.eventId,
			actorType: 'guest',
			action: 'recovery_code_rotated',
		});
		return recoveryCode;
	}
	throw new ApiError(503, 'service_unavailable', 'No se pudo crear un código nuevo.');
}

export async function updateGuestProfile(
	space: MemoriesSpaceRecord,
	session: SessionRow,
	displayNameValue: unknown,
): Promise<MemoriesGuestProfile> {
	const displayName = requireDisplayName(displayNameValue);
	const updated = await updateSessionDisplayName(session.id, displayName);
	if (!updated) throw new ApiError(404, 'not_found', 'La sesión ya no está disponible.');
	await appendMemoriesAudit({
		eventId: space.eventId,
		actorType: 'guest',
		action: 'profile_updated',
	});
	return toGuestProfile(updated);
}
