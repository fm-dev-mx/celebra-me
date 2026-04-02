import type { InvitationPageData, InvitationRenderPlanItem } from '@/lib/invitation/page-data';
import type { ContentSectionKey } from '@/lib/adapters/types';
import type { SharedSectionVariant } from '@/lib/theme/theme-contract';

type Sections = InvitationPageData['sections'];
type SectionData<K extends keyof Sections> = NonNullable<Sections[K]>;
type RenderableSectionKey = Extract<InvitationRenderPlanItem, { type: 'section' }>['section'];
type InterludeBlock = Extract<InvitationRenderPlanItem, { type: 'interlude' }>;

type QuoteProps = SectionData<'quote'>;
type FamilyProps = SectionData<'family'>;
type GalleryProps = SectionData<'gallery'>;
type CountdownProps = SectionData<'countdown'>;
type ItineraryProps = SectionData<'itinerary'>;
type ThankYouProps = SectionData<'thankYou'>;

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
	guestName: NonNullable<InvitationPageData['personalizedAccess']>['guestName'];
	maxAllowedAttendees: NonNullable<
		InvitationPageData['personalizedAccess']
	>['maxAllowedAttendees'];
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
			kind: 'interlude';
			props: {
				image: InterludeBlock['image'];
				alt: InterludeBlock['alt'];
				height: InterludeBlock['height'];
				variant: SharedSectionVariant;
				focalPoint?: string;
			};
	  }
	| { kind: 'quote'; props: QuoteProps }
	| { kind: 'family'; props: FamilyProps }
	| { kind: 'gallery'; props: GalleryProps }
	| { kind: 'countdown'; props: CountdownProps }
	| { kind: 'location'; props: LocationProps }
	| { kind: 'itinerary'; props: ItineraryProps }
	| { kind: 'rsvp'; props: NonNullable<InvitationPageData['rsvp']> }
	| { kind: 'gifts'; props: GiftsProps }
	| { kind: 'thankYou'; props: ThankYouProps }
	| { kind: 'personalized-access'; props: PersonalizedAccessProps };

function renderInterlude(
	pageData: InvitationPageData,
	block: InterludeBlock,
): InvitationSectionRenderDescriptor {
	return {
		kind: 'interlude',
		props: {
			image: block.image,
			alt: block.alt,
			height: block.height,
			variant: block.variant ?? pageData.themePreset ?? 'standard',
			focalPoint: block.focalPoint,
		},
	};
}

function renderPersonalizedAccess(
	pageData: InvitationPageData,
): InvitationSectionRenderDescriptor | null {
	const personalizedAccess = pageData.personalizedAccess;

	if (!personalizedAccess) return null;

	return {
		kind: 'personalized-access',
		props: {
			guestName: personalizedAccess.guestName,
			maxAllowedAttendees: personalizedAccess.maxAllowedAttendees,
		},
	};
}

function renderSection(
	pageData: InvitationPageData,
	section: RenderableSectionKey,
	nextSectionLink?: LocationProps['nextSectionLink'],
): InvitationSectionRenderDescriptor | null {
	const { sections, rsvp } = pageData;

	switch (section) {
		case 'quote':
			return sections.quote ? { kind: 'quote', props: sections.quote } : null;

		case 'family':
			return sections.family ? { kind: 'family', props: sections.family } : null;

		case 'gallery':
			return sections.gallery ? { kind: 'gallery', props: sections.gallery } : null;

		case 'countdown':
			return sections.countdown ? { kind: 'countdown', props: sections.countdown } : null;

		case 'location':
			return sections.location
				? {
						kind: 'location',
						props: {
							...sections.location,
							nextSectionLink,
						},
					}
				: null;

		case 'itinerary':
			return sections.itinerary ? { kind: 'itinerary', props: sections.itinerary } : null;

		case 'rsvp':
			return rsvp ? { kind: 'rsvp', props: rsvp } : null;

		case 'gifts': {
			if (!sections.gifts) return null;

			const { items: gifts, ...rest } = sections.gifts;

			return {
				kind: 'gifts',
				props: {
					...rest,
					gifts,
				},
			};
		}

		case 'thankYou':
			return sections.thankYou ? { kind: 'thankYou', props: sections.thankYou } : null;

		default:
			return null;
	}
}

function renderBlock(
	pageData: InvitationPageData,
	block: InvitationRenderPlanItem,
	index: number,
	renderPlan: InvitationRenderPlanItem[],
): InvitationSectionRenderDescriptor | null {
	switch (block.type) {
		case 'interlude':
			return renderInterlude(pageData, block);

		case 'personalized-access':
			return renderPersonalizedAccess(pageData);

		case 'section': {
			const nextSectionLink =
				block.section === 'location' ? findNextSectionLink(renderPlan, index) : undefined;

			return renderSection(pageData, block.section, nextSectionLink);
		}

		default:
			return null;
	}
}

function prioritizePersonalizedAccess(
	descriptors: InvitationSectionRenderDescriptor[],
): InvitationSectionRenderDescriptor[] {
	const personalizedAccess = descriptors.find(
		(descriptor) => descriptor.kind === 'personalized-access',
	);

	if (!personalizedAccess) return descriptors;

	const rest: InvitationSectionRenderDescriptor[] = descriptors.filter(
		(descriptor) => descriptor.kind !== 'personalized-access',
	);

	const quoteIndex = rest.findIndex((descriptor) => descriptor.kind === 'quote');

	if (quoteIndex !== -1) {
		rest.splice(quoteIndex + 1, 0, personalizedAccess);
		return rest;
	}

	const firstContentIndex = rest.findIndex((descriptor) => descriptor.kind !== 'interlude');

	rest.splice(firstContentIndex === -1 ? 0 : firstContentIndex, 0, personalizedAccess);

	return rest;
}

export function buildInvitationSectionRenderDescriptors(
	pageData: InvitationPageData,
): InvitationSectionRenderDescriptor[] {
	const descriptors = pageData.renderPlan
		.map((block, index) => renderBlock(pageData, block, index, pageData.renderPlan))
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
