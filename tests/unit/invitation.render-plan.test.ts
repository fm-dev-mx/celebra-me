import fs from 'node:fs';
import path from 'node:path';
import { adaptEvent } from '@/lib/adapters/event';
import { buildInvitationRenderPlan } from '@/lib/invitation/page-data';

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('buildInvitationRenderPlan', () => {
	it('inserts interludes after their specified sections using DEFAULT_SECTION_ORDER', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { hasGuestContext: true });

		expect(plan.map((item) => (item.type === 'section' ? item.section : item.type))).toEqual([
			'quote',
			'family',
			'interlude',
			'gallery',
			'interlude',
			'countdown',
			'interlude',
			'location',
			'interlude',
			'itinerary',
			'interlude',
			'personalized-access',
			'rsvp',
			'interlude',
			'gifts',
			'thankYou',
		]);
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

	it('includes all 4 interludes in ana-sofia-cota-guillen render plan with correct ordering', () => {
		const event = {
			id: 'events/ana-sofia-cota-guillen',
			data: loadFixture('src/content/events/ana-sofia-cota-guillen.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { hasGuestContext: false });

		expect(viewModel.interludes).toBeDefined();
		expect(viewModel.interludes).toHaveLength(4);

		const sectionTypes = plan.map((item) =>
			item.type === 'section' ? item.section : item.type,
		);
		const interludeCount = sectionTypes.filter((t) => t === 'interlude').length;
		expect(interludeCount).toBe(4);

		const expectedOrder = [
			'quote',
			'family',
			'interlude',
			'gallery',
			'countdown',
			'location',
			'interlude',
			'itinerary',
			'interlude',
			'rsvp',
			'interlude',
			'gifts',
			'thankYou',
		];
		expect(sectionTypes).toEqual(expectedOrder);

		const interludes = plan.filter((item) => item.type === 'interlude');
		expect(interludes[0]).toHaveProperty('image');
		expect(interludes[1]).toHaveProperty('image');
		expect(interludes[2]).toHaveProperty('image');
		expect(interludes[3]).toHaveProperty('image');
	});
});
