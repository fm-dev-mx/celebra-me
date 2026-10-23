import { DEMO_INVITATIONS } from '@/invitations/demos';
import { DEMO_SHOWROOM_ITEMS } from '@/data/demo-showroom.data';
import { findDemoByRouteSlug, getDemoRouteSlug } from '@/lib/invitation/demo-routes';
import { isReservedInvitationSlug } from '@/lib/invitation/slug-policy';
import { buildPublicInvitationPath } from '@/utils/invitation-link';
import { resolvePermanentRedirect } from '@/lib/server/security-headers';

describe('catalog short routes', () => {
	it('resolves Brisa to static content and publishes only its canonical short link', () => {
		expect(findDemoByRouteSlug('brisa')).toMatchObject({
			slug: 'demo-brisa',
			eventType: 'boda',
		});
		expect(getDemoRouteSlug('demo-brisa')).toBe('brisa');
		expect(buildPublicInvitationPath('boda', 'demo-brisa')).toBe('/brisa');
		expect(DEMO_SHOWROOM_ITEMS.find((demo) => demo.slug === 'demo-brisa')?.href).toBe('/brisa');
		expect(isReservedInvitationSlug(' Brisa ')).toBe(true);
	});

	it('shares every catalog demo at its short alias and keeps managed links unchanged', () => {
		expect(findDemoByRouteSlug('unknown')).toBeUndefined();
		expect(DEMO_INVITATIONS).toHaveLength(8);
		for (const demo of DEMO_INVITATIONS) {
			expect(demo.routeSlug).toBeTruthy();
			expect(getDemoRouteSlug(demo.slug)).toBe(demo.routeSlug);
			expect(findDemoByRouteSlug(demo.routeSlug as string)?.slug).toBe(demo.slug);
			expect(buildPublicInvitationPath(demo.eventType, demo.slug)).toBe(`/${demo.routeSlug}`);
		}
		expect(buildPublicInvitationPath('boda', 'sample-couple')).toBe('/sample-couple');
	});

	it('keeps demo aliases unique and distinct from internal identities and event types', () => {
		const aliases = DEMO_INVITATIONS.flatMap((demo) =>
			demo.routeSlug ? [demo.routeSlug] : [],
		);
		expect(new Set(aliases).size).toBe(aliases.length);
		for (const alias of aliases) {
			expect(alias).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
			expect(
				DEMO_INVITATIONS.some((demo) => demo.slug === alias || demo.eventType === alias),
			).toBe(false);
		}
	});

	it('permanently redirects the retired wedding URL and preserves its query string', () => {
		const response = resolvePermanentRedirect(
			new URL(
				'https://example.test/boda/demo-boda-jewelry-box-wedding?skipEnvelope=true&utm_source=shared',
			),
		);
		expect(response?.status).toBe(301);
		expect(response?.headers.get('Location')).toBe(
			'/brisa?skipEnvelope=true&utm_source=shared',
		);
		expect(resolvePermanentRedirect(new URL('https://example.test/brisa'))).toBeNull();
	});
});
