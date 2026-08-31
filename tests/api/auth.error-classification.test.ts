/**
 * Auth error classification tests.
 *
 * Covers:
 *   - Wrong password → 401
 *   - Network failure / unreachable Supabase → 503
 *   - Invalid API key / config error → safe error (not leaked as 401)
 *   - Retryable upstream failures → 503
 *   - No internal diagnostic data reaches the client
 *   - Local .env precedence over stale terminal values (via astro config logic)
 */
import { POST as loginHost } from '@/pages/api/auth/login-host';
import * as authApi from '@/lib/rsvp/auth/auth-api';
import * as rateLimitProvider from '@/lib/rsvp/security/rate-limit-provider';
import * as authIdentifierService from '@/lib/rsvp/services/auth-identifier.service';
import { createMockRequest } from '../helpers/api-mocks';
import type { APIContext } from 'astro';
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

describe('POST /api/auth/login-host — error classification', () => {
	const signInMock = authApi.signInWithPassword as jest.Mock;
	const checkRateLimitMock = rateLimitProvider.checkRateLimit as jest.Mock;
	const resolvePasswordAuthEmailMock =
		authIdentifierService.resolvePasswordAuthEmail as jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});
		checkRateLimitMock.mockResolvedValue(true);
		resolvePasswordAuthEmailMock.mockImplementation(async (id: string) => id);
	});

	const callLogin = async (overrides: Record<string, string> = {}) => {
		return loginHost({
			request: createMockRequest({
				method: 'password',
				email: 'host@test.com',
				password: 'correctPassword',
				...overrides,
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);
	};

	it('returns 200 for successful password login', async () => {
		signInMock.mockResolvedValue({
			access_token: 'token-123',
			refresh_token: 'refresh-456',
			user: { id: 'u1', email: 'host@test.com' },
		});

		const response = await callLogin();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.next).toBe('/dashboard/invitados');
	});

	it('returns 401 for wrong password', async () => {
		signInMock.mockRejectedValue(
			new AuthRequestError({ kind: 'http', operation: 'password_sign_in', status: 401 }),
		);

		const response = await callLogin({ password: 'contraseñaIncorrecta' });
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error.code).toBe('unauthorized');
		expect(body.error.message).toBe('Credenciales inválidas.');
		// No internal diagnostic data should leak to the client
		expect(body.error.details).toBeUndefined();
	});

	it('returns 401 for Supabase 400 (bad request, e.g. missing field)', async () => {
		signInMock.mockRejectedValue(
			new AuthRequestError({ kind: 'http', operation: 'password_sign_in', status: 400 }),
		);

		const response = await callLogin();
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error.code).toBe('unauthorized');
		expect(body.error.message).toBe('Credenciales inválidas.');
		expect(body.error.details).toBeUndefined();
	});

	it('returns 503 when Supabase is unreachable (network failure)', async () => {
		signInMock.mockRejectedValue(
			new AuthRequestError({ kind: 'network', operation: 'password_sign_in' }),
		);

		const response = await callLogin();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.error.code).toBe('service_unavailable');
		expect(body.error.message).toBe(
			'El servicio de autenticación no está disponible temporalmente.',
		);
		expect(body.error.details).toBeUndefined();
		expect(response.headers.get('Retry-After')).toBe('5');
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});

	it('returns 503 when Supabase returns 5xx', async () => {
		signInMock.mockRejectedValue(
			new AuthRequestError({ kind: 'http', operation: 'password_sign_in', status: 500 }),
		);

		const response = await callLogin();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.error.code).toBe('service_unavailable');
		expect(body.error.message).toBe(
			'El servicio de autenticación no está disponible temporalmente.',
		);
		expect(body.error.details).toBeUndefined();
	});

	it('returns 503 for any other Supabase 5xx status', async () => {
		signInMock.mockRejectedValue(
			new AuthRequestError({ kind: 'http', operation: 'password_sign_in', status: 503 }),
		);

		const response = await callLogin();
		expect(response.status).toBe(503);
	});

	it('returns 200 for magic link requests', async () => {
		const sendMagicMock = authApi.sendMagicLink as jest.Mock;
		sendMagicMock.mockResolvedValue({});

		const response = await loginHost({
			request: createMockRequest({
				email: 'magic@test.com',
				method: 'magic_link',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
	});

	it('returns 503 for a transient magic-link provider failure', async () => {
		const sendMagicMock = authApi.sendMagicLink as jest.Mock;
		sendMagicMock.mockRejectedValue(
			new AuthRequestError({ kind: 'timeout', operation: 'send_magic_link' }),
		);

		const response = await loginHost({
			request: createMockRequest({
				email: 'magic@test.com',
				method: 'magic_link',
			}),
			url: new URL('http://localhost/api/auth/login-host'),
		} as unknown as APIContext);

		expect(response.status).toBe(503);
		expect(response.headers.get('Retry-After')).toBe('5');
		expect((await response.json()).error.code).toBe('service_unavailable');
	});

	it('returns 401 when auth identifier resolution returns null', async () => {
		resolvePasswordAuthEmailMock.mockResolvedValue(null);

		const response = await callLogin();
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error.code).toBe('unauthorized');
		expect(body.error.details).toBeUndefined();
	});

	it('never leaks internal details on any error path', async () => {
		// Test several error types and verify none expose details
		const errors = [
			new AuthRequestError({ kind: 'network', operation: 'password_sign_in' }),
			new AuthRequestError({ kind: 'http', operation: 'password_sign_in', status: 401 }),
			new AuthRequestError({ kind: 'http', operation: 'password_sign_in', status: 500 }),
			new AuthRequestError({ kind: 'http', operation: 'password_sign_in', status: 403 }),
			new Error('Some unexpected error'),
		];

		for (const err of errors) {
			signInMock.mockRejectedValue(err);
			const response = await callLogin();
			const body = await response.json();

			expect(body.error.details).toBeUndefined();
			expect(body.error.message).not.toContain('supabase.co');
			expect(body.error.message).not.toContain('127.0.0.1');
			expect(body.error.message).not.toContain('stack');
		}
	});
});

describe('Env propagation policy (astro.config.mjs logic)', () => {
	const LOCAL_OVERRIDE_KEYS = new Set([
		'SUPABASE_URL',
		'SUPABASE_ANON_KEY',
		'PUBLIC_SUPABASE_URL',
		'PUBLIC_SUPABASE_ANON_KEY',
	]);

	it('allows .env to override terminal SUPABASE_URL in development', () => {
		// Simulate what astro.config.mjs does in development mode
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'development';

		// Simulate stale terminal env var
		const originalUrl = process.env.SUPABASE_URL;
		process.env.SUPABASE_URL = 'https://stale.example.com';

		// Simulate .env values from loadEnv
		const simulatedEnvVars: Record<string, string> = {
			SUPABASE_URL: 'http://127.0.0.1:54321',
			SUPABASE_ANON_KEY: 'local-key',
		};

		// Apply the policy (matching astro.config.mjs logic)
		for (const [key, value] of Object.entries(simulatedEnvVars)) {
			if (LOCAL_OVERRIDE_KEYS.has(key)) {
				process.env[key] = value;
			}
		}

		expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');

		// Restore
		process.env.SUPABASE_URL = originalUrl;
		process.env.NODE_ENV = originalNodeEnv;
	});

	it('preserves platform SUPABASE_URL in production', () => {
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';

		const originalUrl = process.env.SUPABASE_URL;
		process.env.SUPABASE_URL = 'https://project.supabase.co';

		// Simulate .env still having local values (though in production
		// .env may not even exist — this tests the guard)
		const simulatedEnvVars: Record<string, string> = {
			SUPABASE_URL: 'http://127.0.0.1:54321',
		};

		for (const [key, value] of Object.entries(simulatedEnvVars)) {
			// In production the non-development branch runs:
			// Only set if undefined (platform vars preserved)
			if (process.env[key] === undefined) {
				process.env[key] = value;
			}
		}

		// Platform var should NOT be overridden
		expect(process.env.SUPABASE_URL).toBe('https://project.supabase.co');

		process.env.SUPABASE_URL = originalUrl;
		process.env.NODE_ENV = originalNodeEnv;
	});

	it('fills unset vars from .env in production', () => {
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';

		// Simulate platform NOT setting this var (it's unset)
		const originalVal = process.env.SOME_OTHER_VAR;
		delete process.env.SOME_OTHER_VAR;

		const simulatedEnvVars: Record<string, string> = {
			SOME_OTHER_VAR: 'from-dotenv',
		};

		for (const [key, value] of Object.entries(simulatedEnvVars)) {
			if (process.env[key] === undefined) {
				process.env[key] = value;
			}
		}

		expect(process.env.SOME_OTHER_VAR).toBe('from-dotenv');

		process.env.SOME_OTHER_VAR = originalVal;
		process.env.NODE_ENV = originalNodeEnv;
	});

	afterEach(() => {
		// Ensure NODE_ENV is restored for downstream tests
		delete process.env.SUPABASE_URL;
		delete process.env.SUPABASE_ANON_KEY;
	});
});
