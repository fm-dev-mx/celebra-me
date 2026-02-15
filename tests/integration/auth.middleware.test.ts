import type { APIContext } from 'astro';
import { onRequest as middleware } from '../../src/middleware';

describe('Middleware: Authentication & Authorization', () => {
	let mockCookies: { get: jest.Mock; set: jest.Mock; delete: jest.Mock };
	let mockRedirect: jest.Mock;
	let mockNext: jest.Mock;
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		mockCookies = {
			get: jest.fn(),
			set: jest.fn(),
			delete: jest.fn(),
		};
		mockRedirect = jest.fn((path) => ({ status: 302, path }));
		mockNext = jest.fn(() => ({ status: 200 }));
		originalFetch = global.fetch;
		global.fetch = jest.fn();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	const createContext = (path: string) => ({
		url: new URL(`http://localhost${path}`),
		cookies: mockCookies,
		redirect: mockRedirect,
	});

	it('Scenario: Allow Public Routes without Session', async () => {
		const context = createContext('/login');
		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it('Scenario: Redirect Private Routes without Session', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue(null); // No token

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/login');
	});

	it('Scenario: Normal User (aal1) Access to Dashboard', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'valid-token' });

		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				app_metadata: { role: 'host_client' },
				amr: [{ method: 'password' }], // aal1
			}),
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it('Scenario: Superadmin without MFA (aal1) redirected to MFA Setup', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'admin-token' });

		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				app_metadata: { role: 'super_admin' },
				amr: [{ method: 'password' }], // aal1
			}),
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockRedirect).toHaveBeenCalledWith('/dashboard/mfa-setup');
	});

	it('Scenario: Superadmin with MFA (aal2) allowed to Dashboard', async () => {
		const context = createContext('/dashboard/invitados');
		mockCookies.get.mockReturnValue({ value: 'admin-token' });

		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				app_metadata: { role: 'super_admin' },
				amr: [{ method: 'mfa' }], // aal2
			}),
		});

		await middleware(context as unknown as APIContext, mockNext);
		expect(mockNext).toHaveBeenCalled();
		expect(mockRedirect).not.toHaveBeenCalled();
	});
});
