import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { invitationCompositionSchema } from '@/lib/invitation/composition-contract';

const CONTENT_PATH = join(process.cwd(), 'src/invitations/demos/demo-xv-editorial/content.json');

interface EditorialDemoContent {
	sectionOrder: string[];
	composition: unknown;
	eventTiming: { localDateTime: string; timeZone: string; startsAtUtc: string };
	hero: { variant: string; date: string };
	interludes: Array<{ afterSection: string }>;
	envelope: { coverIssue?: string };
}

const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf8')) as EditorialDemoContent;

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

describe('demo-xv-editorial composition', () => {
	it('dates the event at least a year ahead of the showroom audit', () => {
		const startsAt = new Date(content.eventTiming.startsAtUtc);
		expect(startsAt.getUTCFullYear()).toBeGreaterThanOrEqual(2027);
		expect(content.hero.date.slice(0, 4)).toBe(content.eventTiming.localDateTime.slice(0, 4));
		expect(content.envelope.coverIssue).toBe(content.eventTiming.localDateTime.slice(0, 4));
	});

	it('opens with the countdown after the quote and keeps the pass beside the reply', () => {
		const order = content.sectionOrder;
		expect(order.slice(0, 2)).toEqual(['quote', 'countdown']);
		expect(order.indexOf('rsvp') - order.indexOf('personalizedAccess')).toBe(1);
	});

	it('uses an arched cover instead of the flat standard hero', () => {
		expect(content.hero.variant).not.toBe('standard');
	});

	it('joins sections in a bridge, bridge, climax cadence between adjacent targets', () => {
		const composition = invitationCompositionSchema.parse(content.composition);
		const targets = renderTargets();
		const joins = Object.entries(composition.intersections).sort(
			([a], [b]) => targets.indexOf(a) - targets.indexOf(b),
		);

		expect(joins.map(([, join]) => join.family)).toEqual(['overlap', 'overlap', 'arch']);
		for (const [target, join] of joins) {
			expect(targets).toContain(target);
			expect(targets[targets.indexOf(target) - 1]).toBe(join.source);
		}
		expect(joins.at(-1)?.[0]).toBe('thankYou');
	});

	it('spells Celebración, Lumière and México with their accents', () => {
		// URLs and the IANA time zone are identifiers, not copy.
		const prose = stringValues(content).filter(
			(text) => !/^https?:\/\//.test(text) && text !== content.eventTiming.timeZone,
		);
		expect(prose.filter((text) => /Celebracion|Lumiere|Mexico/.test(text))).toEqual([]);
	});
});
