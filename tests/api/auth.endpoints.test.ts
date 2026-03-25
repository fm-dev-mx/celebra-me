import { POST as loginHost } from '@/pages/api/auth/login-host';
import { POST as registerHost } from '@/pages/api/auth/register-host';
import { GET as authSession } from '@/pages/api/auth/session';
import { POST as logout } from '@/pages/api/auth/logout';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import { buildAuthSessionDto } from '@/lib/rsvp/services/auth-access.service';
import {
	claimEventForUserByClaimCode,
	ensureUserRole,
} from '@/lib/rsvp/services/auth-access.service';
import { getHostSessionFromRequest } from '@/lib/rsvp/auth/auth';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	signInWithPassword: jest.fn(),
	signUpWithPassword: jest.fn(),
	sendMagicLink: jest.fn(),
	findAuthUserByEmail: jest.fn(),
}));

jest.mock('@/lib/rsvp/service', () => ({
	buildAuthSessionDto: jest.fn(),
	claimEventForUserByClaimCode: jest.fn(),
	ensureUserRole: jest.fn(),
	generateTemporaryPassword: jest.fn(() => 'TempPass!123'),
	isSuperAdminEmail: jest.fn(() => false),
}));

jest.mock('@/lib/rsvp/auth/auth', () => ({
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
	const claimEventForUserByClaimCodeMock = claimEventForUserByClaimCode as jest.MockedFunction<
		typeof claimEventForUserByClaimCode
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
		claimEventForUserByClaimCodeMock.mockResolvedValue({
			eventId: 'evt-1',
			membershipRole: 'owner',
		});
		ensureUserRoleMock.mockResolvedValue('host_client');

		const response = await registerHost({
			request: createMockRequest({
				method: 'password',
				email: 'client@test.com',
				password: 'Pass123!',
				claimCode: 'CLAIM123',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as never);
		expect(response.status).toBe(200);
	});

	it('register-host keeps backward compatibility when eventSlug is sent', async () => {
		signUpWithPasswordMock.mockResolvedValue({
			access_token: 'token-legacy',
			user: { id: 'u-legacy', email: 'legacy@test.com' },
		});
		claimEventForUserByClaimCodeMock.mockResolvedValue({
			eventId: 'evt-legacy',
			membershipRole: 'owner',
		});
		ensureUserRoleMock.mockResolvedValue('host_client');

		const response = await registerHost({
			request: createMockRequest({
				method: 'password',
				email: 'legacy@test.com',
				password: 'Pass123!',
				eventSlug: 'demo-event',
				claimCode: 'CLAIM123',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as never);

		expect(response.status).toBe(200);
	});

	it('register-host returns bad_request when claimCode is missing', async () => {
		const response = await registerHost({
			request: createMockRequest({
				method: 'password',
				email: 'missing@test.com',
				password: 'Pass123!',
			}),
			url: new URL('http://localhost/api/auth/register-host'),
		} as never);

		expect(response.status).toBe(400);
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
	});
});
