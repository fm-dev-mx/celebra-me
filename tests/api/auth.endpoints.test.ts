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
import {
	getHostSessionFromRequest,
	getSessionDebugSnapshotFromRequest,
} from '@/lib/rsvp/auth/auth';
import { findEventBySlugService } from '@/lib/rsvp/repositories/event.repository';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	signInWithPassword: jest.fn(),
	signUpWithPassword: jest.fn(),
	sendMagicLink: jest.fn(),
	findAuthUserByEmail: jest.fn(),
	findAuthUserByLoginIdentifier: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/auth-access.service', () => ({
	buildAuthSessionDto: jest.fn(),
	claimEventForUserByClaimCode: jest.fn(),
	ensureUserRole: jest.fn(),
	isSuperAdminEmail: jest.fn(() => false),
}));

jest.mock('@/lib/rsvp/services/user-admin.service', () => ({
	generateTemporaryPassword: jest.fn(() => 'TempPass!123'),
}));

jest.mock('@/lib/rsvp/auth/auth', () => ({
	getHostSessionFromRequest: jest.fn(),
	getSessionDebugSnapshotFromRequest: jest.fn(),
}));

jest.mock('@/lib/rsvp/repositories/event.repository', () => ({
	findEventBySlugService: jest.fn(),
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
	const getSessionDebugSnapshotFromRequestMock =
		getSessionDebugSnapshotFromRequest as jest.MockedFunction<
			typeof getSessionDebugSnapshotFromRequest
		>;
	const buildAuthSessionDtoMock = buildAuthSessionDto as jest.MockedFunction<
		typeof buildAuthSessionDto
	>;
	const findEventBySlugServiceMock = findEventBySlugService as jest.MockedFunction<
		typeof findEventBySlugService
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

	it('session endpoint returns debug payload when debug mode is enabled', async () => {
		getSessionDebugSnapshotFromRequestMock.mockResolvedValue({
			hasAccessToken: true,
			tokenSource: 'cookie',
			reason: 'session_role_resolved',
			context: {
				userId: 'u1',
				email: 'host@test.com',
				accessToken: 'token',
				role: 'host_client',
				isSuperAdmin: false,
			},
		});
		buildAuthSessionDtoMock.mockResolvedValue({
			userId: 'u1',
			email: 'host@test.com',
			role: 'host_client',
			isSuperAdmin: false,
			memberships: [
				{
					id: 'm1',
					eventId: 'evt-1',
					userId: 'u1',
					membershipRole: 'owner',
					createdAt: '2026-01-01',
					updatedAt: '2026-01-01',
				},
			],
		});
		findEventBySlugServiceMock.mockResolvedValue({
			id: 'evt-1',
			ownerUserId: 'u1',
			slug: 'ximena-meza-trasvina',
			eventType: 'xv',
			title: 'XV Ximena',
			status: 'published',
			publishedAt: null,
			createdAt: '2026-01-01',
			updatedAt: '2026-01-01',
		});

		const response = await authSession({
			request: createMockRequest(
				undefined,
				undefined,
				'http://localhost/api/auth/session?debug=1',
			),
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.debug.expectedEventSlug).toBe('ximena-meza-trasvina');
		expect(body.debug.hasOwnedEventForExpectedSlug).toBe(true);
		expect(body.debug.hasVisibleMembershipForExpectedSlug).toBe(true);
	});

	it('logout endpoint clears session cookie', async () => {
		const response = await logout({} as never);
		expect(response.status).toBe(200);
	});
});
