import fs from 'node:fs';
import path from 'node:path';
import {
	buildInvitationSectionRenderDescriptors,
	type InvitationSectionRenderDescriptor,
	DEMO_GUEST_NAME,
} from '@/lib/invitation/section-render-data';
import { prepareInvitationPageContext } from '@/lib/invitation/page-data';

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

describe('buildInvitationSectionRenderDescriptors', () => {
	it('derives the next anchorable section for location navigation from the render plan', () => {
		const eventEntry = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'ximena-meza-trasvina',
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
					countdown: { variant: 'editorial', showParticles: true },
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
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'ximena-meza-trasvina',
			guestContext: {
				inviteId: 'invite-zero',
				eventSlug: 'ximena-meza-trasvina',
				eventType: 'xv',
				eventTitle: 'Ximena Meza Trasvina',
				guest: {
					fullName: 'Invitada Test',
					maxAllowedAttendees: 0,
					attendanceStatus: 'pending',
					attendeeCount: 0,
					guestComment: '',
				},
			},
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const descriptorComponents = descriptors.map((descriptor) => descriptor.component);
		const quoteIndex = descriptorComponents.indexOf('quote');
		const personalizedAccessIndex = descriptorComponents.indexOf('personalized-access');
		const rsvpDescriptor = descriptors.find(isRsvpDescriptor);

		expect(personalizedAccessIndex).toBe(quoteIndex + 1);
		expect(rsvpDescriptor?.props.guestCap).toBe(0);
		expect(rsvpDescriptor?.props.accessMode).toBe('hybrid');
		expect(rsvpDescriptor?.props.eventType).toBe('xv');
		expect(rsvpDescriptor?.props.eventSlug).toBe('ximena-meza-trasvina');
		expect(rsvpDescriptor?.props.initialGuestData).toEqual({
			fullName: 'Invitada Test',
			maxAllowedAttendees: 0,
			inviteId: 'invite-zero',
		});
	});

	it('includes interludes in ana-sofia-cota-guillen descriptors', () => {
		const eventEntry = {
			id: 'events/ana-sofia-cota-guillen',
			data: loadFixture('src/content/events/ana-sofia-cota-guillen.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'ana-sofia-cota-guillen',
		});

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const components = descriptors.map((d) => d.component);

		const interludeDescriptors = descriptors.filter((d) => d.component === 'interlude');
		expect(interludeDescriptors).toHaveLength(4);

		expect(components).toContain('interlude');
		expect(components.indexOf('interlude')).toBeGreaterThan(0);

		for (const interlude of interludeDescriptors) {
			expect(interlude.props).toHaveProperty('image');
			expect(interlude.props).toHaveProperty('variant', 'celestial-blue');
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

	it('does not render personalized-access for non-demo events without inviteId', () => {
		const eventEntry = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof prepareInvitationPageContext>[0]['eventEntry'];

		const pageContext = prepareInvitationPageContext({
			eventEntry,
			slug: 'ximena-meza-trasvina',
			guestContext: null,
		});

		expect(pageContext.isDemoPreview).toBe(false);
		expect(pageContext.viewModel.isDemo).toBe(false);

		const descriptors = buildInvitationSectionRenderDescriptors(pageContext);
		const descriptorComponents = descriptors.map((d) => d.component);

		expect(descriptorComponents).not.toContain('personalized-access');
	});
});
