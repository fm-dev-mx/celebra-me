import {
	createTrustedDevice,
	revokeTrustedDevices,
	verifyTrustedDevice,
} from '@/lib/rsvp/security/trusted-device';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: jest.fn() }));

const restMock = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;
const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-1';
const UA = 'Mozilla/5.0 test';
const DAY_MS = 24 * 60 * 60 * 1000;

async function storeDevice() {
	restMock.mockResolvedValueOnce([{ id: DEVICE_ID }] as never);
	const created = await createTrustedDevice({
		userId: USER_ID,
		role: 'super_admin',
		userAgent: UA,
	});
	const body = restMock.mock.calls[restMock.mock.calls.length - 1][0].body as {
		secret_hash: string;
		user_agent_hash: string;
	};
	return { created, body };
}

function row(body: { secret_hash: string; user_agent_hash: string }, patch = {}) {
	const now = new Date().toISOString();
	return {
		id: DEVICE_ID,
		user_id: USER_ID,
		secret_hash: body.secret_hash,
		user_agent_hash: body.user_agent_hash,
		created_at: now,
		last_seen_at: now,
		revoked_at: null,
		...patch,
	};
}

describe('trusted devices', () => {
	beforeEach(() => {
		restMock.mockReset();
	});

	it('stores only hashes and returns an id.secret token', async () => {
		const { created, body } = await storeDevice();
		const secret = created.token.slice(DEVICE_ID.length + 1);

		expect(created.token.startsWith(`${DEVICE_ID}.`)).toBe(true);
		expect(created.maxAgeSeconds).toBe(30 * 24 * 60 * 60);
		expect(body.secret_hash).toMatch(/^[a-f0-9]{64}$/);
		expect(JSON.stringify(body)).not.toContain(secret);
	});

	it('refuses to trust a device for non super admins', async () => {
		await expect(
			createTrustedDevice({ userId: USER_ID, role: 'host_client', userAgent: UA }),
		).rejects.toThrow();
		expect(restMock).not.toHaveBeenCalled();
	});

	it('verifies a valid active device', async () => {
		const { created, body } = await storeDevice();
		restMock.mockResolvedValueOnce([row(body)] as never);

		await expect(
			verifyTrustedDevice({
				token: created.token,
				userId: USER_ID,
				userAgent: UA,
				role: 'super_admin',
			}),
		).resolves.toBe(true);
	});

	it('rejects revoked, expired, mismatched and malformed devices', async () => {
		const { created, body } = await storeDevice();
		const base = {
			token: created.token,
			userId: USER_ID,
			userAgent: UA,
			role: 'super_admin' as const,
		};

		restMock.mockResolvedValueOnce([
			row(body, { revoked_at: new Date().toISOString() }),
		] as never);
		await expect(verifyTrustedDevice(base)).resolves.toBe(false);

		restMock.mockResolvedValueOnce([row(body)] as never);
		await expect(
			verifyTrustedDevice({ ...base, nowMs: Date.now() + 31 * DAY_MS }),
		).resolves.toBe(false);

		restMock.mockResolvedValueOnce([row(body)] as never);
		await expect(verifyTrustedDevice({ ...base, userAgent: 'Other/1.0' })).resolves.toBe(false);

		restMock.mockResolvedValueOnce([row(body)] as never);
		await expect(
			verifyTrustedDevice({ ...base, token: `${DEVICE_ID}.wrong-secret` }),
		).resolves.toBe(false);

		restMock.mockResolvedValueOnce([] as never);
		await expect(verifyTrustedDevice(base)).resolves.toBe(false);

		await expect(verifyTrustedDevice({ ...base, token: 'not-a-token' })).resolves.toBe(false);
		await expect(verifyTrustedDevice({ ...base, role: 'host_client' })).resolves.toBe(false);
	});

	it('fails closed when storage errors', async () => {
		const { created } = await storeDevice();
		restMock.mockRejectedValueOnce(new Error('relation "trusted_devices" does not exist'));

		await expect(
			verifyTrustedDevice({
				token: created.token,
				userId: USER_ID,
				userAgent: UA,
				role: 'super_admin',
			}),
		).resolves.toBe(false);
	});

	it('revokes every active device of the user', async () => {
		restMock.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }] as never);

		await expect(revokeTrustedDevices(USER_ID)).resolves.toBe(2);
		const call = restMock.mock.calls[0][0];
		expect(call.method).toBe('PATCH');
		expect(call.pathWithQuery).toContain('user_id=eq.user-1');
		expect(call.pathWithQuery).toContain('revoked_at=is.null');
		expect(call.body).toEqual({ revoked_at: expect.any(String) });
	});
});
