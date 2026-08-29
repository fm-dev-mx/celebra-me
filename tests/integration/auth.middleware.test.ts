import type { APIContext } from 'astro';
import { onRequest as middleware } from '../../src/middleware';

interface TestLocals {
	session?: {
		userId: string;
		email: string;
		role: string;
		isSuperAdmin: boolean;
		accessToken: string;
		mustChangePassword?: boolean;
	};
	hasAdminStrongAuth?: boolean;
}

function createContext(path: string) {
	const locals: TestLocals = {};
	return {
		url: new URL(`http://localhost${path}`),
		cookies: mockCookies,
		redirect: mockRedirect,
		request: {
			headers: new Map([['user-agent', 'test-agent']]),
		},
		locals,
	};
}

async function resolveAfterMicrotasks<T>(value: T, turns: number): Promise<T> {
	let pending = Promise.resolve();
	for (let turn = 0; turn < turns; turn += 1) {
		pending = pending.then(() => undefined);
	}
	await pending;
	return value;
}

function createIsolatedContext(path: string, initialCookies: Record<string, string>) {
	const values = new Map(Object.entries(initialCookies));
	const cookies = {
		get: jest.fn((name: string) => {
			const value = values.get(name);
			return value === undefined ? undefined : { value };
		}),
		set: jest.fn((name: string, value: string) => values.set(name, value)),
		delete: jest.fn((name: string) => values.delete(name)),
	};
	const redirect = jest.fn(
		(target: string) => new Response(null, { status: 302, headers: { Location: target } }),
	);
	const next = jest.fn(async () => new Response(null, { status: 200 }));
	const locals: TestLocals = {};
	return {
		context: {
			url: new URL(`http://localhost${path}`),
			cookies,
			redirect,
			request: { headers: new Map([['user-agent', 'concurrency-test']]) },
			locals,
		},
		cookies,
		locals,
		next,
		redirect,
		values,
	};
}

function mockSupabaseResponse(overrides: Record<string, unknown> = {}) {
	mockFetch.mockResolvedValue({
		ok: true,
		json: async () => ({
			id: 'default-id',
			app_metadata: { role: 'host_client' },
			amr: [{ method: 'password' }],
			...overrides,
		}),
	});
}

let mockCookies: { get: jest.Mock; set: jest.Mock; delete: jest.Mock };
let mockRedirect: jest.Mock;
let mockFetch: jest.Mock;
let mockNext: jest.Mock;
let originalFetch: typeof global.fetch;
let originalSupabaseUrl: string | undefined;
let originalSupabaseAnon: string | undefined;

describe('Middleware: Authentication & Authorization', () => {
	beforeEach(() => {
		mockCookies = {
			get: jest.fn(),
			set: jest.fn(),
			delete: jest.fn(),
		};
		mockRedirect = jest.fn((path) => {
			const response = new Response(null, { status: 302, headers: { Location: path } });
			Object.assign(response, { path });
			return response;
		});
		mockNext = jest.fn(() => ({ status: 200 }));
		originalFetch = global.fetch;
		mockFetch = jest.fn();
		global.fetch = mockFetch as jest.Mock;
		originalSupabaseUrl = process.env.SUPABASE_URL;
		originalSupabaseAnon = process.env.SUPABASE_ANON_KEY;
		process.env.SUPABASE_URL = 'http://localhost:54321';
		process.env.SUPABASE_ANON_KEY = 'anon-key';
	});

	afterEach(() => {
		global.fetch = originalFetch;
		process.env.SUPABASE_URL = originalSupabaseUrl;
		process.env.SUPABASE_ANON_KEY = originalSupabaseAnon;
	});

	it('allows public routes without session', async () => {
		const context = createContext('/login');
		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it('marks invitation-like 404 responses as private', async () => {
		const context = createContext('/not-an-event/missing-invitation');
		mockNext.mockReturnValue(new Response(null, { status: 404 }));

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected a response.');
		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});

	it('redirects private routes without session', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue(null);

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/login');
		expect(context.locals.session).toBeUndefined();
		const response = mockRedirect.mock.results[0]?.value as Response;
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});

	it('passes an unauthenticated dashboard API request through to its route guard', async () => {
		const context = createContext('/api/dashboard/commercial/timeline');
		mockCookies.get.mockReturnValue(null);

		await middleware(context as unknown as APIContext, mockNext);

		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it('returns controlled HTML and preserves cookies when the auth provider is unavailable', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockFetch.mockRejectedValue(new Error('auth provider unavailable'));

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected an HTML error response.');
		expect(response.status).toBe(503);
		expect(response.headers.get('Retry-After')).toBe('5');
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(await response.text()).toContain('No es posible validar su sesión');
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(mockNext).not.toHaveBeenCalled();
		expect(mockCookies.set).not.toHaveBeenCalled();
		expect(mockCookies.delete).not.toHaveBeenCalled();
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('does not redirect to /login when /login auth validation fails (prevents redirect loop)', async () => {
		const context = createContext('/login');
		mockCookies.get.mockReturnValue({ value: 'stale-token' });
		mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:54321'));

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected an HTML error response.');
		expect(response.status).toBe(503);
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(mockNext).not.toHaveBeenCalled();
		expect(mockCookies.delete).not.toHaveBeenCalled();
	});

	it('returns controlled HTML 500 for missing configuration without clearing cookies', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockImplementation((name: string) =>
			name === 'sb-access-token' ? { value: 'valid-token' } : null,
		);
		delete process.env.SUPABASE_ANON_KEY;
		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected an HTML error response.');
		expect(response.status).toBe(500);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(mockFetch).not.toHaveBeenCalled();
		expect(mockCookies.delete).not.toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(mockNext).not.toHaveBeenCalled();
		consoleErrorSpy.mockRestore();
	});

	it('returns structured JSON for dashboard API auth-provider failures', async () => {
		const context = createContext('/api/dashboard/commercial/timeline');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockFetch.mockRejectedValue(new Error('auth provider unavailable'));

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected an API error response.');
		expect(response.status).toBe(503);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(response.headers.get('Retry-After')).toBe('5');
		expect(await response.json()).toEqual({
			success: false,
			error: {
				code: 'service_unavailable',
				message: 'El servicio de autenticación no está disponible temporalmente.',
			},
		});
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(mockNext).not.toHaveBeenCalled();
		expect(mockCookies.delete).not.toHaveBeenCalled();
	});

	it('uses the embedded refresh user and commits rotated tokens without a second user call', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockImplementation((name: string) => {
			if (name === 'sb-access-token') return { value: 'rejected-access' };
			if (name === 'sb-refresh-token') return { value: 'valid-refresh' };
			return null;
		});
		mockFetch.mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				access_token: 'rotated-access',
				refresh_token: 'rotated-refresh',
				user: {
					id: 'host-1',
					email: 'host@test.com',
					app_metadata: { role: 'host_client' },
					amr: [{ method: 'password' }],
				},
			}),
		});

		await middleware(context as unknown as APIContext, mockNext);

		expect(mockFetch).toHaveBeenCalledTimes(2);
		expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/auth/v1/user');
		expect(String(mockFetch.mock.calls[1]?.[0])).toContain(
			'/auth/v1/token?grant_type=refresh_token',
		);
		expect(mockCookies.set).toHaveBeenCalledWith(
			'sb-access-token',
			'rotated-access',
			expect.any(Object),
		);
		expect(mockCookies.set).toHaveBeenCalledWith(
			'sb-refresh-token',
			'rotated-refresh',
			expect.any(Object),
		);
		expect(context.locals.session?.userId).toBe('host-1');
	});

	it('uses one Auth call for a refresh-only session', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockImplementation((name: string) =>
			name === 'sb-refresh-token' ? { value: 'valid-refresh' } : null,
		);
		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				access_token: 'rotated-access',
				refresh_token: 'rotated-refresh',
				user: {
					id: 'host-1',
					app_metadata: { role: 'host_client' },
					amr: [{ method: 'password' }],
				},
			}),
		});

		await middleware(context as unknown as APIContext, mockNext);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(String(mockFetch.mock.calls[0]?.[0])).toContain('grant_type=refresh_token');
		expect(mockNext).toHaveBeenCalled();
	});

	it('clears primary cookies after a confirmed rejected refresh', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockImplementation((name: string) =>
			name === 'sb-refresh-token' ? { value: 'rejected-refresh' } : null,
		);
		mockFetch.mockResolvedValue({ ok: false, status: 401 });

		await middleware(context as unknown as APIContext, mockNext);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockCookies.delete).toHaveBeenCalledWith('sb-access-token', { path: '/' });
		expect(mockCookies.delete).toHaveBeenCalledWith('sb-refresh-token', { path: '/' });
		expect(mockCookies.delete).toHaveBeenCalledWith('sb-trust-device', { path: '/' });
		expect(mockRedirect).toHaveBeenCalledWith('/login');
	});

	it('clears primary cookies after rejected access without a refresh token', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockImplementation((name: string) =>
			name === 'sb-access-token' ? { value: 'rejected-access' } : null,
		);
		mockFetch.mockResolvedValue({ ok: false, status: 403 });

		await middleware(context as unknown as APIContext, mockNext);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockCookies.delete).toHaveBeenCalledWith('sb-access-token', { path: '/' });
		expect(mockCookies.delete).toHaveBeenCalledWith('sb-refresh-token', { path: '/' });
		expect(mockCookies.delete).toHaveBeenCalledWith('sb-trust-device', { path: '/' });
		expect(mockRedirect).toHaveBeenCalledWith('/login');
	});

	it('preserves every cookie when refresh fails transiently', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockImplementation((name: string) =>
			name === 'sb-refresh-token' ? { value: 'refresh-token' } : null,
		);
		mockFetch.mockRejectedValue(new TypeError('network unavailable'));

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected an HTML error response.');
		expect(response.status).toBe(503);
		expect(mockCookies.set).not.toHaveBeenCalled();
		expect(mockCookies.delete).not.toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it('preserves cookies when a refresh success payload is malformed', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockImplementation((name: string) =>
			name === 'sb-refresh-token' ? { value: 'refresh-token' } : null,
		);
		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ access_token: 'partial-token' }),
		});

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected an HTML error response.');
		expect(response.status).toBe(503);
		expect(mockCookies.set).not.toHaveBeenCalled();
		expect(mockCookies.delete).not.toHaveBeenCalled();
	});

	it('isolates 20 concurrent valid, refreshed, rejected, and transient sessions', async () => {
		const log = jest.spyOn(console, 'info').mockImplementation(() => {});
		const callCounts = new Map<number, number>();
		mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const headers = new Headers(init?.headers);
			const authorization = headers.get('Authorization') || '';
			let index: number;

			if (url.endsWith('/auth/v1/user')) {
				const token = authorization.replace(/^Bearer\s+/i, '');
				index = Number(token.match(/-(\d+)$/)?.[1]);
				callCounts.set(index, (callCounts.get(index) ?? 0) + 1);
				if (token.startsWith('valid-')) {
					return resolveAfterMicrotasks(
						{
							ok: true,
							status: 200,
							json: async () => ({
								id: `valid-user-${index}`,
								email: `valid-${index}@test.invalid`,
								app_metadata: { role: 'host_client' },
								amr: [{ method: 'password' }],
							}),
						} as Response,
						20 - index,
					);
				}
				if (token.startsWith('transient-')) {
					return resolveAfterMicrotasks(
						{ ok: false, status: 503 } as Response,
						20 - index,
					);
				}
				return resolveAfterMicrotasks({ ok: false, status: 401 } as Response, 20 - index);
			}

			const body = JSON.parse(String(init?.body)) as { refresh_token: string };
			index = Number(body.refresh_token.match(/-(\d+)$/)?.[1]);
			callCounts.set(index, (callCounts.get(index) ?? 0) + 1);
			return resolveAfterMicrotasks(
				{
					ok: true,
					status: 200,
					json: async () => ({
						access_token: `rotated-access-${index}`,
						refresh_token: `rotated-refresh-${index}`,
						user: {
							id: `refreshed-user-${index}`,
							email: `refreshed-${index}@test.invalid`,
							app_metadata: { role: 'host_client' },
							amr: [{ method: 'password' }],
						},
					}),
				} as Response,
				20 - index,
			);
		});

		const cases = Array.from({ length: 20 }, (_, index) => {
			const group = Math.floor(index / 5);
			const initialCookies: Record<string, string> = {};
			if (group === 0) initialCookies['sb-access-token'] = `valid-${index}`;
			if (group === 1) {
				initialCookies['sb-access-token'] = `rejected-${index}`;
				initialCookies['sb-refresh-token'] = `refresh-${index}`;
			}
			if (group === 2) initialCookies['sb-access-token'] = `invalid-${index}`;
			if (group === 3) {
				initialCookies['sb-access-token'] = `transient-${index}`;
				initialCookies['sb-refresh-token'] = `preserved-refresh-${index}`;
				initialCookies['sb-trust-device'] = `preserved-trust-${index}`;
				initialCookies['sb-mfa-session'] = `preserved-mfa-${index}`;
				initialCookies['sb-idle-seen'] = String(Math.floor(Date.now() / 1000));
			}
			return {
				index,
				group,
				...createIsolatedContext('/dashboard/invitados', initialCookies),
			};
		});

		const settled = await Promise.allSettled(
			cases.map(({ context, next }) => middleware(context as unknown as APIContext, next)),
		);
		expect(settled.every((result) => result.status === 'fulfilled')).toBe(true);

		for (const [position, testCase] of cases.entries()) {
			const result = settled[position];
			if (result?.status !== 'fulfilled') continue;
			if (testCase.group === 0) {
				expect(result.value).toMatchObject({ status: 200 });
				expect(testCase.locals.session?.userId).toBe(`valid-user-${testCase.index}`);
				expect(callCounts.get(testCase.index)).toBe(1);
			}
			if (testCase.group === 1) {
				expect(result.value).toMatchObject({ status: 200 });
				expect(testCase.locals.session?.userId).toBe(`refreshed-user-${testCase.index}`);
				expect(testCase.cookies.set).toHaveBeenCalledWith(
					'sb-access-token',
					`rotated-access-${testCase.index}`,
					expect.any(Object),
				);
				expect(testCase.cookies.set).toHaveBeenCalledWith(
					'sb-refresh-token',
					`rotated-refresh-${testCase.index}`,
					expect.any(Object),
				);
				expect(callCounts.get(testCase.index)).toBe(2);
			}
			if (testCase.group === 2) {
				expect(result.value).toMatchObject({ status: 302 });
				expect(testCase.redirect).toHaveBeenCalledWith('/login');
				expect(testCase.cookies.delete).toHaveBeenCalledWith('sb-access-token', {
					path: '/',
				});
				expect(testCase.locals.session).toBeUndefined();
				expect(callCounts.get(testCase.index)).toBe(1);
			}
			if (testCase.group === 3) {
				expect(result.value).toBeInstanceOf(Response);
				expect((result.value as Response).status).toBe(503);
				expect(testCase.cookies.set).not.toHaveBeenCalled();
				expect(testCase.cookies.delete).not.toHaveBeenCalled();
				expect(testCase.values.get('sb-refresh-token')).toBe(
					`preserved-refresh-${testCase.index}`,
				);
				expect(testCase.values.get('sb-trust-device')).toBe(
					`preserved-trust-${testCase.index}`,
				);
				expect(callCounts.get(testCase.index)).toBe(1);
			}
			expect(callCounts.get(testCase.index)).toBeLessThanOrEqual(2);
		}
		expect(mockFetch).toHaveBeenCalledTimes(25);
		expect(log).toHaveBeenCalledTimes(25);
	});

	it.each([
		'/dashboard/invitaciones/proj-1/preview',
		'/dashboard/invitaciones/proj-1/preview?embed=1',
	])('redirects internal preview route without session (%s)', async (path) => {
		const context = createContext(path);
		mockCookies.get.mockReturnValue(null);

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/login');
		expect(mockNext).not.toHaveBeenCalled();
	});

	it('allows normal user (aal1) access to dashboard', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockSupabaseResponse({
			id: 'user-1',
			email: 'host@test.com',
			app_metadata: { role: 'host_client' },
			amr: [{ method: 'password' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();

		expect(context.locals.session).toBeDefined();
		expect(context.locals.session!.userId).toBe('user-1');
		expect(context.locals.session!.email).toBe('host@test.com');
		expect(context.locals.session!.role).toBe('host_client');
		expect(context.locals.session!.isSuperAdmin).toBe(false);
		expect(context.locals.session!.accessToken).toBe('valid-token');
		expect(context.locals.hasAdminStrongAuth).toBe(false);
	});

	it('redirects users with must_change_password away from protected pages', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockSupabaseResponse({
			id: 'user-1',
			email: 'host@test.com',
			app_metadata: { role: 'host_client', must_change_password: true },
			amr: [{ method: 'password' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/dashboard/cambiar-contrasena');
		expect(mockNext).not.toHaveBeenCalled();
	});

	it('allows the change-password page when must_change_password is required', async () => {
		const context = createContext('/dashboard/cambiar-contrasena');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockSupabaseResponse({
			id: 'user-1',
			email: 'host@test.com',
			app_metadata: { role: 'host_client', must_change_password: true },
			amr: [{ method: 'password' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(context.locals.session?.mustChangePassword).toBe(true);
	});

	it('rejects protected dashboard APIs when must_change_password is required', async () => {
		const context = createContext('/api/dashboard/guests');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockSupabaseResponse({
			id: 'user-1',
			email: 'host@test.com',
			app_metadata: { role: 'host_client', must_change_password: true },
			amr: [{ method: 'password' }],
		});

		const response = await middleware(context as unknown as APIContext, mockNext);
		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected an API error response.');
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			success: false,
			error: {
				code: 'password_change_required',
				message: 'Es necesario cambiar la contraseña temporal para continuar.',
			},
		});
		expect(mockNext).not.toHaveBeenCalled();
	});

	it('allows dashboard access for legacy users without must_change_password', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockSupabaseResponse({
			id: 'legacy-1',
			email: 'legacy@test.com',
			app_metadata: { role: 'host_client' },
			amr: [{ method: 'password' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
		expect(context.locals.session?.mustChangePassword).toBe(false);
	});

	it('redirects superadmin without MFA (aal1) to MFA setup', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'admin-token' });
		mockSupabaseResponse({
			id: 'admin-1',
			app_metadata: { role: 'super_admin' },
			amr: [{ method: 'password' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/dashboard/mfa-setup');
	});

	it('sets temporary MFA cookies (300s) on MFA setup route for superadmin', async () => {
		const context = createContext('/dashboard/mfa-setup');
		mockCookies.get.mockImplementation((name: string) => {
			if (name === 'sb-access-token') return { value: 'admin-token' };
			if (name === 'sb-refresh-token') return { value: 'refresh-token' };
			return null;
		});
		mockSupabaseResponse({
			id: 'admin-1',
			app_metadata: { role: 'super_admin' },
			amr: [{ method: 'password' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockCookies.set).toHaveBeenCalledWith(
			'sb-mfa-session',
			'admin-token',
			expect.objectContaining({
				path: '/dashboard/mfa-setup',
				maxAge: 300,
			}),
		);
		expect(mockCookies.set).toHaveBeenCalledWith(
			'sb-mfa-refresh',
			'refresh-token',
			expect.objectContaining({
				path: '/dashboard/mfa-setup',
				maxAge: 300,
			}),
		);
	});

	it('allows superadmin with TOTP MFA (aal2) to dashboard', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'admin-token' });
		mockSupabaseResponse({
			id: 'admin-1',
			email: 'admin@test.com',
			app_metadata: { role: 'super_admin' },
			amr: [{ method: 'totp' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();

		expect(context.locals.session).toBeDefined();
		expect(context.locals.session!.userId).toBe('admin-1');
		expect(context.locals.session!.email).toBe('admin@test.com');
		expect(context.locals.session!.role).toBe('super_admin');
		expect(context.locals.session!.isSuperAdmin).toBe(true);
		expect(context.locals.session!.accessToken).toBe('admin-token');
		expect(context.locals.hasAdminStrongAuth).toBe(true);
	});

	it('allows superadmin with OTP MFA (aal2) to dashboard', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'admin-token' });
		mockSupabaseResponse({
			id: 'admin-1',
			app_metadata: { role: 'super_admin' },
			amr: [{ method: 'otp' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it('redirects host_client from admin-only path to /dashboard/invitados', async () => {
		const context = createContext('/dashboard/usuarios');
		mockCookies.get.mockReturnValue({ value: 'host-token' });
		mockSupabaseResponse({
			id: 'host-1',
			app_metadata: { role: 'host_client' },
			amr: [{ method: 'password' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/dashboard/invitados');
	});

	it.each([
		'/dashboard/invitaciones/proj-1/preview',
		'/dashboard/invitaciones/proj-1/preview?embed=1',
	])('blocks host_client from internal invitation preview route (%s)', async (path) => {
		const context = createContext(path);
		mockCookies.get.mockReturnValue({ value: 'host-token' });
		mockSupabaseResponse({
			id: 'host-1',
			app_metadata: { role: 'host_client' },
			amr: [{ method: 'password' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/dashboard/invitados');
		expect(mockNext).not.toHaveBeenCalled();
	});

	it('allows super_admin with MFA to access admin-only path', async () => {
		const context = createContext('/dashboard/usuarios');
		mockCookies.get.mockImplementation((name: string) => {
			if (name === 'sb-access-token') return { value: 'admin-token' };
			return null;
		});
		mockSupabaseResponse({
			id: 'admin-1',
			app_metadata: { role: 'super_admin' },
			amr: [{ method: 'totp' }],
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	describe('MFA bypass (DEV_MFA_BYPASS)', () => {
		let originalDevMfaBypass: string | undefined;
		let originalNodeEnv: string | undefined;

		beforeEach(() => {
			originalDevMfaBypass = process.env.DEV_MFA_BYPASS;
			originalNodeEnv = process.env.NODE_ENV;
			delete process.env.VERCEL;
			delete process.env.VERCEL_ENV;
		});

		afterEach(() => {
			process.env.DEV_MFA_BYPASS = originalDevMfaBypass;
			process.env.NODE_ENV = originalNodeEnv;
		});

		it('skips MFA redirect for superadmin aal1 with bypass active', async () => {
			process.env.DEV_MFA_BYPASS = 'true';
			process.env.NODE_ENV = 'development';

			const context = createContext('/dashboard/invitados');
			mockCookies.get.mockReturnValue({ value: 'admin-token' });
			mockSupabaseResponse({
				id: 'admin-1',
				app_metadata: { role: 'super_admin' },
				amr: [{ method: 'password' }],
			});

			await middleware(context as unknown as APIContext, mockNext);
			expect(mockNext).toHaveBeenCalled();
			expect(mockRedirect).not.toHaveBeenCalled();
			expect(context.locals.hasAdminStrongAuth).toBe(true);
		});

		it('redirects superadmin from /dashboard/mfa-setup to /dashboard/admin with bypass', async () => {
			process.env.DEV_MFA_BYPASS = 'true';
			process.env.NODE_ENV = 'development';

			const context = createContext('/dashboard/mfa-setup');
			mockCookies.get.mockImplementation((name: string) => {
				if (name === 'sb-access-token') return { value: 'admin-token' };
				if (name === 'sb-refresh-token') return { value: 'refresh-token' };
				return null;
			});
			mockSupabaseResponse({
				id: 'admin-1',
				app_metadata: { role: 'super_admin' },
				amr: [{ method: 'password' }],
			});

			await middleware(context as unknown as APIContext, mockNext);
			expect(mockRedirect).toHaveBeenCalledWith('/dashboard/admin');
			expect(mockNext).not.toHaveBeenCalled();
		});

		it('still redirects to MFA setup when bypass active but Supabase is remote', async () => {
			process.env.DEV_MFA_BYPASS = 'true';
			process.env.NODE_ENV = 'development';
			process.env.SUPABASE_URL = 'https://project.supabase.co';

			const context = createContext('/dashboard/invitados');
			mockCookies.get.mockReturnValue({ value: 'admin-token' });
			mockSupabaseResponse({
				id: 'admin-1',
				app_metadata: { role: 'super_admin' },
				amr: [{ method: 'password' }],
			});

			await middleware(context as unknown as APIContext, mockNext);
			expect(mockRedirect).toHaveBeenCalledWith('/dashboard/mfa-setup');
			expect(mockNext).not.toHaveBeenCalled();
		});

		it('still redirects host_client on admin-only paths even with bypass active', async () => {
			process.env.DEV_MFA_BYPASS = 'true';
			process.env.NODE_ENV = 'development';

			const context = createContext('/dashboard/usuarios');
			mockCookies.get.mockReturnValue({ value: 'host-token' });
			mockSupabaseResponse({
				id: 'host-1',
				app_metadata: { role: 'host_client' },
				amr: [{ method: 'password' }],
			});

			await middleware(context as unknown as APIContext, mockNext);
			expect(mockRedirect).toHaveBeenCalledWith('/dashboard/invitados');
		});

		it('still redirects unauthenticated user to /login even with bypass active', async () => {
			process.env.DEV_MFA_BYPASS = 'true';
			process.env.NODE_ENV = 'development';

			const context = createContext('/dashboard/invitados');
			mockCookies.get.mockReturnValue(null);

			await middleware(context as unknown as APIContext, mockNext);
			expect(mockRedirect).toHaveBeenCalledWith('/login');
		});
	});

	it('does not catch or convert downstream page rendering errors from next()', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockSupabaseResponse({
			id: 'user-1',
			email: 'host@test.com',
			app_metadata: { role: 'host_client' },
			amr: [{ method: 'password' }],
		});

		const renderError = new Error('Page rendering error');
		mockNext.mockRejectedValue(renderError);

		await expect(middleware(context as unknown as APIContext, mockNext)).rejects.toThrow(
			'Page rendering error',
		);

		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it('marks authenticated dashboard HTML as private no-store without changing the body', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });
		mockSupabaseResponse({
			id: 'user-1',
			email: 'host@test.com',
			app_metadata: { role: 'host_client' },
			amr: [{ method: 'password' }],
		});
		mockNext.mockReturnValue(new Response('<html>dashboard</html>', { status: 200 }));

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected a response.');
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(await response.text()).toBe('<html>dashboard</html>');
	});

	it('marks dashboard JSON as private no-store including unauthenticated route-guard errors', async () => {
		const context = createContext('/api/dashboard/guests');
		mockCookies.get.mockReturnValue(null);
		mockNext.mockReturnValue(
			new Response(JSON.stringify({ success: false, error: { code: 'unauthorized' } }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected a response.');
		expect(response.status).toBe(401);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(await response.json()).toEqual({
			success: false,
			error: { code: 'unauthorized' },
		});
	});

	it('marks GET /api/auth/session as private no-store without changing status or payload', async () => {
		const context = createContext('/api/auth/session');
		mockNext.mockReturnValue(
			new Response(JSON.stringify({ success: false }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(mockNext).toHaveBeenCalled();
		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected a response.');
		expect(response.status).toBe(401);
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
		expect(await response.json()).toEqual({ success: false });
	});

	it('does not rewrite public login or health responses', async () => {
		const loginContext = createContext('/login');
		mockNext.mockReturnValue(new Response('<html>login</html>', { status: 200 }));

		const loginResponse = await middleware(loginContext as unknown as APIContext, mockNext);

		expect(loginResponse).toBeInstanceOf(Response);
		if (!(loginResponse instanceof Response)) throw new Error('Expected a login response.');
		expect(loginResponse.headers.get('Cache-Control')).toBeNull();

		const healthContext = createContext('/api/health');
		mockNext.mockReturnValue(
			new Response(JSON.stringify({ status: 'healthy' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const healthResponse = await middleware(healthContext as unknown as APIContext, mockNext);

		expect(healthResponse).toBeInstanceOf(Response);
		if (!(healthResponse instanceof Response)) throw new Error('Expected a health response.');
		expect(healthResponse.headers.get('Cache-Control')).toBeNull();
		expect(await healthResponse.json()).toEqual({ status: 'healthy' });
	});

	it('preserves anonymous invitation origin-revalidate headers', async () => {
		const context = createContext('/xv/romina-rios-chaparro');
		mockNext.mockReturnValue(
			new Response('<html>invitation</html>', {
				status: 200,
				headers: {
					'Cache-Control': 'public, max-age=0, s-maxage=0, must-revalidate',
				},
			}),
		);

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (!(response instanceof Response)) throw new Error('Expected a response.');
		expect(response.headers.get('Cache-Control')).toBe(
			'public, max-age=0, s-maxage=0, must-revalidate',
		);
	});

	it('does not throw when next() returns a headerless mock for a private path', async () => {
		const context = createContext('/api/auth/session');

		const response = await middleware(context as unknown as APIContext, mockNext);

		expect(response).toEqual({ status: 200 });
	});
});
