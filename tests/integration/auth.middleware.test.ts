import type { APIContext } from 'astro';
import { onRequest as middleware } from '../../src/middleware';

interface TestLocals {
	session?: {
		userId: string;
		email: string;
		role: string;
		isSuperAdmin: boolean;
		accessToken: string;
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
		mockRedirect = jest.fn((path) => ({ status: 302, path }));
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

	it('redirects private routes without session', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue(null);

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/login');
		expect(context.locals.session).toBeUndefined();
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

	it.skip('allows superadmin with aal2 claim in token even when amr is empty', async () => {
		// Requires more complex mocking for JWT validation
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
});
