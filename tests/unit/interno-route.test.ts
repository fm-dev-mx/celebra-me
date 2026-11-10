import type { APIContext } from 'astro';
import { ALL, GET, HEAD } from '@/pages/interno';
import {
	COOKIE_NAME_IGNORE_TRACKING,
	IGNORE_TRACKING_MAX_AGE_SECONDS,
} from '@/lib/tracking/internal-exclusion';

function createMockContext(urlStr: string, method = 'GET') {
	const url = new URL(urlStr);
	const cookies = {
		set: jest.fn(),
		delete: jest.fn(),
		get: jest.fn(),
	};
	const request = new Request(urlStr, { method });
	return {
		context: { url, cookies, request } as unknown as APIContext,
		cookies,
	};
}

describe('SSR route /interno', () => {
	it('sets the internal traffic cookie and redirects 302 to / on GET', async () => {
		const { context, cookies } = createMockContext('https://www.celebra-me.com/interno', 'GET');
		const response = await GET(context);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/');
		expect(response.headers.get('Cache-Control')).toContain('private');
		expect(cookies.set).toHaveBeenCalledWith(
			COOKIE_NAME_IGNORE_TRACKING,
			'true',
			expect.objectContaining({
				path: '/',
				httpOnly: false,
				maxAge: IGNORE_TRACKING_MAX_AGE_SECONDS,
			}),
		);
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('sets the internal traffic cookie and redirects 302 to / on HEAD', async () => {
		const { context, cookies } = createMockContext(
			'https://www.celebra-me.com/interno',
			'HEAD',
		);
		const response = await HEAD(context);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/');
		expect(response.headers.get('Cache-Control')).toContain('private');
		expect(cookies.set).toHaveBeenCalledWith(
			COOKIE_NAME_IGNORE_TRACKING,
			'true',
			expect.objectContaining({
				path: '/',
				httpOnly: false,
				maxAge: IGNORE_TRACKING_MAX_AGE_SECONDS,
			}),
		);
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('clears the cookie and redirects 302 to / with ?salir=1', async () => {
		const { context, cookies } = createMockContext(
			'https://www.celebra-me.com/interno?salir=1',
			'GET',
		);
		const response = await GET(context);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/');
		expect(response.headers.get('Cache-Control')).toContain('private');
		expect(cookies.delete).toHaveBeenCalledWith(COOKIE_NAME_IGNORE_TRACKING, { path: '/' });
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('clears the cookie and redirects 302 to / with ?interno=0', async () => {
		const { context, cookies } = createMockContext(
			'https://www.celebra-me.com/interno?interno=0',
			'GET',
		);
		const response = await GET(context);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('/');
		expect(response.headers.get('Cache-Control')).toContain('private');
		expect(cookies.delete).toHaveBeenCalledWith(COOKIE_NAME_IGNORE_TRACKING, { path: '/' });
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('does not touch cookies for methods other than GET and HEAD and responds 405', async () => {
		for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
			const { context, cookies } = createMockContext(
				'https://www.celebra-me.com/interno',
				method,
			);
			const response = await ALL(context);

			expect(response.status).toBe(405);
			expect(response.headers.get('Allow')).toBe('GET, HEAD');
			expect(cookies.set).not.toHaveBeenCalled();
			expect(cookies.delete).not.toHaveBeenCalled();
		}
	});
});
