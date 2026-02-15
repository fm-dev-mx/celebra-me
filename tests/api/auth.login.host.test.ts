import type { APIContext } from 'astro';
import { POST as loginHost } from '@/pages/api/auth/login-host';
import * as authApi from '@/lib/rsvp-v2/authApi';
import { ApiError } from '@/lib/rsvp-v2/errors';
import { createMockRequest } from './rsvp.helpers';

jest.mock('@/lib/rsvp-v2/authApi', () => ({
	signInWithPassword: jest.fn(),
	sendMagicLink: jest.fn(),
}));

describe('API: /api/auth/login-host', () => {
	const signInMock = authApi.signInWithPassword as jest.Mock;
	const sendMagicMock = authApi.sendMagicLink as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('Scenario: Successful Password Login', async () => {
		signInMock.mockResolvedValue({
			access_token: 'secret-token-123',
			user: { id: 'user-001', email: 'host@test.com' },
		});

		const response = await loginHost({
			request: createMockRequest({
				email: 'host@test.com',
				password: 'correctPassword',
				method: 'password',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.ok).toBe(true);
		expect(data.next).toBe('/dashboard/invitados');
		expect(response.headers.get('set-cookie')).toContain('sb-access-token=secret-token-123');
	});

	it('Scenario: Failed Password Login (Invalid Credentials)', async () => {
		signInMock.mockRejectedValue(new ApiError(401, 'unauthorized', 'Credenciales invalidas'));

		const response = await loginHost({
			request: createMockRequest({
				email: 'host@test.com',
				password: 'wrongPassword',
				method: 'password',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.code).toBe('unauthorized');
	});

	it('Scenario: Successful Magic Link Request', async () => {
		sendMagicMock.mockResolvedValue({});

		const response = await loginHost({
			request: createMockRequest({
				email: 'magic@test.com',
				method: 'magic_link',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.ok).toBe(true);
		expect(data.message).toContain('correo');
		expect(sendMagicMock).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'magic@test.com',
			}),
		);
	});

	it('Scenario: Missing Email Error', async () => {
		const response = await loginHost({
			request: createMockRequest({
				method: 'password',
				password: 'somePassword',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.message).toContain('Email');
	});
});
