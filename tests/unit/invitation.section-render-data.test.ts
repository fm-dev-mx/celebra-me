import fs from 'node:fs';
import path from 'node:path';
import {
	buildInvitationSectionRenderDescriptors,
	type InvitationSectionRenderDescriptor,
	DEMO_GUEST_NAME,
} from '@/lib/invitation/section-render-data';
import {
	buildPageContextFromViewModel,
	prepareInvitationPageContext,
} from '@/lib/invitation/page-data';

type RsvpDescriptor = Extract<InvitationSectionRenderDescriptor, { component: 'rsvp' }>;
type PersonalizedAccessDescriptor = Extract<
	InvitationSectionRenderDescriptor,
	{ component: 'personalized-access' }
>;

function isRsvpDescriptor(
	descriptor: InvitationSectionRenderDescriptor,
): descriptor is RsvpDescriptor {
	return descriptor.component === 'rsvp';
}

function isPersonalizedAccessDescriptor(
	descriptor: InvitationSectionRenderDescriptor,
): descriptor is PersonalizedAccessDescriptor {
	return descriptor.component === 'personalized-access';
}

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function setupDemoPageContext(fixtureSlug = 'demo-xv-editorial') {
	const eventEntry = {
		id: `event-demos/xv/${fixtureSlug}`,
		data: loadFixture(`src/content/event-demos/xv/${fixtureSlug}.json`),
	} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

	return prepareInvitationPageContext({
		eventEntry,
		slug: fixtureSlug,
		guestContext: null,
	});
}

describe('buildInvitationSectionRenderDescriptors', () => {
	it('derives the next anchorable section for location navigation from the render plan', () => {
		const eventEntry = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'demo-xv-jewelry-box',
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const locationDescriptor = descriptors.find(
			(descriptor) => descriptor.component === 'location',
		);

		expect(locationDescriptor).toMatchObject({
			component: 'location',
			props: {
				nextSectionLink: {
					href: '#itinerary',
					label: 'Itinerario',
				},
			},
		});
	});

	it('preserves section variants already resolved by the adapter', () => {
		const eventEntry = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
				theme: {
					preset: 'jewelry-box',
				},
				sectionStyles: {
					quote: { variant: 'editorial' },
					countdown: { variant: 'editorial' },
					location: { variant: 'editorial', showFlourishes: false },
					family: { variant: 'editorial' },
					gallery: { variant: 'editorial' },
					itinerary: { variant: 'editorial' },
					thankYou: { variant: 'editorial' },
				},
			},
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'demo-xv-jewelry-box',
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		for (const component of [
			'quote',
			'countdown',
			'location',
			'family',
			'gallery',
			'itinerary',
			'thankYou',
		] as const) {
			expect(
				descriptors.find((descriptor) => descriptor.component === component),
			).toMatchObject({
				props: {
					variant: 'editorial',
				},
			});
		}
	});

	it('builds personalized RSVP descriptors next to quote', () => {
		const eventEntry = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'demo-xv-jewelry-box',
			guestContext: {
				inviteId: 'invite-zero',
				eventSlug: 'demo-xv-jewelry-box',
				eventType: 'xv',
				eventTitle: 'Demo XV',
				guest: {
					fullName: 'Invitada Test',
					maxAllowedAttendees: 0,
					attendanceStatus: 'pending',
					attendeeCount: 0,
					guestComment: '',
					hideCelebraMeBranding: false,
				},
			},
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const descriptorComponents = descriptors.map((descriptor) => descriptor.component);
		const quoteIndex = descriptorComponents.indexOf('quote');
		const personalizedAccessIndex = descriptorComponents.indexOf('personalized-access');
		const rsvpDescriptor = descriptors.find(isRsvpDescriptor);

		expect(personalizedAccessIndex).toBe(quoteIndex + 1);
		expect(rsvpDescriptor?.props.eventType).toBe('xv');
		expect(rsvpDescriptor?.props.eventSlug).toBe('demo-xv-jewelry-box');
	});

	it('passes Luna y Estrella confirmed RSVP reveal props to the RSVP island descriptor', () => {
		const protectedLocation = {
			visibility: 'after-rsvp' as const,
			introHeading: 'Ubicación',
			ceremony: {
				venueEvent: 'Celebración',
				venueName: 'Salón García',
				address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
				date: '2026-08-01',
				time: '14:00',
				googleMapsUrl: 'https://maps.example.com/salon-garcia',
			},
		};
		const pageContext = buildPageContextFromViewModel({
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
					guestComment: 'Con gusto asistimos',
					hideCelebraMeBranding: false,
				},
			},
			viewModel: {
				id: 'luna-y-estrella',
				isDemo: false,
				title: 'Primera Comunión de Luna y Estrella',
				theme: {
					preset: 'angelic-presence',
					themeClass: 'theme-preset--angelic-presence',
				},
				hero: {
					name: 'Luna Yamileth',
					label: 'Primera Comunión',
					date: '2026-08-01',
					backgroundImage: { src: '/hero.jpg', alt: 'Portada' },
				},
				envelope: { enabled: false },
				brandingVisibility: {
					showFooterBranding: true,
					showContactCta: true,
					showThankYouBranding: true,
				},
				sectionOrder: ['rsvp'],
				sections: {
					location: protectedLocation,
					rsvp: {
						title: 'Confirma tu asistencia',
						accessMode: 'hybrid',
						eventSlug: 'luna-y-estrella',
						eventType: 'primera-comunion',
						confirmationMessage: 'Gracias por confirmar.',
					},
				},
				navigation: [{ label: 'Confirmar', href: '#rsvp' }],
			} as any,
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const rsvpDescriptor = descriptors.find(isRsvpDescriptor);

		expect(rsvpDescriptor?.props.initialGuestData).toMatchObject({
			inviteId: 'invite-confirmed',
			attendanceStatus: 'confirmed',
			attendeeCount: 2,
			guestComment: 'Con gusto asistimos',
		});
		expect(rsvpDescriptor?.props.allowResponseEditing).toBeUndefined();
		expect(rsvpDescriptor?.props.revealedLocation).toMatchObject({
			ceremony: {
				venueName: 'Salón García',
				address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
				googleMapsUrl: 'https://maps.example.com/salon-garcia',
			},
		});
	});

	it('renders explicit section order respecting interlude placement', () => {
		const pageContext = setupDemoPageContext('demo-xv-enchanted-rose');

		expect(pageContext.viewModel.sectionOrder).toBeDefined();

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const descriptorComponents = descriptors.map((descriptor) => descriptor.component);

		expect(descriptorComponents).toEqual([
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

	it('includes interludes in ana-sofia-cota-guillen descriptors', () => {
		const eventEntry = {
			id: 'event-demos/xv/demo-xv-enchanted-rose',
			data: loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'demo-xv-enchanted-rose',
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const components = descriptors.map((d) => d.component);

		const interludeDescriptors = descriptors.filter((d) => d.component === 'interlude');
		expect(interludeDescriptors.length).toBeGreaterThan(0);

		expect(components).toContain('interlude');
		expect(components.indexOf('interlude')).toBeGreaterThan(0);

		for (const interlude of interludeDescriptors) {
			expect(interlude.props).toHaveProperty('image');
		}
	});

	it('passes thank-you overlay composition metadata to the render descriptor', () => {
		const fixture = loadFixture(
			'src/content/event-demos/bautismo/demo-bautismo-angelic-presence.json',
		);
		const eventEntry = {
			id: 'event-demos/bautismo/demo-bautismo-angelic-presence',
			data: {
				...fixture,
				thankYou: {
					...fixture.thankYou,
					overlayAnchor: 'left',
					overlaySafeArea: {
						x: 0.5,
						y: 0.08,
						width: 0.34,
						height: 0.42,
					},
				},
			},
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'demo-bautismo-angelic-presence',
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const thankYouDescriptor = descriptors.find((d) => d.component === 'thankYou');

		expect(thankYouDescriptor).toMatchObject({
			component: 'thankYou',
			props: {
				overlayAnchor: 'left',
				overlaySafeArea: {
					x: 0.5,
					y: 0.08,
					width: 0.34,
					height: 0.42,
				},
			},
		});
	});

	it('renders RSVP and PersonalizedAccess for demo preview without inviteId', () => {
		const pageContext = setupDemoPageContext();

		expect(pageContext.isDemoPreview).toBe(true);
		expect(pageContext.viewModel.isDemo).toBe(true);

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const descriptorComponents = descriptors.map((d) => d.component);

		expect(descriptorComponents).toContain('rsvp');
		expect(descriptorComponents).toContain('personalized-access');

		const rsvpDescriptor = descriptors.find(isRsvpDescriptor);
		expect(rsvpDescriptor?.props.isDemoPreview).toBe(true);
		expect(rsvpDescriptor?.props.initialGuestData).toBeUndefined();

		const personalizedAccessDescriptor = descriptors.find(isPersonalizedAccessDescriptor);
		expect(personalizedAccessDescriptor).toBeDefined();
		expect(personalizedAccessDescriptor?.props.isDemoPreview).toBe(true);
		expect(personalizedAccessDescriptor?.props.guestName).toBe(DEMO_GUEST_NAME);
	});

	it('renders RSVP form for demo preview regardless of accessMode', () => {
		const pageContext = setupDemoPageContext();

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const rsvpDescriptor = descriptors.find(isRsvpDescriptor);

		expect(rsvpDescriptor).toBeDefined();
		expect(rsvpDescriptor?.props.isDemoPreview).toBe(true);
		expect(rsvpDescriptor?.props.initialGuestData).toBeUndefined();
	});

	it('does not render personalized-access for events with accessMode other than hybrid', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const eventWithNoRsvp = {
			...fixture,
			rsvp: {},
		};
		const eventEntry = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: eventWithNoRsvp,
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'demo-xv-jewelry-box',
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const descriptorComponents = descriptors.map((d) => d.component);

		expect(descriptorComponents).toContain('rsvp');
	});
});
