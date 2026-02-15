import type { APIContext } from 'astro';
import { POST as syncSession } from '@/pages/api/auth/sync-session';
import * as auth from '@/lib/rsvp-v2/auth';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/auth', () => ({
	getHostSessionFromRequest: jest.fn(),
	getSupabaseUserByAccessToken: jest.fn(),
}));

describe('API: /api/auth/sync-session', () => {
	const getHostSessionMock = auth.getHostSessionFromRequest as jest.MockedFunction<
		typeof auth.getHostSessionFromRequest
	>;
	const getSupabaseUserMock = auth.getSupabaseUserByAccessToken as jest.MockedFunction<
		typeof auth.getSupabaseUserByAccessToken
	>;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	const makeToken = (payload: Record<string, unknown>): string => {
		const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
			'base64url',
		);
		const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
		return `${header}.${body}.signature`;
	};

	it('rejects when there is no base session', async () => {
		getHostSessionMock.mockResolvedValue(null);

		const response = await syncSession({
			request: createMockRequest(
				{ accessToken: 'elevated-token' },
				{ Origin: 'http://localhost' },
			),
			url: new URL('http://localhost/api/auth/sync-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(401);
	});

	it('rejects when elevated token belongs to a different user', async () => {
		getHostSessionMock.mockResolvedValue({
			userId: 'user-1',
			email: 'admin@celebra.me',
			accessToken: 'base-token',
		});
		getSupabaseUserMock.mockResolvedValue({
			id: 'user-2',
			amr: [{ method: 'mfa' }],
		});

		const response = await syncSession({
			request: createMockRequest(
				{ accessToken: 'elevated-token' },
				{ Origin: 'http://localhost' },
			),
			url: new URL('http://localhost/api/auth/sync-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(403);
	});

	it('rejects when elevated token is not MFA-elevated', async () => {
		getHostSessionMock.mockResolvedValue({
			userId: 'user-1',
			email: 'admin@celebra.me',
			accessToken: 'base-token',
		});
		getSupabaseUserMock.mockResolvedValue({
			id: 'user-1',
			amr: [{ method: 'password' }],
		});

		const response = await syncSession({
			request: createMockRequest(
				{ accessToken: 'elevated-token' },
				{ Origin: 'http://localhost' },
			),
			url: new URL('http://localhost/api/auth/sync-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(403);
	});

	it('stores session when elevated token is valid and MFA-proven', async () => {
		getHostSessionMock.mockResolvedValue({
			userId: 'user-1',
			email: 'admin@celebra.me',
			accessToken: 'base-token',
		});
		getSupabaseUserMock.mockResolvedValue({
			id: 'user-1',
			amr: [{ method: 'totp' }],
		});

		const response = await syncSession({
			request: createMockRequest(
				{
					accessToken: 'elevated-token',
					refreshToken: 'elevated-refresh',
				},
				{ Origin: 'http://localhost' },
			),
			url: new URL('http://localhost/api/auth/sync-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.ok).toBe(true);
	});

	it('stores session when elevated token uses otp amr method', async () => {
		getHostSessionMock.mockResolvedValue({
			userId: 'user-1',
			email: 'admin@celebra.me',
			accessToken: 'base-token',
		});
		getSupabaseUserMock.mockResolvedValue({
			id: 'user-1',
			amr: [{ method: 'otp' }],
		});

		const response = await syncSession({
			request: createMockRequest(
				{
					accessToken: 'elevated-token',
					refreshToken: 'elevated-refresh',
				},
				{ Origin: 'http://localhost' },
			),
			url: new URL('http://localhost/api/auth/sync-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
	});

	it('stores session when jwt has aal2 even without amr methods', async () => {
		const elevatedToken = makeToken({ sub: 'user-1', aal: 'aal2' });
		getHostSessionMock.mockResolvedValue({
			userId: 'user-1',
			email: 'admin@celebra.me',
			accessToken: 'base-token',
		});
		getSupabaseUserMock.mockResolvedValue({
			id: 'user-1',
			amr: [],
		});

		const response = await syncSession({
			request: createMockRequest(
				{
					accessToken: elevatedToken,
					refreshToken: 'elevated-refresh',
				},
				{ Origin: 'http://localhost' },
			),
			url: new URL('http://localhost/api/auth/sync-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
	});
});
