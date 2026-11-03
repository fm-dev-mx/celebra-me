import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { invitationCompositionSchema } from '@/lib/invitation/composition-contract';

const CONTENT_PATH = join(
	process.cwd(),
	'src/invitations/demos/demo-cumple-luxury-hacienda/content.json',
);

interface HaciendaDemoContent {
	sectionOrder: string[];
	composition: unknown;
	eventTiming: { localDateTime: string; startsAtUtc: string };
	hero: { variant: string; date: string };
	interludes: Array<{ afterSection: string }>;
}

const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf8')) as HaciendaDemoContent;

/** Render targets in page order: the cover, each section, then the interludes placed after it. */
function renderTargets(): string[] {
	return [
		'hero',
		...content.sectionOrder.flatMap((section) => [
			section === 'personalizedAccess' ? 'personalized-access' : section,
			...content.interludes
				.filter((interlude) => interlude.afterSection === section)
				.map((interlude) => `interlude-after-${interlude.afterSection}`),
		]),
	];
}

describe('demo-cumple-luxury-hacienda composition', () => {
	it('dates the event in the future so the countdown runs', () => {
		const startsAt = new Date(content.eventTiming.startsAtUtc);
		expect(startsAt.getUTCFullYear()).toBeGreaterThanOrEqual(2027);
		expect(content.hero.date.slice(0, 4)).toBe(content.eventTiming.localDateTime.slice(0, 4));
	});

	it('opens with the countdown after the quote and keeps the pass beside the reply', () => {
		const order = content.sectionOrder;
		expect(order.slice(0, 2)).toEqual(['quote', 'countdown']);
		expect(order.indexOf('rsvp') - order.indexOf('personalizedAccess')).toBe(1);
	});

	it('uses the arched night cover', () => {
		expect(content.hero.variant).toBe('night-arch');
	});

	it('joins adjacent targets with portal and arcade arches', () => {
		const composition = invitationCompositionSchema.parse(content.composition);
		const targets = renderTargets();
		const joins = Object.entries(composition.intersections).sort(
			([a], [b]) => targets.indexOf(a) - targets.indexOf(b),
		);

		expect(joins.map(([, join]) => join.family)).toEqual([
			'atmospheric-blend',
			'arch',
			'arch',
			'overlap',
			'arch',
			'arch',
		]);
		for (const [target, join] of joins) {
			expect(targets).toContain(target);
			expect(targets[targets.indexOf(target) - 1]).toBe(join.source);
		}
		expect(joins.at(-1)?.[0]).toBe('thankYou');
	});
});
