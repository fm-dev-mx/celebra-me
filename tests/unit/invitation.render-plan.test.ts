import fs from 'node:fs';
import path from 'node:path';
import { adaptEvent } from '@/lib/adapters/event';
import { buildInvitationRenderPlan } from '@/lib/invitation/page-data';

jest.mock('@/lib/assets/asset-registry', () => {
	const actual = jest.requireActual('@/lib/assets/asset-registry');
	return {
		...actual,
		getEventAsset: jest.fn(() => ({
			src: '/test-asset.webp',
			width: 1,
			height: 1,
			format: 'webp',
		})),
	};
});

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('buildInvitationRenderPlan', () => {
	it('inserts interludes after their specified sections using DEFAULT_SECTION_ORDER', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data: loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { hasGuestContext: true });

		const sectionTypes = plan.map((item) =>
			item.type === 'section' ? item.section : item.type,
		);

		expect(sectionTypes).toContain('interlude');
		expect(sectionTypes.filter((t) => t === 'interlude').length).toBeGreaterThan(0);
		expect(sectionTypes).toContain('personalized-access');
		expect(sectionTypes).toContain('rsvp');
	});

	it('renders all interludes from the event interludes array', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { hasGuestContext: false });

		const sectionTypes = plan.map((item) =>
			item.type === 'section' ? item.section : item.type,
		);
		const interludeCount = sectionTypes.filter((t) => t === 'interlude').length;

		expect(interludeCount).toBe(4);
		expect(sectionTypes).toEqual([
			'quote',
			'family',
			'interlude',
			'gallery',
			'interlude',
			'countdown',
			'interlude',
			'location',
			'itinerary',
			'rsvp',
			'gifts',
			'interlude',
			'thankYou',
		]);
	});

	it('uses explicit sectionOrder when an event defines one', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data: loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { isDemoPreview: true });

		expect(plan.map((item) => (item.type === 'section' ? item.section : item.type))).toEqual([
			'quote',
			'location',
			'countdown',
			'family',
			'interlude',
			'itinerary',
			'gallery',
			'interlude',
			'gifts',
			'personalized-access',
			'rsvp',
			'thankYou',
		]);
	});

	it('uses cinematic interludes in the baptism angelic presence demo', () => {
		const event = {
			id: 'event-demos/bautismo/demo-bautismo-angelic-presence',
			data: loadFixture(
				'src/content/event-demos/bautismo/demo-bautismo-angelic-presence.json',
			),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { hasGuestContext: false });

		const sectionTypes = plan.map((item) =>
			item.type === 'section' ? item.section : item.type,
		);
		const interludeCount = sectionTypes.filter((t) => t === 'interlude').length;
		const requiredSections = [
			'quote',
			'family',
			'gallery',
			'countdown',
			'location',
			'itinerary',
			'rsvp',
			'thankYou',
		];

		expect(interludeCount).toBe(2);
		for (const section of requiredSections) {
			expect(sectionTypes).toContain(section);
		}
	});

	it('includes interludes in the render plan with correct ordering', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data: loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { hasGuestContext: false });

		expect(viewModel.interludes).toBeDefined();
		expect(viewModel.interludes).toHaveLength(2);

		const interludeCount = plan.filter((item) => item.type === 'interlude').length;
		expect(interludeCount).toBe(2);

		const interludes = plan.filter((item) => item.type === 'interlude');
		for (const interlude of interludes) {
			expect(interlude).toHaveProperty('image');
		}
	});

	it('forwards authored interlude desktop focal points into the render plan', () => {
		const data = loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json') as {
			interludes?: Array<Record<string, unknown>>;
		};
		const firstInterlude = data.interludes?.[0];
		expect(firstInterlude).toBeDefined();
		firstInterlude!.focalPointDesktop = '50% 52%';

		const event = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data,
		} as Parameters<typeof adaptEvent>[0];

		const plan = buildInvitationRenderPlan(adaptEvent(event), { hasGuestContext: false });
		const interlude = plan.find((item) => item.type === 'interlude');

		expect(interlude).toMatchObject({
			type: 'interlude',
			focalPointDesktop: '50% 52%',
		});
	});

	it('publishes the five approved Celestial editorial intersection treatments', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-celestial-blue',
			data: loadFixture('src/content/event-demos/xv/demo-xv-celestial-blue.json'),
		} as Parameters<typeof adaptEvent>[0];

		const plan = buildInvitationRenderPlan(adaptEvent(event));
		const nonNeutral = plan.filter((item) => item.intersection.family !== 'neutral');

		expect(nonNeutral).toHaveLength(5);
		expect(nonNeutral).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'interlude',
					afterSection: 'family',
					intersection: { family: 'overlap', source: 'family' },
				}),
				expect.objectContaining({
					type: 'section',
					section: 'gallery',
					intersection: { family: 'atmospheric-blend', source: 'interlude-after-family' },
				}),
				expect.objectContaining({
					type: 'interlude',
					afterSection: 'location',
					intersection: { family: 'arch', source: 'location' },
				}),
				expect.objectContaining({
					type: 'interlude',
					afterSection: 'itinerary',
					intersection: { family: 'overlap', source: 'itinerary' },
				}),
				expect.objectContaining({
					type: 'interlude',
					afterSection: 'rsvp',
					intersection: { family: 'atmospheric-blend', source: 'rsvp' },
				}),
			]),
		);
	});
});
