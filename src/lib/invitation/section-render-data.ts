import type { InvitationPageData, InvitationRenderPlanItem } from '@/lib/invitation/page-data';

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
	variant: NonNullable<InvitationPageData['sections']['thankYou']>['variant'];
};

type InterludeBlock = Extract<InvitationRenderPlanItem, { type: 'interlude' }>;

export type InvitationSectionRenderDescriptor =
	| {
			kind: 'interlude';
			props: {
				image: InterludeBlock['image'];
				alt: InterludeBlock['alt'];
				height: InterludeBlock['height'];
				variant: string;
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
			variant: block.variant ?? pageData.themePreset,
		},
	};
}

function renderSection(
	pageData: InvitationPageData,
	section: string,
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

	return renderSection(pageData, block.section);
}

export function buildInvitationSectionRenderDescriptors(
	pageData: InvitationPageData,
): InvitationSectionRenderDescriptor[] {
	return pageData.renderPlan
		.map((block) => renderBlock(pageData, block))
		.filter((block): block is InvitationSectionRenderDescriptor => Boolean(block));
}
