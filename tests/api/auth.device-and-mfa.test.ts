import { POST as logoutAll } from '@/pages/api/auth/logout-all';
import { POST as mfaEnroll } from '@/pages/api/auth/mfa/enroll';
import { POST as mfaVerify } from '@/pages/api/auth/mfa/verify';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import * as auth from '@/lib/rsvp/auth/auth';
import * as trustedDevice from '@/lib/rsvp/security/trusted-device';
import { AuthRequestError } from '@/lib/rsvp/core/errors';
import { resetRateLimitProviderForTests } from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	revokeAuthSessions: jest.fn(),
	listMfaFactors: jest.fn(),
	unenrollMfaFactor: jest.fn(),
	enrollMfaTotp: jest.fn(),
	challengeMfaFactor: jest.fn(),
	verifyMfaFactor: jest.fn(),
}));
jest.mock('@/lib/rsvp/auth/auth', () => ({
	requireSessionContext: jest.fn(),
	getSupabaseUserByAccessToken: jest.fn(),
}));
jest.mock('@/lib/rsvp/auth/auth-mfa-evidence', () => ({ hasMfaEvidence: jest.fn(() => true) }));
jest.mock('@/lib/rsvp/security/trusted-device', () => ({
	revokeTrustedDevices: jest.fn(),
	createTrustedDevice: jest.fn(),
}));

const ORIGIN = { Origin: 'http://localhost:4321', Host: 'localhost:4321' };
const FACTOR = '550e8400-e29b-41d4-a716-446655440000';
const CHALLENGE = '550e8400-e29b-41d4-a716-446655440001';
const sessionMock = auth.requireSessionContext as jest.Mock;
const userMock = auth.getSupabaseUserByAccessToken as jest.Mock;

function call(handler: typeof logoutAll, path: string, body: Record<string, unknown> = {}) {
	return handler({
		request: createMockRequest(body, ORIGIN, `http://localhost:4321${path}`),
		url: new URL(`http://localhost:4321${path}`),
	} as never);
}

describe('logout-all and server-side MFA', () => {
	beforeEach(() => {
		resetRateLimitProviderForTests();
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		sessionMock.mockResolvedValue({
			userId: 'admin-1',
			accessToken: 'access',
			role: 'super_admin',
			isSuperAdmin: true,
		});
		(trustedDevice.createTrustedDevice as jest.Mock).mockResolvedValue({
			token: 'dev.secret',
			maxAgeSeconds: 100,
		});
	});

	it('logout-all revokes devices and sessions and clears cookies', async () => {
		const res = await call(logoutAll, '/api/auth/logout-all');

		expect(res.status).toBe(200);
		expect(trustedDevice.revokeTrustedDevices).toHaveBeenCalledWith('admin-1');
		expect(authApi.revokeAuthSessions).toHaveBeenCalledWith({
			accessToken: 'access',
			scope: 'global',
		});
		expect(res.headers.getSetCookie().length).toBeGreaterThanOrEqual(6);
	});

	it('logout-all fails with 503 when device revocation fails', async () => {
		(trustedDevice.revokeTrustedDevices as jest.Mock).mockRejectedValueOnce(new Error('db'));

		const res = await call(logoutAll, '/api/auth/logout-all');

		expect(res.status).toBe(503);
		expect(authApi.revokeAuthSessions).not.toHaveBeenCalled();
	});

	it('mfa enroll rejects non super admins', async () => {
		sessionMock.mockResolvedValue({ userId: 'u', accessToken: 'a', isSuperAdmin: false });

		const res = await call(mfaEnroll, '/api/auth/mfa/enroll');

		expect(res.status).toBe(403);
		expect(authApi.enrollMfaTotp).not.toHaveBeenCalled();
	});

	it('mfa verify validates ids and code format', async () => {
		const badId = await call(mfaVerify, '/api/auth/mfa/verify', {
			factorId: 'x',
			code: '123456',
		});
		const badCode = await call(mfaVerify, '/api/auth/mfa/verify', {
			factorId: FACTOR,
			code: '12',
		});

		expect(badId.status).toBe(400);
		expect(badCode.status).toBe(400);
		expect(authApi.verifyMfaFactor).not.toHaveBeenCalled();
	});

	it('mfa verify maps a rejected code to 400', async () => {
		(authApi.verifyMfaFactor as jest.Mock).mockRejectedValueOnce(
			new AuthRequestError({ kind: 'http', operation: 'mfa_verify', status: 422 }),
		);

		const res = await call(mfaVerify, '/api/auth/mfa/verify', {
			factorId: FACTOR,
			challengeId: CHALLENGE,
			code: '123456',
		});

		expect(res.status).toBe(400);
		expect(res.headers.getSetCookie()).toHaveLength(0);
	});

	it('mfa verify sets httpOnly cookies and never returns tokens', async () => {
		(authApi.verifyMfaFactor as jest.Mock).mockResolvedValueOnce({
			accessToken: 'elevated-access',
			refreshToken: 'elevated-refresh',
		});
		userMock.mockResolvedValueOnce({ id: 'admin-1', app_metadata: { role: 'super_admin' } });

		const res = await call(mfaVerify, '/api/auth/mfa/verify', {
			factorId: FACTOR,
			challengeId: CHALLENGE,
			code: '123456',
		});
		const text = await res.text();

		expect(res.status).toBe(200);
		expect(text).not.toContain('elevated-access');
		expect(text).not.toContain('elevated-refresh');
		const cookies = res.headers.getSetCookie();
		expect(cookies.some((c) => c.includes('elevated-access') && /HttpOnly/i.test(c))).toBe(
			true,
		);
	});

	it('mfa verify refuses a session that belongs to another user', async () => {
		(authApi.verifyMfaFactor as jest.Mock).mockResolvedValueOnce({
			accessToken: 'elevated-access',
			refreshToken: 'r',
		});
		userMock.mockResolvedValueOnce({ id: 'someone-else', app_metadata: {} });

		const res = await call(mfaVerify, '/api/auth/mfa/verify', {
			factorId: FACTOR,
			challengeId: CHALLENGE,
			code: '123456',
		});

		expect(res.status).toBe(403);
	});
});
