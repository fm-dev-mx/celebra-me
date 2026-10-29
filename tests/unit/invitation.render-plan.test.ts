import { adaptEvent } from '@/lib/adapters/event';
import { contentDocumentFromEntry, type EventContentEntry } from '@/lib/content/events';
import { buildInvitationRenderPlan } from '@/lib/invitation/page-data';
import { loadFixture } from '../helpers/json-fixture';

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

describe('buildInvitationRenderPlan', () => {
	it('inserts interludes after their specified sections', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data: loadFixture('src/invitations/demos/demo-xv-enchanted-rose/content.json'),
		} as EventContentEntry;

		const viewModel = adaptEvent(contentDocumentFromEntry(event));
		const plan = buildInvitationRenderPlan(viewModel);

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
			data: loadFixture('tests/fixtures/content/xv-jewelry-box.json'),
		} as EventContentEntry;

		const viewModel = adaptEvent(contentDocumentFromEntry(event));
		const plan = buildInvitationRenderPlan(viewModel);

		const sectionTypes = plan.map((item) =>
			item.type === 'section' ? item.section : item.type,
		);
		const interludeCount = sectionTypes.filter((t) => t === 'interlude').length;

		expect(interludeCount).toBe(4);
		expect(sectionTypes).toEqual([
			'quote',
			'personalized-access',
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
			data: loadFixture('src/invitations/demos/demo-xv-enchanted-rose/content.json'),
		} as EventContentEntry;

		const viewModel = adaptEvent(contentDocumentFromEntry(event));
		const plan = buildInvitationRenderPlan(viewModel);

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
			id: 'event-demos/bautizo/demo-bautizo-angelic-presence',
			data: loadFixture('src/invitations/demos/demo-bautizo-angelic-presence/content.json'),
		} as EventContentEntry;

		const viewModel = adaptEvent(contentDocumentFromEntry(event));
		const plan = buildInvitationRenderPlan(viewModel);

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
			data: loadFixture('src/invitations/demos/demo-xv-enchanted-rose/content.json'),
		} as EventContentEntry;

		const viewModel = adaptEvent(contentDocumentFromEntry(event));
		const plan = buildInvitationRenderPlan(viewModel);

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
		const data = loadFixture('src/invitations/demos/demo-xv-enchanted-rose/content.json') as {
			interludes?: Array<Record<string, unknown>>;
		};
		const firstInterlude = data.interludes?.[0];
		expect(firstInterlude).toBeDefined();
		firstInterlude!.focalPointDesktop = '50% 52%';

		const event = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data,
		} as EventContentEntry;

		const plan = buildInvitationRenderPlan(adaptEvent(contentDocumentFromEntry(event)));
		const interlude = plan.find((item) => item.type === 'interlude');

		expect(interlude).toMatchObject({
			type: 'interlude',
			focalPointDesktop: '50% 52%',
		});
	});

	it('publishes the Celestial pilot intersection treatments in sequential order', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-celestial-blue',
			data: loadFixture('src/invitations/demos/demo-xv-celestial-blue/content.json'),
		} as EventContentEntry;

		const plan = buildInvitationRenderPlan(adaptEvent(contentDocumentFromEntry(event)));
		const nonNeutral = plan.filter((item) => item.intersection.family !== 'neutral');

		expect(nonNeutral).toHaveLength(3);
		expect(nonNeutral).toEqual([
			expect.objectContaining({
				type: 'section',
				section: 'quote',
				intersection: { family: 'atmospheric-blend', source: 'hero' },
			}),
			expect.objectContaining({
				type: 'interlude',
				afterSection: 'family',
				intersection: { family: 'overlap', source: 'family' },
			}),
			expect.objectContaining({
				type: 'section',
				section: 'gifts',
				intersection: { family: 'arch', source: 'gallery' },
			}),
		]);
	});
});

describe('published demo interlude placement', () => {
	it.each(['demo-bautizo-angelic-presence', 'demo-primera-comunion-angelic-presence'])(
		'keeps the first interlude after personalized access in %s',
		(fixture) => {
			const event = {
				id: fixture,
				data: loadFixture(`src/invitations/demos/${fixture}/content.json`),
			} as EventContentEntry;
			const plan = buildInvitationRenderPlan(adaptEvent(contentDocumentFromEntry(event)));
			expect(
				plan
					.slice(0, 3)
					.map((item) => (item.type === 'section' ? item.section : item.type)),
			).toEqual(['quote', 'personalized-access', 'interlude']);
			expect(plan[2]).toEqual(
				expect.objectContaining({
					type: 'interlude',
					afterSection: 'personalizedAccess',
					intersection: {
						family: 'neutral',
						source: 'interlude-after-personalizedAccess',
					},
				}),
			);
		},
	);

	it('places the wedding demo interludes after countdown and family', () => {
		const event = {
			id: 'demo-brisa',
			data: loadFixture('src/invitations/demos/demo-brisa/content.json'),
		} as EventContentEntry;
		const plan = buildInvitationRenderPlan(adaptEvent(contentDocumentFromEntry(event)));
		expect(plan.map((item) => (item.type === 'section' ? item.section : item.type))).toEqual([
			'quote',
			'countdown',
			'interlude',
			'family',
			'interlude',
			'location',
			'gallery',
			'gifts',
			'personalized-access',
			'rsvp',
			'thankYou',
		]);
		expect(
			plan.find((item) => item.type === 'section' && item.section === 'rsvp'),
		).toMatchObject({
			intersection: { family: 'stack', source: 'personalized-access' },
		});
	});
});
