import fs from 'node:fs';
import path from 'node:path';

import { prepareInvitationPageData } from '@/lib/invitation/page-data';

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('prepareInvitationPageData', () => {
	it('builds a personalized presenter for premium invitation routes', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageData>[0]['eventEntry'];

		const presenter = prepareInvitationPageData({
			eventEntry: event,
			slug: 'ximena-meza-trasvina',
			guestContext: {
				inviteId: 'invite-123',
				eventSlug: 'ximena-meza-trasvina',
				eventType: 'xv',
				eventTitle: 'Ximena Meza Trasvina',
				guest: {
					fullName: 'Mariana Soto',
					maxAllowedAttendees: 4,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestMessage: '',
				},
			},
		});

		expect(presenter.layout.title).toBe('Invitación para Mariana Soto');
		expect(presenter.layout.className).toBe('layout--premium-portrait');
		expect(presenter.wrapper.dataAttributes['data-theme-preset']).toBe('premiere-ivory-gold');
		expect(presenter.wrapper.dataAttributes['data-event-slug']).toBe('ximena-meza-trasvina');
		expect(presenter.wrapper.dataAttributes['data-reveal-state']).toBe('sealed');
		expect(presenter.wrapper.scopedStyles).toContain(
			'[data-event-slug="ximena-meza-trasvina"]',
		);
		expect(presenter.hero.guestName).toBe('Mariana Soto');
		expect(presenter.envelope?.guestName).toBe('Mariana Soto');
		expect(presenter.rsvp?.guestCap).toBe(4);
		expect(presenter.rsvp?.initialGuestData).toEqual({
			fullName: 'Mariana Soto',
			maxAllowedAttendees: 4,
			inviteId: 'invite-123',
		});
		expect(
			presenter.renderPlan.map((item) =>
				item.type === 'section' ? item.section : item.type,
			),
		).toContain('personalized-access');
	});

	it('allows previewTheme overrides by rewriting the premiere variant family in runtime only', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageData>[0]['eventEntry'];

		const presenter = prepareInvitationPageData({
			eventEntry: event,
			slug: 'ximena-meza-trasvina',
			previewTheme: 'premiere-rose-plum',
		});

		expect(presenter.wrapper.dataAttributes['data-theme-preset']).toBe('premiere-rose-plum');
		expect(presenter.header.variant).toBe('premiere-rose-plum');
		expect(presenter.hero.variant).toBe('premiere-rose-plum');
		expect(presenter.footer.variant).toBe('premiere-rose-plum');
		expect(presenter.sections.location?.variant).toBe('premiere-rose-plum');
		expect(
			presenter.renderPlan.find((item) => item.type === 'interlude' && 'variant' in item)
				?.variant,
		).toBe('premiere-rose-plum');
	});

	it('ignores invalid previewTheme overrides', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageData>[0]['eventEntry'];

		const presenter = prepareInvitationPageData({
			eventEntry: event,
			slug: 'ximena-meza-trasvina',
			previewTheme: 'broken-preview',
		});

		expect(presenter.wrapper.dataAttributes['data-theme-preset']).toBe('premiere-ivory-gold');
	});

	it('builds the default presenter for demo events without guest context', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv.json');
		const event = {
			id: 'event-demos/xv/demo-xv',
			data: fixture,
		} as Parameters<typeof prepareInvitationPageData>[0]['eventEntry'];

		const presenter = prepareInvitationPageData({
			eventEntry: event,
			slug: 'demo-xv',
		});

		expect(presenter.layout.title).toBe(fixture.title);
		expect(presenter.layout.description).toBe(fixture.description);
		expect(presenter.personalizedAccess).toBeUndefined();
		expect(presenter.rsvp?.initialGuestData).toBeUndefined();
		expect(presenter.header.links).toEqual(fixture.navigation);
		expect(
			presenter.renderPlan.map((item) =>
				item.type === 'section' ? item.section : item.type,
			),
		).toEqual([
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
});
