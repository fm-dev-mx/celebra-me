import fs from 'node:fs';
import path from 'node:path';
import { adaptEvent } from '@/lib/adapters/event';
import { buildInvitationRenderPlan } from '@/lib/invitation/page-data';

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('buildInvitationRenderPlan', () => {
	it('honors Ximena contentBlocks order and inserts personalized access before RSVP', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { hasGuestContext: true });

		expect(plan.map((item) => (item.type === 'section' ? item.section : item.type))).toEqual([
			'location',
			'interlude',
			'family',
			'interlude',
			'itinerary',
			'interlude',
			'gallery',
			'interlude',
			'countdown',
			'interlude',
			'gifts',
			'personalized-access',
			'rsvp',
			'interlude',
			'thankYou',
		]);
	});

	it('falls back to the legacy section order when contentBlocks are absent', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);
		const plan = buildInvitationRenderPlan(viewModel, { hasGuestContext: false });

		expect(plan.map((item) => (item.type === 'section' ? item.section : item.type))).toEqual([
			'quote',
			'family',
			'gallery',
			'countdown',
			'location',
			'itinerary',
			'rsvp',
			'gifts',
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
});
