import fs from 'node:fs';
import path from 'node:path';

import {
	type InvitationRenderPlanItem,
	buildPageContextFromViewModel,
	prepareInvitationPageContext,
} from '@/lib/invitation/page-data';
import { isEventAssetKey } from '@/lib/assets/asset-registry';

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
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const fixture = event.data;

		const context = prepareInvitationPageContext({
			eventEntry: event,
			slug: 'demo-xv-jewelry-box',
			guestContext: {
				inviteId: 'invite-123',
				eventSlug: 'demo-xv-jewelry-box',
				eventType: 'xv',
				eventTitle: 'XV Años - Demo',
				guest: {
					fullName: 'Mariana Soto',
					maxAllowedAttendees: 4,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: '',
					hideCelebraMeBranding: false,
				},
			},
		});

		expect(context.layout.title).toBe('Invitación para Mariana Soto');
		expect(context.wrapper.dataAttributes['data-event-slug']).toBe('demo-xv-jewelry-box');
		expect(context.wrapper.dataAttributes['data-reveal-state']).toBe('sealed');
		expect(context.wrapper.scopedStyles).toContain('[data-event-slug="demo-xv-jewelry-box"]');

		expect(context.guestName).toBe('Mariana Soto');
		expect(context.envelope?.card).toEqual({
			documentLabel: 'Invitación',
			name: fixture.hero.name,
			details: '25 abr 2026 • Monterrey',
			guestName: 'Mariana Soto',
			sealIcon: 'heart',
			sealInitials: 'L·G',
			venueName: 'Quinta Las Flores',
		});

		expect(describeRenderPlan(context.renderPlan)).toContain('personalized-access');
	});

	it('allows previewTheme overrides by rewriting the delivered theme preset in runtime only', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
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
			details: '25 abr 2026 • Monterrey',
			guestName: undefined,
			sealIcon: 'heart',
			sealInitials: 'L·G',
			venueName: 'Quinta Las Flores',
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
			'personalized-access',
			'rsvp',
			'gifts',
			'interlude',
			'thankYou',
		]);
		expect(context.viewModel.sectionOrder).toBeUndefined();
	});

	it('builds explicit section order for the enchanted rose demo', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json');
		const event = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data: fixture,
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const context = prepareInvitationPageContext({
			eventEntry: event,
			slug: 'demo-xv-enchanted-rose',
		});

		expect(context.viewModel.sectionOrder).toBeDefined();
		expect(describeRenderPlan(context.renderPlan)).toEqual([
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

	it('enchanted rose hero and interlude focal points', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json');
		const event = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data: fixture,
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const context = prepareInvitationPageContext({
			eventEntry: event,
			slug: 'demo-xv-enchanted-rose',
		});

		expect(context.viewModel.hero.focalPointMobile).toBe('50% 32%');
		expect(context.viewModel.hero.focalPointTablet).toBe('50% 24%');
		expect(context.viewModel.hero.focalPointDesktop).toBe('50% 21%');
		expect(context.viewModel.interludes?.[1]).toMatchObject({
			focalPoint: '54% 22%',
		});
	});

	it('enchanted rose gallery data integrity', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json');

		expect(isEventAssetKey(fixture.location.ceremony.image)).toBe(true);
		expect(isEventAssetKey(fixture.location.reception.image)).toBe(true);
		expect(fixture.gallery.items.map((item: { image: string }) => item.image)).not.toEqual(
			expect.arrayContaining(['gallery08', 'gallery09']),
		);
		expect(fixture.gallery.items.map((item: { image: string }) => item.image)).toContain(
			'interlude01',
		);
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

const baseViewModel = {
	isDemo: false,
	theme: { preset: 'jewelry-box' as const, themeClass: 'theme-preset--jewelry-box' },
	hero: {
		name: 'Test',
		label: 'Event',
		date: '2027-01-01',
		backgroundImage: { src: '/img.jpg' },
	},
	envelope: { enabled: false },
	brandingVisibility: {
		showFooterBranding: true,
		showContactCta: true,
		showThankYouBranding: true,
	},
	interludes: [],
};

describe('buildPageContextFromViewModel', () => {
	it('builds correct SEO/meta data for published content', () => {
		const viewModel = {
			...baseViewModel,
			id: 'my-invitation',
			title: 'Published Event',
			description: 'A published invitation',
			hero: { ...baseViewModel.hero, backgroundImage: { src: '/og.jpg' } },
			sections: {
				rsvp: {
					title: 'Confirma',
					accessMode: 'hybrid' as const,
					eventSlug: 'my-invitation',
					eventType: 'xv',
				},
			},
			sharing: { whatsappTemplate: 'Hola', ogImage: { src: '/og.jpg', alt: 'OG' } },
		} as any;

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'my-invitation',
			eventType: 'xv',
		});

		expect(context.layout.title).toBe('Published Event');
		expect(context.layout.image).toBe('/og.jpg');
		expect(context.layout.className).toBe('layout--jewelry-box');
		expect(context.isDemoPreview).toBe(false);
	});

	it('builds renderPlan from sectionOrder when provided', () => {
		const viewModel = {
			...baseViewModel,
			id: 'ordered-invitation',
			isDemo: true,
			title: 'Ordered',
			sections: { quote: { text: 'A quote' }, rsvp: { title: 'RSVP' } },
			sectionOrder: ['quote', 'rsvp'],
		} as any;

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'ordered-invitation',
			eventType: 'xv',
		});

		expect(describeRenderPlan(context.renderPlan)).toEqual(['quote', 'rsvp']);
	});

	it('includes expected sections when sectionOrder is missing', () => {
		const viewModel = {
			...baseViewModel,
			id: 'default-invitation',
			title: 'Default',
			sections: { location: { ceremony: { venueName: 'Church' } }, rsvp: { title: 'RSVP' } },
		} as any;

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'default-invitation',
			eventType: 'boda',
		});

		const plan = describeRenderPlan(context.renderPlan);
		expect(plan).toContain('location');
		expect(plan).toContain('rsvp');
	});

	it('resolves footerVariant from sectionStyles when not preview', () => {
		const viewModel = {
			...baseViewModel,
			id: 'footer-test',
			title: 'Footer Test',
			theme: { preset: 'editorial' as const, themeClass: 'theme-preset--editorial' },
			sections: {},
		} as any;

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'footer-test',
			eventType: 'xv',
			sectionStyles: { footer: { variant: 'enchanted-rose' as const } },
		});

		expect(context.footerVariant).toBe('enchanted-rose');
	});

	it('sets data-reveal-state to sealed when envelope is enabled (non-embedded)', () => {
		const viewModel = {
			...baseViewModel,
			id: 'reveal-sealed',
			envelope: { enabled: true },
			sections: {},
		} as any;

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'reveal-sealed',
			eventType: 'xv',
		});

		expect(context.wrapper.dataAttributes['data-reveal-state']).toBe('sealed');
		expect(context.wrapper.showEnvelope).toBe(true);
	});

	it('embedded preview override merges to exactly one data-reveal-state', () => {
		const sealedAttrs: Record<string, string> = {
			'data-reveal-state': 'sealed',
			'data-theme-preset': 'test',
			'data-event-slug': 'test-event',
			'data-is-demo': 'false',
		};

		const merged: Record<string, string> = { ...sealedAttrs, 'data-reveal-state': 'revealed' };

		expect(merged['data-reveal-state']).toBe('revealed');
		expect(Object.keys(merged).filter((k) => k === 'data-reveal-state')).toHaveLength(1);
		expect(merged['data-theme-preset']).toBe('test');
	});
});
