import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	PRIVATE_CACHE_CONTROL,
	isPrivateNoStorePath,
	withPrivateNoStore,
} from '@/lib/http/private-cache-path';
import { jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';

describe('private cache contract', () => {
	it('marks identity-dependent dashboard, auth, and captura paths', () => {
		expect(isPrivateNoStorePath('/dashboard')).toBe(true);
		expect(isPrivateNoStorePath('/dashboard/invitados')).toBe(true);
		expect(isPrivateNoStorePath('/api/dashboard/guests')).toBe(true);
		expect(isPrivateNoStorePath('/api/auth/session')).toBe(true);
		expect(isPrivateNoStorePath('/api/auth/login-host')).toBe(true);
		expect(isPrivateNoStorePath('/captura')).toBe(true);
		expect(isPrivateNoStorePath('/captura/token-1')).toBe(true);
		expect(isPrivateNoStorePath('/api/captura/token-1')).toBe(true);
	});

	it('leaves public HTML and public JSON outside the private contract', () => {
		expect(isPrivateNoStorePath('/login')).toBe(false);
		expect(isPrivateNoStorePath('/login/')).toBe(false);
		expect(isPrivateNoStorePath('/api/health')).toBe(false);
		expect(isPrivateNoStorePath('/xv/romina-rios-chaparro')).toBe(false);
		expect(isPrivateNoStorePath('/i/abc123')).toBe(false);
		expect(isPrivateNoStorePath('/privacidad')).toBe(false);
	});

	it('does not make generic JSON responses no-store', () => {
		expect(jsonResponse({ status: 'healthy' }).headers.get('Cache-Control')).toBeNull();
	});

	it('applies the shared private Cache-Control value', () => {
		expect(PRIVATE_CACHE_CONTROL).toBe('no-store, private');
		const response = withPrivateCache(jsonResponse({ ok: true }));
		expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	});

	it('rewraps immutable upstream responses without losing streamed preview bytes', async () => {
		const upstream = new Response('preview-bytes', {
			headers: { 'Content-Type': 'image/jpeg' },
		});
		jest.spyOn(upstream.headers, 'set').mockImplementation(() => {
			throw new TypeError('immutable');
		});

		const response = withPrivateNoStore(upstream);

		expect(response.headers.get('Cache-Control')).toBe(PRIVATE_CACHE_CONTROL);
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(await response.text()).toBe('preview-bytes');
	});
});

describe('anonymous invitation HTML cache contract', () => {
	it('keeps origin-revalidate headers and does not add a positive shared TTL', () => {
		const source = readFileSync(
			join(process.cwd(), 'src/pages/[eventType]/[slug].astro'),
			'utf8',
		);
		expect(source).toContain("'public, max-age=0, s-maxage=0, must-revalidate'");
		expect(source).not.toContain('stale-while-revalidate');
		expect(source).not.toMatch(/s-maxage=[1-9]/);
	});

	it('forces private no-store when an invite query is present', () => {
		const source = readFileSync(
			join(process.cwd(), 'src/pages/[eventType]/[slug].astro'),
			'utf8',
		);
		expect(source).toContain('hasInviteParam');
		expect(source).toMatch(/!hasInviteParam[\s\S]{0,200}'no-store, private'/);
	});
});
