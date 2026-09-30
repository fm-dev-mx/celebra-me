jest.mock('@/lib/memories/server/catalog.repository', () => ({
	insertSession: jest.fn(),
	recoverSessionByRecoveryHash: jest.fn(),
	resolveSessionByTokenHash: jest.fn(),
	updateSessionDisplayName: jest.fn(),
}));

jest.mock('@/lib/memories/server/audit', () => ({
	appendMemoriesAudit: jest.fn().mockResolvedValue(undefined),
}));

import { createHash } from 'node:crypto';
import type { AstroCookies } from 'astro';
import {
	MEMORIES_GUEST_ALIAS_PATTERN,
	MEMORIES_RECOVERY_CODE_PATTERN,
} from '@/lib/memories/contract/catalog';
import { SupabaseHttpError } from '@/lib/rsvp/repositories/supabase';
import {
	insertSession,
	recoverSessionByRecoveryHash,
	resolveSessionByTokenHash,
	updateSessionDisplayName,
} from '@/lib/memories/server/catalog.repository';
import { appendMemoriesAudit } from '@/lib/memories/server/audit';
import {
	createGuestSession,
	getGuestSessionFromRequest,
	recoverGuestSession,
	setGuestSessionCookie,
	toGuestProfile,
	updateGuestProfile,
} from '@/lib/memories/server/guest-session.service';
import {
	EVENT_ID,
	NOW,
	PUBLIC_SLUG,
	RECOVERY_CODE,
	SESSION_ID,
	buildSessionRow,
	buildSpace,
} from './fixtures';

const mockInsert = insertSession as jest.MockedFunction<typeof insertSession>;
const mockRecover = recoverSessionByRecoveryHash as jest.MockedFunction<
	typeof recoverSessionByRecoveryHash
>;
const mockResolve = resolveSessionByTokenHash as jest.MockedFunction<
	typeof resolveSessionByTokenHash
>;
const mockUpdateName = updateSessionDisplayName as jest.MockedFunction<
	typeof updateSessionDisplayName
>;
const mockAudit = appendMemoriesAudit as jest.MockedFunction<typeof appendMemoriesAudit>;

const COOKIE_NAME = `__Host-memories_${PUBLIC_SLUG}`;

function sha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

function uniqueViolation(): SupabaseHttpError {
	return new SupabaseHttpError(
		409,
		'{"code":"23505","message":"duplicate key value violates unique constraint"}',
		'23505',
	);
}

function createCookies() {
	return { set: jest.fn(), delete: jest.fn(), get: jest.fn() };
}

describe('createGuestSession', () => {
	beforeEach(() => jest.clearAllMocks());

	it('stores only hashes of the token and recovery code, bound to the space retention', async () => {
		mockInsert.mockResolvedValue(buildSessionRow());
		const space = buildSpace();

		const result = await createGuestSession(space, '  Tía   Ana ');

		expect(mockInsert).toHaveBeenCalledTimes(1);
		const input = mockInsert.mock.calls[0][0];
		expect(input.eventId).toBe(EVENT_ID);
		expect(input.displayName).toBe('Tía Ana');
		expect(input.expiresAt).toBe(space.retentionEndsAt);
		expect(input.guestAlias).toMatch(MEMORIES_GUEST_ALIAS_PATTERN);
		expect(input.tokenHash).toBe(sha256(result.sessionToken));
		expect(input.recoveryCodeHash).toBe(sha256(result.recoveryCode));
		const serialized = JSON.stringify(input);
		expect(serialized).not.toContain(result.sessionToken);
		expect(serialized).not.toContain(result.recoveryCode);
		expect(result.recoveryCode).toMatch(MEMORIES_RECOVERY_CODE_PATTERN);
		expect(result.sessionToken.length).toBeGreaterThanOrEqual(40);
		expect(result.profile).toEqual({
			displayName: 'Tía Ana',
			expiresAt: '2026-12-30T07:00:00.000Z',
		});
	});

	it('rejects an empty display name before touching the repository', async () => {
		await expect(createGuestSession(buildSpace(), '   ')).rejects.toMatchObject({
			status: 400,
			code: 'bad_request',
		});
		await expect(createGuestSession(buildSpace(), 42)).rejects.toMatchObject({ status: 400 });
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it('retries an alias collision up to three times with the same secrets', async () => {
		mockInsert
			.mockRejectedValueOnce(uniqueViolation())
			.mockRejectedValueOnce(uniqueViolation())
			.mockResolvedValueOnce(buildSessionRow());

		const result = await createGuestSession(buildSpace(), 'Tía Ana');

		expect(mockInsert).toHaveBeenCalledTimes(3);
		const hashes = mockInsert.mock.calls.map(([input]) => input.tokenHash);
		expect(new Set(hashes).size).toBe(1);
		expect(hashes[0]).toBe(sha256(result.sessionToken));
		const aliases = mockInsert.mock.calls.map(([input]) => input.guestAlias);
		expect(new Set(aliases).size).toBe(3);
	});

	it('gives up after the third collision', async () => {
		mockInsert.mockRejectedValue(uniqueViolation());
		await expect(createGuestSession(buildSpace(), 'Tía Ana')).rejects.toBeInstanceOf(
			SupabaseHttpError,
		);
		expect(mockInsert).toHaveBeenCalledTimes(3);
	});

	it('does not retry other persistence errors', async () => {
		mockInsert.mockRejectedValue(new SupabaseHttpError(500, 'boom', null));
		await expect(createGuestSession(buildSpace(), 'Tía Ana')).rejects.toBeInstanceOf(
			SupabaseHttpError,
		);
		expect(mockInsert).toHaveBeenCalledTimes(1);
	});

	it('fails closed when the insert returns no row', async () => {
		mockInsert.mockResolvedValue(null);
		await expect(createGuestSession(buildSpace(), 'Tía Ana')).rejects.toMatchObject({
			status: 503,
			code: 'service_unavailable',
		});
	});
});

describe('recoverGuestSession', () => {
	beforeEach(() => jest.clearAllMocks());

	it.each(['abcd', 'ABCD-EFGH-JKL0', 'ABCDEFGHJKLM', 42, null])(
		'rejects the malformed code %p with a 400 without a lookup',
		async (value) => {
			await expect(recoverGuestSession(buildSpace(), value)).rejects.toMatchObject({
				status: 400,
				code: 'bad_request',
			});
			expect(mockRecover).not.toHaveBeenCalled();
		},
	);

	it('normalizes the code, rotates the token and returns the profile', async () => {
		mockRecover.mockResolvedValue(buildSessionRow());
		const result = await recoverGuestSession(buildSpace(), ` ${RECOVERY_CODE.toLowerCase()} `);
		expect(mockRecover).toHaveBeenCalledWith(
			EVENT_ID,
			sha256(RECOVERY_CODE),
			sha256(result.sessionToken),
		);
		expect(result.profile).toEqual({
			displayName: 'Tía Ana',
			expiresAt: '2026-12-30T07:00:00.000Z',
		});
	});

	it('returns 401 when no session matches the code', async () => {
		mockRecover.mockResolvedValue(null);
		await expect(recoverGuestSession(buildSpace(), RECOVERY_CODE)).rejects.toMatchObject({
			status: 401,
			code: 'unauthorized',
		});
	});
});

describe('setGuestSessionCookie', () => {
	it('sets a host-only, secure cookie that expires with retention', () => {
		const cookies = createCookies();
		const space = buildSpace();
		const expectedMaxAge = Math.floor(
			(Date.parse(space.retentionEndsAt) - NOW.getTime()) / 1000,
		);

		setGuestSessionCookie(cookies as unknown as AstroCookies, space, 'session-token', NOW);

		expect(cookies.set).toHaveBeenCalledWith(COOKIE_NAME, 'session-token', {
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			path: '/',
			maxAge: expectedMaxAge,
		});
		// 2026-10-24T12:00Z -> 2026-12-30T07:00Z: 66 days and 19 hours.
		expect(expectedMaxAge).toBe(66 * 86_400 + 19 * 3_600);
	});

	it('keeps a short positive max-age when retention is about to end', () => {
		const cookies = createCookies();
		setGuestSessionCookie(
			cookies as unknown as AstroCookies,
			buildSpace(),
			'session-token',
			new Date('2026-12-30T06:59:59.000Z'),
		);
		expect(cookies.set.mock.calls[0][2]).toMatchObject({ maxAge: 60 });
	});
});

describe('getGuestSessionFromRequest', () => {
	beforeEach(() => jest.clearAllMocks());

	it('reads the per-space cookie and resolves the session by token hash', async () => {
		const row = buildSessionRow();
		mockResolve.mockResolvedValue(row);
		const request = new Request(`https://celebra-me.com/api/memories/${PUBLIC_SLUG}/session`, {
			headers: { cookie: `__Host-memories_otro-evento=foreign; ${COOKIE_NAME}=guest-token` },
		});

		await expect(getGuestSessionFromRequest(buildSpace(), request)).resolves.toBe(row);
		expect(mockResolve).toHaveBeenCalledWith(EVENT_ID, sha256('guest-token'));
	});

	it('ignores cookies that belong to other spaces', async () => {
		const request = new Request(`https://celebra-me.com/api/memories/${PUBLIC_SLUG}/session`, {
			headers: { cookie: '__Host-memories_otro-evento=foreign; sb-access-token=abc' },
		});
		await expect(getGuestSessionFromRequest(buildSpace(), request)).resolves.toBeNull();
		expect(mockResolve).not.toHaveBeenCalled();
	});

	it('returns null without a cookie header', async () => {
		const request = new Request(`https://celebra-me.com/api/memories/${PUBLIC_SLUG}/session`);
		await expect(getGuestSessionFromRequest(buildSpace(), request)).resolves.toBeNull();
		expect(mockResolve).not.toHaveBeenCalled();
	});
});

describe('updateGuestProfile and toGuestProfile', () => {
	beforeEach(() => jest.clearAllMocks());

	it('projects only the display name and expiry', () => {
		expect(toGuestProfile(buildSessionRow())).toStrictEqual({
			displayName: 'Tía Ana',
			expiresAt: '2026-12-30T07:00:00.000Z',
		});
	});

	it('updates the name and audits without identifying the guest', async () => {
		mockUpdateName.mockResolvedValue(buildSessionRow({ display_name: 'Ana' }));
		const profile = await updateGuestProfile(buildSpace(), buildSessionRow(), ' Ana ');
		expect(mockUpdateName).toHaveBeenCalledWith(SESSION_ID, 'Ana');
		expect(profile.displayName).toBe('Ana');
		expect(mockAudit).toHaveBeenCalledWith({
			eventId: EVENT_ID,
			actorType: 'guest',
			action: 'profile_updated',
		});
	});

	it('returns 404 when the session was revoked meanwhile', async () => {
		mockUpdateName.mockResolvedValue(null);
		await expect(
			updateGuestProfile(buildSpace(), buildSessionRow(), 'Ana'),
		).rejects.toMatchObject({
			status: 404,
			code: 'not_found',
		});
	});
});
