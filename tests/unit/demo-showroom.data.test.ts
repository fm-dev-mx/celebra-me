import fs from 'node:fs';
import path from 'node:path';

import {
	DEMO_SHOWROOM_EVENTS,
	DEMO_SHOWROOM_ITEMS,
	getDemoShowroomByPublicSlug,
	getFeaturedDemoShowroomItems,
} from '@/data/demo-showroom.data';

const projectRoot = process.cwd();
const demosRoot = path.join(projectRoot, 'src/content/event-demos');

function demoContentExists(slug: string): boolean {
	const stack = [demosRoot];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) continue;

		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const nextPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				stack.push(nextPath);
				continue;
			}
			if (entry.isFile() && entry.name === `${slug}.json`) return true;
		}
	}

	return false;
}

describe('demo showroom public metadata', () => {
	it('exposes the approved public showroom routes and maps cumpleanos to cumple internally', () => {
		expect(DEMO_SHOWROOM_EVENTS.map((event) => event.showroomHref)).toEqual([
			'/demos/xv',
			'/demos/boda',
			'/demos/bautizo',
			'/demos/baby-shower',
			'/demos/cumpleanos',
		]);

		expect(getDemoShowroomByPublicSlug('cumpleanos')).toMatchObject({
			eventType: 'cumple',
			label: 'Cumpleaños y eventos',
			showroomHref: '/demos/cumpleanos',
		});
	});

	it('renders only demos explicitly approved for public showroom exposure', () => {
		const featuredItems = getFeaturedDemoShowroomItems();

		expect(featuredItems).toHaveLength(7);
		expect(featuredItems.every((item) => item.visibility === 'featured')).toBe(true);
		expect(featuredItems.every((item) => item.reviewStatus === 'approved')).toBe(true);
		expect(featuredItems.map((item) => item.slug)).not.toContain('demo-xv-valentina-profile');
		expect(featuredItems.map((item) => item.slug)).not.toContain('demo-xv-xareni-profile');
		expect(featuredItems.map((item) => item.slug)).not.toContain(
			'demo-primera-comunion-illustrated',
		);
	});

	it('keeps every featured showroom slug backed by an existing event demo file', () => {
		getFeaturedDemoShowroomItems().forEach((item) => {
			expect(demoContentExists(item.slug)).toBe(true);
		});
	});

	it('does not feature demos without an approved thumbnail asset key', () => {
		getFeaturedDemoShowroomItems().forEach((item) => {
			expect(item.thumbnail).toMatchObject({
				assetSlug: expect.any(String),
				key: expect.stringMatching(/^(hero|portrait|gallery\d{2})$/),
				alt: expect.any(String),
			});
		});
	});

	it('groups featured demos by internal event type in editorial order', () => {
		expect(getFeaturedDemoShowroomItems('xv').map((item) => item.slug)).toEqual([
			'demo-xv-jewelry-box',
			'demo-xv-celestial-blue',
			'demo-xv-editorial',
		]);
		expect(getFeaturedDemoShowroomItems('cumple').map((item) => item.href)).toEqual([
			'/cumple/demo-cumple-luxury-hacienda',
		]);
	});

	it('keeps raw metadata available for excluded manual-review demos', () => {
		expect(
			DEMO_SHOWROOM_ITEMS.find((item) => item.slug === 'demo-xv-valentina-profile'),
		).toMatchObject({
			visibility: 'hidden',
			reviewStatus: 'needs-review',
		});
	});
});
