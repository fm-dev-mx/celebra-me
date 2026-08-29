import type { APIContext } from 'astro';
import { POST as refreshSession } from '@/pages/api/auth/refresh-session';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import * as rateLimitProvider from '@/lib/rsvp/security/rate-limit-provider';
import { AuthRequestError } from '@/lib/rsvp/core/errors';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	refreshAccessToken: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

describe('API: /api/auth/refresh-session', () => {
	const refreshMock = authApi.refreshAccessToken as jest.Mock;
	const checkRateLimitMock = rateLimitProvider.checkRateLimit as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		checkRateLimitMock.mockResolvedValue(true);
	});

	function request(cookie = 'sb-refresh-token=refresh-token') {
		return createMockRequest(
			undefined,
			{
				Origin: 'http://localhost:4321',
				Host: 'localhost:4321',
				Cookie: cookie,
			},
			'http://localhost:4321/api/auth/refresh-session',
		);
	}

	it('rotates session cookies on success', async () => {
		refreshMock.mockResolvedValue({
			access_token: 'rotated-access',
			refresh_token: 'rotated-refresh',
			user: { id: 'user-1' },
		});

		const response = await refreshSession({
			request: request(),
			url: new URL('http://localhost:4321/api/auth/refresh-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('sb-access-token=rotated-access');
		expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=rotated-refresh');
	});

	it('clears session cookies for a missing refresh token', async () => {
		const response = await refreshSession({
			request: request(''),
			url: new URL('http://localhost:4321/api/auth/refresh-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(401);
		expect(response.headers.get('set-cookie')).toContain('sb-access-token=');
		expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=');
		expect(refreshMock).not.toHaveBeenCalled();
	});

	it('clears session cookies for a confirmed rejected refresh credential', async () => {
		refreshMock.mockRejectedValue(
			new AuthRequestError({ kind: 'http', operation: 'refresh_session', status: 401 }),
		);

		const response = await refreshSession({
			request: request(),
			url: new URL('http://localhost:4321/api/auth/refresh-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(401);
		expect(response.headers.get('set-cookie')).toContain('sb-access-token=');
		expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=');
	});

	it.each([
		['timeout', new AuthRequestError({ kind: 'timeout', operation: 'refresh_session' })],
		['network', new AuthRequestError({ kind: 'network', operation: 'refresh_session' })],
		[
			'429 rate limit',
			new AuthRequestError({ kind: 'http', operation: 'refresh_session', status: 429 }),
		],
		[
			'503 upstream error',
			new AuthRequestError({ kind: 'http', operation: 'refresh_session', status: 503 }),
		],
		[
			'invalid response',
			new AuthRequestError({
				kind: 'invalid_response',
				operation: 'refresh_session',
				status: 200,
			}),
		],
	])('preserves cookies and returns 503 for %s', async (_name, error) => {
		refreshMock.mockRejectedValue(error);

		const response = await refreshSession({
			request: request(),
			url: new URL('http://localhost:4321/api/auth/refresh-session'),
		} as unknown as APIContext);

		expect(response.status).toBe(503);
		expect(response.headers.get('Retry-After')).toBe('5');
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(response.headers.get('set-cookie')).toBeNull();
	});
});
