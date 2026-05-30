jest.mock('@/lib/server/env', () => ({
	getEnv: jest.fn(() => ''),
}));

import { resolveSiteOrigin } from '@/lib/shared/origin';

describe('resolveSiteOrigin', () => {
	it('falls back to localhost when BASE_URL is not set and no option provided', () => {
		expect(resolveSiteOrigin()).toBe('http://localhost:4321');
	});

	it('uses options.baseUrl when provided', () => {
		expect(resolveSiteOrigin({ baseUrl: 'https://www.celebra-me.com' })).toBe(
			'https://www.celebra-me.com',
		);
	});

	it('normalizes trailing slash from options.baseUrl', () => {
		expect(resolveSiteOrigin({ baseUrl: 'http://localhost:4321/' })).toBe(
			'http://localhost:4321',
		);
	});

	it('falls back to localhost for invalid options.baseUrl', () => {
		expect(resolveSiteOrigin({ baseUrl: 'not-a-url' })).toBe('http://localhost:4321');
	});

	it('falls back to localhost for unsupported protocol', () => {
		expect(resolveSiteOrigin({ baseUrl: 'ftp://bad.com' })).toBe('http://localhost:4321');
	});

	it('handles localhost URL from options.baseUrl', () => {
		expect(resolveSiteOrigin({ baseUrl: 'http://localhost:4321' })).toBe(
			'http://localhost:4321',
		);
	});

	it('handles multiple trailing slashes from options.baseUrl', () => {
		expect(resolveSiteOrigin({ baseUrl: 'http://localhost:4321///' })).toBe(
			'http://localhost:4321',
		);
	});
});
