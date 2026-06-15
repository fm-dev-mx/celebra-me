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
			label: 'Invitación',
			name: fixture.hero.name,
			date: '25 · ABR · 2026',
			guestName: 'Mariana Soto',
			tagline: undefined,
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
			label: 'Invitación',
			name: fixture.hero.name,
			date: '25 · ABR · 2026',
			guestName: undefined,
			tagline: undefined,
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
		backgroundImage: { src: '/img.jpg', alt: 'Test image' },
		variant: 'jewelry-box' as const,
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

	it('derives heroTime and heroVenueName from venues[] array before legacy ceremony/reception', () => {
		const viewModel = {
			...baseViewModel,
			id: 'venues-hero-test',
			title: 'Venues Hero',
			sections: {
				location: {
					venues: [
						{
							time: '2:00 PM',
							venueName: 'Casa de mi familia',
						},
					],
					ceremony: { time: '1:00 PM', venueName: 'Old Church' },
				},
			},
		} as any;

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'venues-hero-test',
			eventType: 'baby-shower',
		});

		expect(context.heroTime).toBe('2:00 PM');
		expect(context.heroVenueName).toBe('Casa de mi familia');
	});

	it('falls back to legacy ceremony/reception when venues[] is absent', () => {
		const viewModel = {
			...baseViewModel,
			id: 'legacy-hero-test',
			title: 'Legacy Hero',
			sections: {
				location: {
					reception: { time: '6:00 PM', venueName: 'Salón Real' },
				},
			},
		} as any;

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'legacy-hero-test',
			eventType: 'xv',
		});

		expect(context.heroTime).toBe('6:00 PM');
		expect(context.heroVenueName).toBe('Salón Real');
	});

	it('sets heroTime and heroVenueName to undefined when no location data exists', () => {
		const viewModel = {
			...baseViewModel,
			id: 'no-location-test',
			title: 'No Location',
			sections: {},
		} as any;

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'no-location-test',
			eventType: 'xv',
		});

		expect(context.heroTime).toBeUndefined();
		expect(context.heroVenueName).toBeUndefined();
	});

	it('redacts after-rsvp location details before the guest is confirmed', () => {
		const viewModel = {
			...baseViewModel,
			id: 'luna-y-estrella',
			title: 'Primera Comunión de Luna y Estrella',
			envelope: {
				enabled: true,
				data: {
					sealStyle: 'wax',
					microcopy: 'Primera Comunión',
					teaserDetails: '1 ago 2026 • Salón García',
					card: {
						label: 'Primera Comunión',
						name: 'Luna y Estrella',
						date: '1 · AGO · 2026',
					},
					colors: {},
				},
			},
			sections: {
				location: {
					visibility: 'after-rsvp',
					introHeading: 'Ubicación',
					ceremony: {
						venueEvent: 'Celebración',
						venueName: 'Salón García',
						address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
						date: '2026-08-01',
						time: '14:00',
						mapUrl: 'https://maps.example.com/salon-garcia',
						googleMapsUrl: 'https://google.example.com/salon-garcia',
						wazeUrl: 'https://waze.example.com/salon-garcia',
						coordinates: { lat: 19.42, lng: -102.06 },
						image: { src: '/protected-map.webp', alt: 'Mapa protegido' },
					},
				},
			},
		} as Parameters<typeof buildPageContextFromViewModel>[0]['viewModel'];

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'luna-y-estrella',
			eventType: 'primera-comunion',
		});

		expect(context.heroVenueName).toBeUndefined();
		expect(context.envelope?.teaserDetails).toBe('1 ago 2026');
		expect(context.viewModel.sections.location).toMatchObject({
			visibility: 'after-rsvp',
			isLocked: true,
			introHeading: 'Ubicación',
			lockedTitle: 'Ubicación reservada',
		});
		expect(context.viewModel.sections.location?.ceremony).toBeUndefined();
		expect(JSON.stringify(context.viewModel.sections.location)).not.toContain('Salón García');
		expect(JSON.stringify(context.viewModel.sections.location)).not.toContain(
			'Victoriano Huerta',
		);
		expect(JSON.stringify(context.viewModel.sections.location)).not.toContain('maps.example');
		expect(JSON.stringify(context.viewModel.sections.location)).not.toContain('-102.06');
	});

	it('keeps after-rsvp location details when the persisted guest status is confirmed', () => {
		const viewModel = {
			...baseViewModel,
			id: 'luna-y-estrella',
			title: 'Primera Comunión de Luna y Estrella',
			sections: {
				location: {
					visibility: 'after-rsvp',
					introHeading: 'Ubicación',
					ceremony: {
						venueEvent: 'Celebración',
						venueName: 'Salón García',
						address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
						date: '2026-08-01',
						time: '14:00',
					},
				},
			},
		} as Parameters<typeof buildPageContextFromViewModel>[0]['viewModel'];

		const context = buildPageContextFromViewModel({
			viewModel,
			slug: 'luna-y-estrella',
			eventType: 'primera-comunion',
			guestContext: {
				inviteId: 'invite-confirmed',
				eventSlug: 'luna-y-estrella',
				eventType: 'primera-comunion',
				eventTitle: 'Primera Comunión de Luna y Estrella',
				guest: {
					fullName: 'Familia invitada',
					maxAllowedAttendees: 4,
					attendanceStatus: 'confirmed',
					attendeeCount: 2,
					guestComment: '',
					hideCelebraMeBranding: false,
				},
			},
		});

		expect(context.heroVenueName).toBe('Salón García');
		expect(context.viewModel.sections.location?.isLocked).toBeUndefined();
		expect(context.viewModel.sections.location?.ceremony?.address).toBe(
			'Victoriano Huerta 51, Col. San Francisco, Uruapan',
		);
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
