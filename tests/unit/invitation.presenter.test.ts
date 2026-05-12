import fs from 'node:fs';
import path from 'node:path';

import {
	type InvitationRenderPlanItem,
	prepareInvitationPageContext,
} from '@/lib/invitation/page-data';

function describeRenderPlan(items: InvitationRenderPlanItem[]): string[] {
	return items.map((item) => (item.type === 'section' ? item.section : item.type));
}

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('prepareInvitationPageContext', () => {
	it('builds a personalized context for premium invitation routes', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const context = prepareInvitationPageContext({
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
					guestComment: '',
				},
			},
		});

		expect(context.layout.title).toBe('Invitación para Mariana Soto');
		expect(context.layout.className).toBe('layout--premiere-floral');
		expect(context.wrapper.dataAttributes['data-theme-preset']).toBe('premiere-floral');
		expect(context.wrapper.dataAttributes['data-event-slug']).toBe('ximena-meza-trasvina');
		expect(context.wrapper.dataAttributes['data-reveal-state']).toBe('sealed');
		expect(context.wrapper.scopedStyles).toContain('[data-event-slug="ximena-meza-trasvina"]');

		expect(context.guestName).toBe('Mariana Soto');
		expect(context.heroTime).toBe('8:00 PM');
		expect(context.envelope?.guestName).toBe('Mariana Soto');
		expect(context.envelope?.card).toEqual({
			documentLabel: 'Invitación',
			name: event.data.hero.name,
			details: '11 de abril de 2026 • Los Mochis',
			guestName: 'Mariana Soto',
			sealIcon: 'flower',
		});

		expect(describeRenderPlan(context.renderPlan)).toContain('personalized-access');
	});

	it('allows previewTheme overrides by rewriting the delivered theme preset in runtime only', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const context = prepareInvitationPageContext({
			eventEntry: event,
			slug: 'ximena-meza-trasvina',
			previewTheme: 'editorial',
		});

		expect(context.wrapper.dataAttributes['data-theme-preset']).toBe('editorial');
		expect(context.viewModel.theme.preset).toBe('editorial');
		expect(context.viewModel.hero.variant).toBe('editorial');
		expect(context.envelope?.variant).toBe('editorial');
		expect(context.footerVariant).toBe('editorial');
		expect(context.viewModel.sections.location?.variant).toBe('editorial');
		expect(context.renderPlan).toContainEqual(
			expect.objectContaining({
				type: 'interlude',
				variant: 'editorial',
			}),
		);
	});

	it('builds the default context for demo events without guest context', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: fixture,
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const context = prepareInvitationPageContext({
			eventEntry: event,
			slug: 'demo-xv-jewelry-box',
		});

		expect(context.layout.title).toBe(fixture.title);
		expect(context.layout.description).toBe(fixture.description);
		expect(context.guestContext).toBeUndefined();
		expect(context.envelope?.isDemo).toBe(true);
		expect(context.envelope).not.toHaveProperty('city');
		expect(context.envelope).not.toHaveProperty('date');
		expect(context.envelope?.card).toEqual({
			documentLabel: 'Invitación',
			name: fixture.hero.name,
			details: '25 de abril de 2026 • Monterrey',
			guestName: undefined,
			sealIcon: 'heart',
		});

		expect(describeRenderPlan(context.renderPlan)).toEqual([
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

	it('preserves hybrid RSVP access mode for landing pages without guest context', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				rsvp: {
					...fixture.rsvp,
					accessMode: 'hybrid',
				},
			},
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const context = prepareInvitationPageContext({
			eventEntry: event,
			slug: 'demo-xv-jewelry-box',
		});

		expect(context.guestContext).toBeUndefined();
		expect(context.viewModel.sections.rsvp).toMatchObject({
			accessMode: 'hybrid',
			eventType: 'xv',
			eventSlug: 'demo-xv-jewelry-box',
		});
	});

	it('passes the location indications heading through to the view model', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				location: {
					...fixture.location,
					indicationsHeading: 'Indicaciones',
				},
			},
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const context = prepareInvitationPageContext({
			eventEntry: event,
			slug: 'demo-xv-jewelry-box',
		});

		expect(context.viewModel.sections.location?.indicationsHeading).toBe('Indicaciones');
	});
});
