import fs from 'node:fs';
import path from 'node:path';

import {
	DEMO_SHOWROOM_EVENTS,
	DEMO_SHOWROOM_ITEMS,
	getDemoShowroomByPublicSlug,
	getFeaturedDemoShowroomItems,
} from '@/data/demo-showroom.data';
import {
	buildGeneralMessage,
	getGeneralPromoCode,
	getStartingPrice,
} from '@/data/promo-campaign.data';

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

		expect(featuredItems).toHaveLength(6);
		expect(featuredItems.every((item) => item.visibility === 'featured')).toBe(true);
		expect(featuredItems.every((item) => item.reviewStatus === 'approved')).toBe(true);
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
			'demo-xv-celestial-blue',
			'demo-xv-enchanted-rose',
			'demo-xv-editorial',
		]);
		expect(getFeaturedDemoShowroomItems('cumple').map((item) => item.href)).toEqual([
			'/cumple/demo-cumple-luxury-hacienda',
		]);
	});

	it('excludes a hidden or unreviewed item from the public showroom', () => {
		const hidden = DEMO_SHOWROOM_ITEMS.filter(
			(item) => item.visibility !== 'featured' || item.reviewStatus !== 'approved',
		);
		const featuredSlugs = getFeaturedDemoShowroomItems().map((item) => item.slug);

		for (const item of hidden) expect(featuredSlugs).not.toContain(item.slug);
	});
});

describe('showroom interaction model', () => {
	const xvItems = getFeaturedDemoShowroomItems('xv');

	it('XV: initial featured demo is demo-xv-celestial-blue (first by canonical order)', () => {
		expect(xvItems[0].slug).toBe('demo-xv-celestial-blue');
	});

	it('XV: featured list contains exactly 3 approved demos in canonical order', () => {
		expect(xvItems.map((i) => i.slug)).toEqual([
			'demo-xv-celestial-blue',
			'demo-xv-enchanted-rose',
			'demo-xv-editorial',
		]);
	});

	it('XV: selector derived from active demo excludes the active demo', () => {
		const activeSlug = 'demo-xv-celestial-blue';
		const selectorItems = xvItems.filter((i) => i.slug !== activeSlug);
		expect(selectorItems.map((i) => i.slug)).toEqual([
			'demo-xv-enchanted-rose',
			'demo-xv-editorial',
		]);
		expect(selectorItems).toHaveLength(2);
	});

	it('XV: when a different demo is active, its entry is removed and the previous active returns', () => {
		const activeSlug = 'demo-xv-enchanted-rose';
		const selectorItems = xvItems.filter((i) => i.slug !== activeSlug);
		expect(selectorItems.map((i) => i.slug)).toEqual([
			'demo-xv-celestial-blue',
			'demo-xv-editorial',
		]);
		expect(selectorItems).toHaveLength(2);
	});

	it('XV: users can return to demo-xv-celestial-blue when another demo is active', () => {
		const activeSlug = 'demo-xv-editorial';
		const selectorItems = xvItems.filter((i) => i.slug !== activeSlug);
		expect(selectorItems.some((i) => i.slug === 'demo-xv-celestial-blue')).toBe(true);
	});

	it('single-demo event types expose exactly one item (no selector)', () => {
		const bodaItems = getFeaturedDemoShowroomItems('boda');
		expect(bodaItems).toHaveLength(1);
	});

	it('no public demo descriptor uses standalone color names (Azul, Rosa, etc.)', () => {
		const colorPattern = /\b(Azul|Rosa|Rojo|Verde|Morado|Violeta|Dorado|Plateado)\b/i;
		getFeaturedDemoShowroomItems().forEach((item) => {
			expect(item.description).not.toMatch(colorPattern);
			item.styleTags.forEach((tag) => {
				expect(tag).not.toMatch(colorPattern);
			});
		});
	});

	it('multi-demo customization copy is accurate', () => {
		expect(xvItems.length).toBeGreaterThan(1);
	});

	it('single-demo customization copy is accurate', () => {
		expect(getFeaturedDemoShowroomItems('boda').length).toBe(1);
	});

	it('quotes every event with the current promo and no retired package', () => {
		for (const event of DEMO_SHOWROOM_EVENTS) {
			const quote = event.homeSelector.quoteCta;
			expect(quote.message).toBe(buildGeneralMessage());
			expect(quote.promoCode).toBe(getGeneralPromoCode());
			expect(quote.trackValue).toBe(getStartingPrice());
			expect(quote.packageName).toBeUndefined();
			expect(quote.packageInterest).toBeUndefined();
		}
	});
});
