import {
	assertScreenshotNavigationIdentity,
	buildScreenshotUrl,
	routeIdentityMatches,
} from '../../../scripts/screenshot/navigation';
import { normalizeRouteIdentity } from '../../../scripts/screenshot/scope';

describe('screenshot navigation identity', () => {
	it('keeps invitation identity query parameters while adding harness parameters', () => {
		const url = buildScreenshotUrl('http://localhost:4322/xv/demo?guest=ana', 'open');
		expect(new URL(url).searchParams.get('guest')).toBe('ana');
		expect(new URL(url).searchParams.get('screenshot')).toBe('1');
		expect(new URL(url).searchParams.get('reveal')).toBe('open');
	});

	it('matches normalized routes independently of screenshot harness parameters', () => {
		expect(
			routeIdentityMatches(
				normalizeRouteIdentity('/xv/demo?guest=ana&screenshot=1&reveal=open'),
				normalizeRouteIdentity('/xv/demo?guest=ana'),
			),
		).toBe(true);
	});

	it('fails when navigation resolves to a different route', async () => {
		const page = {
			url: () => 'http://localhost:4322/xv/other?screenshot=1&reveal=closed',
			evaluate: async () => 'other',
		};
		await expect(
			assertScreenshotNavigationIdentity(page as never, {
				routeIdentity: normalizeRouteIdentity('/xv/demo'),
				slug: 'demo',
			}),
		).rejects.toThrow(/SCREENSHOT_ROUTE_IDENTITY_MISMATCH/);
	});

	it('fails when the rendered stable invitation identifier differs', async () => {
		const page = {
			url: () => 'http://localhost:4322/xv/demo?screenshot=1&reveal=closed',
			evaluate: async () => 'other',
		};
		await expect(
			assertScreenshotNavigationIdentity(page as never, {
				routeIdentity: normalizeRouteIdentity('/xv/demo'),
				slug: 'demo',
			}),
		).rejects.toThrow(/SCREENSHOT_RENDERED_IDENTITY_MISMATCH/);
	});
});
