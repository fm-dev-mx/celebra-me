import type { InvitationPageData, InvitationRenderPlanItem } from '@/lib/invitation/page-data';
import type { ContentSectionKey } from '@/lib/adapters/types';
import type { SharedSectionVariant } from '@/lib/theme/theme-contract';

type QuoteProps = {
	text: NonNullable<InvitationPageData['sections']['quote']>['text'];
	author: NonNullable<InvitationPageData['sections']['quote']>['author'];
	variant: NonNullable<InvitationPageData['sections']['quote']>['variant'];
	animation: NonNullable<InvitationPageData['sections']['quote']>['animation'];
};

type FamilyProps = {
	parents: NonNullable<InvitationPageData['sections']['family']>['parents'];
	spouse: NonNullable<InvitationPageData['sections']['family']>['spouse'];
	children: NonNullable<InvitationPageData['sections']['family']>['children'];
	godparents: NonNullable<InvitationPageData['sections']['family']>['godparents'];
	groups: NonNullable<InvitationPageData['sections']['family']>['groups'];
	featuredImage: NonNullable<InvitationPageData['sections']['family']>['featuredImage'];
	labels: NonNullable<InvitationPageData['sections']['family']>['labels'];
	celebrantName: NonNullable<InvitationPageData['sections']['family']>['celebrantName'];
	variant: NonNullable<InvitationPageData['sections']['family']>['variant'];
	focalPoint: NonNullable<InvitationPageData['sections']['family']>['focalPoint'];
	layoutVariant: NonNullable<InvitationPageData['sections']['family']>['layoutVariant'];
};

type GalleryProps = {
	title: NonNullable<InvitationPageData['sections']['gallery']>['title'];
	subtitle: NonNullable<InvitationPageData['sections']['gallery']>['subtitle'];
	items: NonNullable<InvitationPageData['sections']['gallery']>['items'];
	variant: NonNullable<InvitationPageData['sections']['gallery']>['variant'];
};

type CountdownProps = {
	eventDate: NonNullable<InvitationPageData['sections']['countdown']>['eventDate'];
	title: NonNullable<InvitationPageData['sections']['countdown']>['title'];
	subtitlePrefix: NonNullable<InvitationPageData['sections']['countdown']>['subtitlePrefix'];
	footerText: NonNullable<InvitationPageData['sections']['countdown']>['footerText'];
	variant: NonNullable<InvitationPageData['sections']['countdown']>['variant'];
	showParticles: NonNullable<InvitationPageData['sections']['countdown']>['showParticles'];
};

type LocationProps = {
	ceremony: NonNullable<InvitationPageData['sections']['location']>['ceremony'];
	reception: NonNullable<InvitationPageData['sections']['location']>['reception'];
	indications: NonNullable<InvitationPageData['sections']['location']>['indications'];
	variant: NonNullable<InvitationPageData['sections']['location']>['variant'];
	mapStyle: NonNullable<InvitationPageData['sections']['location']>['mapStyle'];
	showFlourishes: NonNullable<InvitationPageData['sections']['location']>['showFlourishes'];
	nextSectionLink?: {
		href: string;
		label?: string;
	};
};

type ItineraryProps = {
	title: NonNullable<InvitationPageData['sections']['itinerary']>['title'];
	items: NonNullable<InvitationPageData['sections']['itinerary']>['items'];
	variant: NonNullable<InvitationPageData['sections']['itinerary']>['variant'];
};

type GiftsProps = {
	gifts: NonNullable<InvitationPageData['sections']['gifts']>['items'];
	title: NonNullable<InvitationPageData['sections']['gifts']>['title'];
	subtitle: NonNullable<InvitationPageData['sections']['gifts']>['subtitle'];
	variant: NonNullable<InvitationPageData['sections']['gifts']>['variant'];
};

type ThankYouProps = {
	message: NonNullable<InvitationPageData['sections']['thankYou']>['message'];
	closingName: NonNullable<InvitationPageData['sections']['thankYou']>['closingName'];
	image: NonNullable<InvitationPageData['sections']['thankYou']>['image'];
	focalPoint: NonNullable<InvitationPageData['sections']['thankYou']>['focalPoint'];
	variant: NonNullable<InvitationPageData['sections']['thankYou']>['variant'];
};

type InterludeBlock = Extract<InvitationRenderPlanItem, { type: 'interlude' }>;

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
	| {
			kind: 'personalized-access';
			props: {
				guestName: string;
				maxAllowedAttendees: number;
			};
	  };

function renderInterlude(
	pageData: InvitationPageData,
	block: Extract<InvitationRenderPlanItem, { type: 'interlude' }>,
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

function renderSection(
	pageData: InvitationPageData,
	section: string,
	nextSectionLink?: LocationProps['nextSectionLink'],
): InvitationSectionRenderDescriptor | null {
	const { sections, rsvp } = pageData;

	switch (section) {
		case 'quote':
			return sections.quote
				? {
						kind: 'quote',
						props: {
							text: sections.quote.text,
							author: sections.quote.author,
							variant: sections.quote.variant,
							animation: sections.quote.animation,
						},
					}
				: null;
		case 'family':
			return sections.family
				? {
						kind: 'family',
						props: {
							parents: sections.family.parents,
							spouse: sections.family.spouse,
							children: sections.family.children,
							godparents: sections.family.godparents,
							groups: sections.family.groups,
							featuredImage: sections.family.featuredImage,
							labels: sections.family.labels,
							celebrantName: sections.family.celebrantName,
							variant: sections.family.variant,
							focalPoint: sections.family.focalPoint,
							layoutVariant: sections.family.layoutVariant,
						},
					}
				: null;
		case 'gallery':
			return sections.gallery
				? {
						kind: 'gallery',
						props: {
							title: sections.gallery.title,
							subtitle: sections.gallery.subtitle,
							items: sections.gallery.items,
							variant: sections.gallery.variant,
						},
					}
				: null;
		case 'countdown':
			return sections.countdown
				? {
						kind: 'countdown',
						props: {
							eventDate: sections.countdown.eventDate,
							title: sections.countdown.title,
							subtitlePrefix: sections.countdown.subtitlePrefix,
							footerText: sections.countdown.footerText,
							variant: sections.countdown.variant,
							showParticles: sections.countdown.showParticles,
						},
					}
				: null;
		case 'location':
			return sections.location
				? {
						kind: 'location',
						props: {
							ceremony: sections.location.ceremony,
							reception: sections.location.reception,
							indications: sections.location.indications,
							variant: sections.location.variant,
							mapStyle: sections.location.mapStyle,
							showFlourishes: sections.location.showFlourishes,
							nextSectionLink,
						},
					}
				: null;
		case 'itinerary':
			return sections.itinerary
				? {
						kind: 'itinerary',
						props: {
							title: sections.itinerary.title,
							items: sections.itinerary.items,
							variant: sections.itinerary.variant,
						},
					}
				: null;
		case 'rsvp':
			return rsvp ? { kind: 'rsvp', props: rsvp } : null;
		case 'gifts':
			return sections.gifts
				? {
						kind: 'gifts',
						props: {
							gifts: sections.gifts.items,
							title: sections.gifts.title,
							subtitle: sections.gifts.subtitle,
							variant: sections.gifts.variant,
						},
					}
				: null;
		case 'thankYou':
			return sections.thankYou
				? {
						kind: 'thankYou',
						props: {
							message: sections.thankYou.message,
							closingName: sections.thankYou.closingName,
							image: sections.thankYou.image,
							focalPoint: sections.thankYou.focalPoint,
							variant: sections.thankYou.variant,
						},
					}
				: null;
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
	if (block.type === 'interlude') {
		return renderInterlude(pageData, block);
	}

	if (block.type === 'personalized-access') {
		return pageData.personalizedAccess
			? {
					kind: 'personalized-access',
					props: {
						guestName: pageData.personalizedAccess.guestName,
						maxAllowedAttendees: pageData.personalizedAccess.maxAllowedAttendees,
					},
				}
			: null;
	}

	const nextSectionLink =
		block.type === 'section' && block.section === 'location'
			? findNextSectionLink(renderPlan, index)
			: undefined;

	return renderSection(pageData, block.section, nextSectionLink);
}

export function buildInvitationSectionRenderDescriptors(
	pageData: InvitationPageData,
): InvitationSectionRenderDescriptor[] {
	return pageData.renderPlan
		.map((block, index) => renderBlock(pageData, block, index, pageData.renderPlan))
		.filter((block): block is InvitationSectionRenderDescriptor => Boolean(block));
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
