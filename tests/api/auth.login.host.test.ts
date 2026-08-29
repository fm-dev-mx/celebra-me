import type { APIContext } from 'astro';
import { POST as loginHost } from '@/pages/api/auth/login-host';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import * as authIdentifierService from '@/lib/rsvp/services/auth-identifier.service';
import * as rateLimitProvider from '@/lib/rsvp/security/rate-limit-provider';
import { createMockRequest } from '../helpers/api-mocks';
import { AuthRequestError } from '@/lib/rsvp/core/errors';

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

async function resolveAfterMicrotasks<T>(value: T, turns: number): Promise<T> {
	let pending = Promise.resolve();
	for (let turn = 0; turn < turns; turn += 1) {
		pending = pending.then(() => undefined);
	}
	await pending;
	return value;
}

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
		signInMock.mockRejectedValue(
			new AuthRequestError({ kind: 'http', operation: 'password_sign_in', status: 401 }),
		);

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

	it('isolates cookies for 20 concurrent users sharing one IP', async () => {
		signInMock.mockImplementation(async ({ email }: { email: string }) => {
			const index = Number(email.match(/user-(\d+)/)?.[1]);
			return resolveAfterMicrotasks(
				{
					access_token: `concurrent-access-${index}`,
					refresh_token: `concurrent-refresh-${index}`,
					user: { id: `concurrent-user-${index}`, email },
				},
				20 - index,
			);
		});

		const pending = Array.from({ length: 20 }, (_, index) =>
			loginHost({
				request: createMockRequest(
					{
						email: `user-${index}@test.invalid`,
						password: `ConcurrentPassword-${index}!`,
						method: 'password',
					},
					{ 'X-Forwarded-For': '203.0.113.10' },
				),
				url: new URL('http://localhost/api/auth/login-host'),
			} as unknown as APIContext),
		);
		const settled = await Promise.allSettled(pending);

		expect(settled.every((result) => result.status === 'fulfilled')).toBe(true);
		for (const [index, result] of settled.entries()) {
			if (result.status !== 'fulfilled') continue;
			expect(result.value.status).toBe(200);
			const setCookie = result.value.headers.get('set-cookie') || '';
			expect(setCookie).toContain(`sb-access-token=concurrent-access-${index}`);
			expect(setCookie).toContain(`sb-refresh-token=concurrent-refresh-${index}`);
			for (let other = 0; other < 20; other += 1) {
				if (other === index) continue;
				expect(setCookie).not.toContain(`concurrent-access-${other};`);
				expect(setCookie).not.toContain(`concurrent-refresh-${other};`);
			}
		}
		expect(signInMock).toHaveBeenCalledTimes(20);
		expect(checkRateLimitMock).toHaveBeenCalledTimes(20);
		const rateLimitCallsByEntity = new Map(
			checkRateLimitMock.mock.calls.map(([call]) => [call.entityId, call] as const),
		);
		for (let index = 0; index < 20; index += 1) {
			expect(rateLimitCallsByEntity.get(`login:user-${index}@test.invalid`)).toMatchObject({
				namespace: 'auth',
				entityId: `login:user-${index}@test.invalid`,
				ip: '203.0.113.10',
			});
		}
	});

	it('keeps mixed concurrent login failures isolated from successful users', async () => {
		signInMock.mockImplementation(async ({ email }: { email: string }) => {
			const index = Number(email.match(/mixed-(\d+)/)?.[1]);
			await resolveAfterMicrotasks(undefined, 20 - index);
			if (index < 10) {
				return {
					access_token: `mixed-login-access-${index}`,
					refresh_token: `mixed-login-refresh-${index}`,
					user: { id: `mixed-login-user-${index}`, email },
				};
			}
			if (index < 15) {
				throw new AuthRequestError({
					kind: 'http',
					operation: 'password_sign_in',
					status: 401,
				});
			}
			throw new AuthRequestError({
				kind: 'http',
				operation: 'password_sign_in',
				status: 503,
			});
		});

		const settled = await Promise.allSettled(
			Array.from({ length: 20 }, (_, index) =>
				loginHost({
					request: createMockRequest(
						{
							email: `mixed-${index}@test.invalid`,
							password: `MixedLoginPassword-${index}!`,
							method: 'password',
						},
						{ 'X-Forwarded-For': '203.0.113.11' },
					),
					url: new URL('http://localhost/api/auth/login-host'),
				} as unknown as APIContext),
			),
		);

		expect(settled.every((result) => result.status === 'fulfilled')).toBe(true);
		for (const [index, result] of settled.entries()) {
			if (result.status !== 'fulfilled') continue;
			const setCookie = result.value.headers.get('set-cookie');
			if (index < 10) {
				expect(result.value.status).toBe(200);
				expect(setCookie).toContain(`sb-access-token=mixed-login-access-${index}`);
				continue;
			}
			expect(setCookie).toBeNull();
			if (index < 15) {
				expect(result.value.status).toBe(401);
				expect((await result.value.json()).error.code).toBe('unauthorized');
			} else {
				expect(result.value.status).toBe(503);
				expect((await result.value.json()).error.code).toBe('service_unavailable');
			}
		}
		expect(signInMock).toHaveBeenCalledTimes(20);
	});

	it('returns exactly 4 rate-limited responses for 12 concurrent attempts by one identity', async () => {
		let hits = 0;
		checkRateLimitMock.mockImplementation(async () => {
			hits += 1;
			return hits <= 8;
		});
		signInMock.mockResolvedValue({
			access_token: 'shared-access',
			refresh_token: 'shared-refresh',
			user: { id: 'shared-user', email: 'shared@test.invalid' },
		});

		const responses = await Promise.all(
			Array.from({ length: 12 }, () =>
				loginHost({
					request: createMockRequest(
						{
							email: 'shared@test.invalid',
							password: 'SharedConcurrentPassword!',
							method: 'password',
						},
						{ 'X-Forwarded-For': '203.0.113.12' },
					),
					url: new URL('http://localhost/api/auth/login-host'),
				} as unknown as APIContext),
			),
		);

		expect(responses.filter(({ status }) => status === 200)).toHaveLength(8);
		expect(responses.filter(({ status }) => status === 429)).toHaveLength(4);
		expect(signInMock).toHaveBeenCalledTimes(8);
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
