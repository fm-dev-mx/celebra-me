import type { InvitationPageContext, InvitationRenderPlanItem } from '@/lib/invitation/page-data';
import type { ContentSectionKey } from '@/lib/adapters/types';
import type { SharedSectionVariant } from '@/lib/theme/theme-contract';

type Sections = InvitationPageContext['viewModel']['sections'];
type SectionData<K extends keyof Sections> = NonNullable<Sections[K]>;
type RenderableSectionKey = Extract<InvitationRenderPlanItem, { type: 'section' }>['section'];
type InterludeBlock = Extract<InvitationRenderPlanItem, { type: 'interlude' }>;

type LocationProps = SectionData<'location'> & {
	nextSectionLink?: {
		href: string;
		label?: string;
	};
};

type GiftsProps = Omit<SectionData<'gifts'>, 'items'> & {
	gifts: SectionData<'gifts'>['items'];
};

type PersonalizedAccessProps = {
	guestName: string;
	maxAllowedAttendees: number;
};

const SECTION_NAV_TARGETS: Partial<Record<ContentSectionKey, { href: string; label: string }>> = {
	quote: { href: '#quote-section', label: 'Mensaje' },
	family: { href: '#family-section', label: 'Familia' },
	gallery: { href: '#galeria', label: 'Galería' },
	countdown: { href: '#countdown', label: 'Cuenta regresiva' },
	location: { href: '#event-location', label: 'Ubicación' },
	itinerary: { href: '#itinerary', label: 'Itinerario' },
	rsvp: { href: '#rsvp', label: 'Pases y Confirmación' },
	gifts: { href: '#regalos', label: 'Regalos' },
	thankYou: { href: '#thank-you-section', label: 'Despedida' },
};

export type InvitationSectionRenderDescriptor =
	| {
			component: 'interlude';
			props: {
				image: InterludeBlock['image'];
				alt: InterludeBlock['alt'];
				height: InterludeBlock['height'];
				variant: SharedSectionVariant;
				focalPoint?: string;
			};
	  }
	| { component: 'quote'; props: SectionData<'quote'> }
	| { component: 'family'; props: SectionData<'family'> }
	| { component: 'gallery'; props: SectionData<'gallery'> }
	| { component: 'countdown'; props: SectionData<'countdown'> }
	| { component: 'location'; props: LocationProps }
	| { component: 'itinerary'; props: SectionData<'itinerary'> }
	| {
			component: 'rsvp';
			props: SectionData<'rsvp'> & {
				celebrantName: string;
				guestCap: number;
				initialGuestData?: {
					fullName: string;
					maxAllowedAttendees: number;
					inviteId: string;
				};
			};
	  }
	| { component: 'gifts'; props: GiftsProps }
	| { component: 'thankYou'; props: SectionData<'thankYou'> }
	| { component: 'personalized-access'; props: PersonalizedAccessProps };

function renderInterlude(
	pageContext: InvitationPageContext,
	block: InterludeBlock,
): InvitationSectionRenderDescriptor {
	return {
		component: 'interlude',
		props: {
			image: block.image,
			alt: block.alt,
			height: block.height,
			variant: block.variant ?? pageContext.viewModel.theme.preset ?? 'standard',
			focalPoint: block.focalPoint,
		},
	};
}

function renderPersonalizedAccess(
	pageContext: InvitationPageContext,
): InvitationSectionRenderDescriptor | null {
	const guestContext = pageContext.guestContext;

	if (!guestContext) return null;

	return {
		component: 'personalized-access',
		props: {
			guestName: guestContext.guest.fullName,
			maxAllowedAttendees: guestContext.guest.maxAllowedAttendees,
		},
	};
}

function renderRsvpSection(
	pageContext: InvitationPageContext,
): InvitationSectionRenderDescriptor | null {
	const { sections, hero } = pageContext.viewModel;

	if (!sections.rsvp) return null;

	const guestContext = pageContext.guestContext;

	return {
		component: 'rsvp',
		props: {
			...sections.rsvp,
			celebrantName: hero.name,
			guestCap: guestContext?.guest.maxAllowedAttendees ?? sections.rsvp.guestCap,
			initialGuestData: guestContext
				? {
						fullName: guestContext.guest.fullName,
						maxAllowedAttendees: guestContext.guest.maxAllowedAttendees,
						inviteId: guestContext.inviteId,
					}
				: undefined,
		},
	};
}

function renderGiftsSection(sections: Sections): InvitationSectionRenderDescriptor | null {
	if (!sections.gifts) return null;

	const { items: gifts, ...rest } = sections.gifts;

	return {
		component: 'gifts',
		props: {
			...rest,
			gifts,
		},
	};
}

function renderSection(
	pageContext: InvitationPageContext,
	section: RenderableSectionKey,
	nextSectionLink?: LocationProps['nextSectionLink'],
): InvitationSectionRenderDescriptor | null {
	const { sections } = pageContext.viewModel;

	switch (section) {
		case 'quote':
			return sections.quote ? { component: 'quote', props: sections.quote } : null;

		case 'family':
			return sections.family ? { component: 'family', props: sections.family } : null;

		case 'gallery':
			return sections.gallery ? { component: 'gallery', props: sections.gallery } : null;

		case 'countdown':
			return sections.countdown
				? { component: 'countdown', props: sections.countdown }
				: null;

		case 'location':
			return sections.location
				? {
						component: 'location',
						props: {
							...sections.location,
							nextSectionLink,
						},
					}
				: null;

		case 'itinerary':
			return sections.itinerary
				? { component: 'itinerary', props: sections.itinerary }
				: null;

		case 'rsvp':
			return renderRsvpSection(pageContext);

		case 'gifts':
			return renderGiftsSection(sections);

		case 'thankYou':
			return sections.thankYou ? { component: 'thankYou', props: sections.thankYou } : null;
	}
}

function renderBlock(
	pageContext: InvitationPageContext,
	block: InvitationRenderPlanItem,
	index: number,
	renderPlan: InvitationRenderPlanItem[],
): InvitationSectionRenderDescriptor | null {
	switch (block.type) {
		case 'interlude':
			return renderInterlude(pageContext, block);

		case 'personalized-access':
			return renderPersonalizedAccess(pageContext);

		case 'section': {
			const nextSectionLink =
				block.section === 'location' ? findNextSectionLink(renderPlan, index) : undefined;

			return renderSection(pageContext, block.section, nextSectionLink);
		}
	}
}

// Personalized access should feel attached to the human message, preferably just after Quote.
function prioritizePersonalizedAccess(
	descriptors: InvitationSectionRenderDescriptor[],
): InvitationSectionRenderDescriptor[] {
	const personalizedAccess = descriptors.find(
		(descriptor) => descriptor.component === 'personalized-access',
	);

	if (!personalizedAccess) return descriptors;

	const rest: InvitationSectionRenderDescriptor[] = descriptors.filter(
		(descriptor) => descriptor.component !== 'personalized-access',
	);

	const quoteIndex = rest.findIndex((descriptor) => descriptor.component === 'quote');

	if (quoteIndex !== -1) {
		rest.splice(quoteIndex + 1, 0, personalizedAccess);
		return rest;
	}

	const firstContentIndex = rest.findIndex((descriptor) => descriptor.component !== 'interlude');

	rest.splice(firstContentIndex === -1 ? 0 : firstContentIndex, 0, personalizedAccess);

	return rest;
}

export function buildInvitationSectionRenderDescriptors(
	pageContext: InvitationPageContext,
): InvitationSectionRenderDescriptor[] {
	const descriptors = pageContext.renderPlan
		.map((block, index) => renderBlock(pageContext, block, index, pageContext.renderPlan))
		.filter((block): block is InvitationSectionRenderDescriptor => block !== null);

	return prioritizePersonalizedAccess(descriptors);
}

function findNextSectionLink(
	renderPlan: InvitationRenderPlanItem[],
	index: number,
): LocationProps['nextSectionLink'] {
	for (let nextIndex = index + 1; nextIndex < renderPlan.length; nextIndex += 1) {
		const block = renderPlan[nextIndex];
		if (block.type !== 'section') continue;

		const target = SECTION_NAV_TARGETS[block.section];
		if (target) return target;
	}

	return undefined;
}
