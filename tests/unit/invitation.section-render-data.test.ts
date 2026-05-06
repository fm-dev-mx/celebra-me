import fs from 'node:fs';
import path from 'node:path';
import {
	buildInvitationSectionRenderDescriptors,
	type InvitationSectionRenderDescriptor,
} from '@/lib/invitation/section-render-data';
import { prepareInvitationPageContext } from '@/lib/invitation/page-data';

type RsvpDescriptor = Extract<InvitationSectionRenderDescriptor, { component: 'rsvp' }>;

function isRsvpDescriptor(
	descriptor: InvitationSectionRenderDescriptor,
): descriptor is RsvpDescriptor {
	return descriptor.component === 'rsvp';
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
					href: '#family-section',
					label: 'Familia',
				},
			},
		});
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
});
