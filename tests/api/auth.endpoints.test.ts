import { POST as loginHost } from '@/pages/api/auth/login-host';
import { POST as registerHost } from '@/pages/api/auth/register-host';
import { GET as authSession } from '@/pages/api/auth/session';
import { POST as logout } from '@/pages/api/auth/logout';
import * as authApi from '@/lib/rsvp-v2/authApi';
import { buildAuthSessionDto, claimEventForUser, ensureUserRole } from '@/lib/rsvp-v2/service';
import { getHostSessionFromRequest } from '@/lib/rsvp-v2/auth';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/authApi', () => ({
	signInWithPassword: jest.fn(),
	signUpWithPassword: jest.fn(),
	sendMagicLink: jest.fn(),
	findAuthUserByEmail: jest.fn(),
}));

jest.mock('@/lib/rsvp-v2/service', () => ({
	buildAuthSessionDto: jest.fn(),
	claimEventForUser: jest.fn(),
	ensureUserRole: jest.fn(),
	generateTemporaryPassword: jest.fn(() => 'TempPass!123'),
}));

jest.mock('@/lib/rsvp-v2/auth', () => ({
	getHostSessionFromRequest: jest.fn(),
}));

describe('auth endpoints', () => {
	const signInWithPasswordMock = authApi.signInWithPassword as jest.MockedFunction<
		typeof authApi.signInWithPassword
	>;
	const signUpWithPasswordMock = authApi.signUpWithPassword as jest.MockedFunction<
		typeof authApi.signUpWithPassword
	>;
	const sendMagicLinkMock = authApi.sendMagicLink as jest.MockedFunction<
		typeof authApi.sendMagicLink
	>;
	const claimEventForUserMock = claimEventForUser as jest.MockedFunction<
		typeof claimEventForUser
	>;
	const ensureUserRoleMock = ensureUserRole as jest.MockedFunction<typeof ensureUserRole>;
	const getHostSessionFromRequestMock = getHostSessionFromRequest as jest.MockedFunction<
		typeof getHostSessionFromRequest
	>;
	const buildAuthSessionDtoMock = buildAuthSessionDto as jest.MockedFunction<
		typeof buildAuthSessionDto
	>;

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('login-host supports password and magic link', async () => {
		signInWithPasswordMock.mockResolvedValue({
			access_token: 'token-123',
			refresh_token: 'refresh',
			user: { id: 'u1', email: 'host@test.com' },
		});
		const passwordResp = await loginHost({
			request: createMockRequest({
				method: 'password',
				email: 'host@test.com',
				password: 'Pass123!',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as never);
		expect(passwordResp.status).toBe(200);
		expect(passwordResp.headers.get('set-cookie')).toContain('sb-access-token=');

		sendMagicLinkMock.mockResolvedValue({});
		const magicResp = await loginHost({
			request: createMockRequest({
				method: 'magic_link',
				email: 'host@test.com',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as never);
		expect(magicResp.status).toBe(200);
	});

	it('register-host claims event and can set session cookie', async () => {
		signUpWithPasswordMock.mockResolvedValue({
			access_token: 'token-xyz',
			user: { id: 'u-register', email: 'client@test.com' },
		});
		claimEventForUserMock.mockResolvedValue({
			eventId: 'evt-1',
			membershipRole: 'owner',
		});
		ensureUserRoleMock.mockResolvedValue('host_client');

		const response = await registerHost({
			request: createMockRequest({
				method: 'password',
				email: 'client@test.com',
				password: 'Pass123!',
				eventSlug: 'demo',
				claimCode: 'CLAIM123',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('sb-access-token=');
	});

	it('session endpoint returns unauthorized when session is missing', async () => {
		getHostSessionFromRequestMock.mockResolvedValue(null);
		const response = await authSession({
			request: createMockRequest(),
		} as never);
		expect(response.status).toBe(401);
	});

	it('session endpoint returns auth dto when session exists', async () => {
		getHostSessionFromRequestMock.mockResolvedValue({
			userId: 'u1',
			email: 'host@test.com',
			accessToken: 'token',
		});
		buildAuthSessionDtoMock.mockResolvedValue({
			userId: 'u1',
			email: 'host@test.com',
			role: 'host_client',
			isSuperAdmin: false,
			memberships: [],
		});
		const response = await authSession({
			request: createMockRequest(),
		} as never);
		expect(response.status).toBe(200);
	});

	it('logout endpoint clears session cookie', async () => {
		const response = await logout({} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
	});
});
