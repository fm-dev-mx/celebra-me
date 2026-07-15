import type { APIContext } from 'astro';
import { onRequest as middleware } from '../../src/middleware';

describe('Middleware: Scanner Blocking & Routing Security', () => {
	let mockNext: jest.Mock;
	let mockCookies: any;
	let mockRedirect: jest.Mock;

	beforeEach(() => {
		mockNext = jest.fn(() => ({ status: 200 }));
		mockCookies = {
			get: jest.fn(),
			set: jest.fn(),
			delete: jest.fn(),
		};
		mockRedirect = jest.fn((path) => ({ status: 302, path }));
	});

	function createContext(path: string) {
		return {
			url: new URL(`http://localhost${path}`),
			cookies: mockCookies,
			redirect: mockRedirect,
			request: {
				headers: new Map([['user-agent', 'test-agent']]),
			},
			locals: {},
		} as unknown as APIContext;
	}

	it.each([
		'/wp-admin',
		'/wp-admin/index.php',
		'/wp-content/uploads',
		'/wp-includes/js',
		'/cgi-bin/test',
		'/index.php',
		'/some-path/test.php',
		'/Wp-Admin/index.php',
		'/INDEX.PHP',
	])('blocks scanner path: %s with immediate 404 response', async (path) => {
		const context = createContext(path);
		const response = await middleware(context, mockNext);

		expect(response).toBeInstanceOf(Response);
		if (response instanceof Response) {
			expect(response.status).toBe(404);
		}
		expect(mockNext).not.toHaveBeenCalled();
	});

	it.each([
		'/login',
		'/api/tracking/events',
		'/boda/maria-y-jose',
		'/boda/maria-y-jose/i/123',
	])('does not block legitimate route: %s', async (path) => {
		const context = createContext(path);
		await middleware(context, mockNext);

		expect(mockNext).toHaveBeenCalled();
	});

	it('does not block legitimate dashboard route (redirects to login instead of 404)', async () => {
		const context = createContext('/dashboard/invitados');
		const response = (await middleware(context, mockNext)) as any;

		expect(response).toBeDefined();
		expect(response.status).toBe(302);
		expect(response.path).toBe('/login');
		expect(mockNext).not.toHaveBeenCalled();
	});
});
