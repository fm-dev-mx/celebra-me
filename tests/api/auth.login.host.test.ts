import type { APIContext } from 'astro';
import { POST as loginHost } from '@/pages/api/auth/login-host';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import * as authIdentifierService from '@/lib/rsvp/services/auth-identifier.service';
import * as rateLimitProvider from '@/lib/rsvp/security/rate-limit-provider';
import { ApiError } from '@/lib/rsvp/core/errors';
import { createMockRequest } from '../helpers/api-mocks';

jest.mock('@/lib/rsvp/auth/auth-api', () => ({
	signInWithPassword: jest.fn(),
	sendMagicLink: jest.fn(),
}));

jest.mock('@/lib/rsvp/security/rate-limit-provider', () => ({
	checkRateLimit: jest.fn(),
}));

jest.mock('@/lib/rsvp/services/auth-identifier.service', () => ({
	resolvePasswordAuthEmail: jest.fn(),
}));

describe('API: /api/auth/login-host', () => {
	const signInMock = authApi.signInWithPassword as jest.Mock;
	const sendMagicMock = authApi.sendMagicLink as jest.Mock;
	const resolvePasswordAuthEmailMock =
		authIdentifierService.resolvePasswordAuthEmail as jest.Mock;
	const checkRateLimitMock = rateLimitProvider.checkRateLimit as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		checkRateLimitMock.mockResolvedValue(true);
		resolvePasswordAuthEmailMock.mockImplementation(async (identifier: string) => identifier);
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
		expect(data.error.code).toBe('unauthorized');
	});

	it('Scenario: Successful Alias Password Login', async () => {
		resolvePasswordAuthEmailMock.mockResolvedValue('ximena_meza@clientes.celebra.invalid');
		signInMock.mockResolvedValue({
			access_token: 'secret-token-123',
			user: { id: 'user-001', email: 'ximena_meza@clientes.celebra.invalid' },
		});

		const response = await loginHost({
			request: createMockRequest({
				email: 'ximena_meza',
				password: 'ximenameza2026',
				method: 'password',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		expect(resolvePasswordAuthEmailMock).toHaveBeenCalledWith('ximena_meza');
		expect(signInMock).toHaveBeenCalledWith({
			email: 'ximena_meza@clientes.celebra.invalid',
			password: 'ximenameza2026',
		});
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

	it('Scenario: Missing Login Identifier Error', async () => {
		const response = await loginHost({
			request: createMockRequest({
				method: 'password',
				password: 'somePassword',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.message).toContain('inválido');
	});

	it('Scenario: Reject Cross-Origin Request', async () => {
		const response = await loginHost({
			request: createMockRequest(
				{
					email: 'host@test.com',
					password: 'correctPassword',
					method: 'password',
				},
				{ Origin: 'https://attacker.example' },
			),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error.code).toBe('forbidden');
	});

	it('Scenario: Rate Limited Login Attempt', async () => {
		checkRateLimitMock.mockResolvedValue(false);

		const response = await loginHost({
			request: createMockRequest({
				email: 'host@test.com',
				password: 'correctPassword',
				method: 'password',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(429);
		const data = await response.json();
		expect(data.error.code).toBe('rate_limited');
	});
});
