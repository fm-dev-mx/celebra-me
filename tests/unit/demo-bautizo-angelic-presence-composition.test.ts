import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { invitationCompositionSchema } from '@/lib/invitation/composition-contract';

const CONTENT_PATH = join(
	process.cwd(),
	'src/invitations/demos/demo-bautizo-angelic-presence/content.json',
);

interface BautizoDemoContent {
	sectionOrder: string[];
	composition: unknown;
	eventTiming: { localDateTime: string; timeZone: string; startsAtUtc: string };
	hero: { variant: string; date: string };
	interludes: Array<{ afterSection: string }>;
}

const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf8')) as BautizoDemoContent;

/** Render targets in page order: each section, then the interludes placed after it. */
function renderTargets(): string[] {
	return content.sectionOrder.flatMap((section) => [
		section === 'personalizedAccess' ? 'personalized-access' : section,
		...content.interludes
			.filter((interlude) => interlude.afterSection === section)
			.map((interlude) => `interlude-after-${interlude.afterSection}`),
	]);
}

/** Every string value of the document, keys skipped. */
function stringValues(node: unknown): string[] {
	if (typeof node === 'string') return [node];
	if (Array.isArray(node)) return node.flatMap(stringValues);
	if (node && typeof node === 'object') return Object.values(node).flatMap(stringValues);
	return [];
}

/** Every photo slot of the document: values under an `image`, `Image` or `backdropImage` key. */
function photoSlots(node: unknown): string[] {
	if (Array.isArray(node)) return node.flatMap(photoSlots);
	if (!node || typeof node !== 'object') return [];
	return Object.entries(node).flatMap(([key, value]) =>
		typeof value === 'string' ? (/image$/i.test(key) ? [value] : []) : photoSlots(value),
	);
}

describe('demo-bautizo-angelic-presence composition', () => {
	it('dates the christening in the future with a consistent hero date', () => {
		const startsAt = new Date(content.eventTiming.startsAtUtc);
		expect(startsAt.getUTCFullYear()).toBeGreaterThanOrEqual(2027);
		expect(content.hero.date.slice(0, 4)).toBe(content.eventTiming.localDateTime.slice(0, 4));
	});

	it('opens with the verse and countdown and keeps the pass beside the reply', () => {
		const order = content.sectionOrder;
		expect(order.slice(0, 2)).toEqual(['quote', 'countdown']);
		expect(order.indexOf('rsvp') - order.indexOf('personalizedAccess')).toBe(1);
	});

	it('uses the arched portrait hero instead of the flat standard hero', () => {
		expect(content.hero.variant).toBe('framed-portrait');
	});

	it('joins adjacent targets in an overlap, blend and arch cadence', () => {
		const composition = invitationCompositionSchema.parse(content.composition);
		const targets = renderTargets();
		const joins = Object.entries(composition.intersections).sort(
			([a], [b]) => targets.indexOf(a) - targets.indexOf(b),
		);

		expect(joins.map(([, join]) => join.family)).toEqual([
			'overlap',
			'atmospheric-blend',
			'arch',
		]);
		for (const [target, join] of joins) {
			expect(targets).toContain(target);
			expect(targets[targets.indexOf(target) - 1]).toBe(join.source);
		}
	});

	it('spells accents in the copy', () => {
		const prose = stringValues(content).filter(
			(text) => !/^https?:\/\//.test(text) && text !== content.eventTiming.timeZone,
		);
		expect(prose.filter((text) => /Maria |Acompanenos|Celebracion/.test(text))).toEqual([]);
	});

	it('prints every photograph once', () => {
		const slots = photoSlots(content);
		expect(new Set(slots).size).toBe(slots.length);
	});
});
