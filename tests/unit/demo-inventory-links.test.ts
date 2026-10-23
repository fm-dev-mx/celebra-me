import { getCollection } from 'astro:content';
import { DEMO_INVITATIONS } from '@/invitations/demos';
import { buildDemoHref, loadDemoLinks } from '@/lib/commercial/demo-inventory.server';

jest.mock('astro:content', () => ({
	getCollection: jest.fn(),
}));

describe('commercial demo catalog links', () => {
	it('links every catalog demo to its short alias', async () => {
		(getCollection as jest.Mock).mockResolvedValue(
			DEMO_INVITATIONS.map((demo) => ({
				id: demo.slug,
				data: { eventType: demo.eventType, title: demo.slug },
			})),
		);

		const links = await loadDemoLinks();

		expect(links).toHaveLength(DEMO_INVITATIONS.length);
		for (const demo of DEMO_INVITATIONS) {
			expect(links.find((link) => link.slug === demo.slug)?.href).toBe(`/${demo.routeSlug}`);
		}
		expect(links.find((link) => link.slug === 'demo-brisa')?.href).toBe('/brisa');
		expect(links.some((link) => link.href.includes('/demo-'))).toBe(false);
	});

	it('falls back to the long route only for a demo without an alias', () => {
		expect(buildDemoHref('boda', 'demo-brisa')).toBe('/brisa');
		expect(buildDemoHref('xv', 'demo-xv-unlisted')).toBe('/xv/demo-xv-unlisted');
	});
});
