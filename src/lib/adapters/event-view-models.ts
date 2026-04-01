import type {
	InvitationViewModel,
	HeroViewModel,
	EnvelopeViewModel,
	ContentBlock,
	ContentSectionKey,
} from './types';
import {
	COUNTDOWN_VARIANTS,
	ITINERARY_VARIANTS,
	LEGACY_INDICATION_ICON_MAP,
	LOCATION_VARIANTS,
	QUOTE_VARIANTS,
	SHARED_SECTION_VARIANTS,
	THEME_PRESETS,
	type IndicationIconKey,
} from '@/lib/theme/theme-contract';
import { type AssetSource } from '@/lib/assets/asset-registry';
import { type EventContentEntry } from '@/lib/content/events';
import { pickVariant, resolveAsset, requireAsset } from '@/lib/adapters/event-helpers';
import type { AdaptationContext } from '@/lib/adapters/event';
import { resolveColorToken } from '@/lib/theme/color-tokens';

export function buildHero(context: AdaptationContext): HeroViewModel {
	const { data, eventSlug, normalizedPreset } = context;
	return {
		name: data.hero.name,
		secondaryName: data.hero.secondaryName,
		label: data.hero.label || 'Invitación Especial',
		nickname: data.hero.nickname,
		date: data.hero.date,
		venueName: data.location.venueName,
		backgroundImage: requireAsset(eventSlug, data.hero.backgroundImage, data.title),
		portrait: resolveAsset(eventSlug, data.hero.portrait, data.title),
		variant: pickVariant(
			'hero.variant',
			data.hero.variant ?? normalizedPreset,
			THEME_PRESETS,
			normalizedPreset,
		),
		layoutVariant: data.hero.layoutVariant,
	};
}

export function buildEnvelope(context: AdaptationContext): EnvelopeViewModel {
	const { data, normalizedPreset } = context;
	const showEnvelope = !!(data.envelope && !data.envelope.disabled);

	return {
		enabled: showEnvelope,
		data:
			showEnvelope && data.envelope
				? {
						sealStyle: data.envelope.sealStyle,
						sealIcon: data.envelope.sealIcon,
						microcopy: data.envelope.microcopy,
						documentLabel: data.envelope.documentLabel,
						stampText: data.envelope.stampText,
						stampYear: data.envelope.stampYear,
						tooltipText: data.envelope.tooltipText,
						variant: pickVariant(
							'envelope.variant',
							data.envelope.variant ?? normalizedPreset,
							THEME_PRESETS,
							normalizedPreset,
						),
						colors: {
							background: resolveColorToken(
								data.envelope.closedPalette?.background || 'surfacePrimary',
								normalizedPreset,
							),
							primary: data.envelope.closedPalette?.primary
								? resolveColorToken(
										data.envelope.closedPalette.primary,
										normalizedPreset,
									)
								: undefined,
							accent: data.envelope.closedPalette?.accent
								? resolveColorToken(
										data.envelope.closedPalette.accent,
										normalizedPreset,
									)
								: undefined,
						},
					}
				: undefined,
	};
}

export function buildGalleryItems(context: AdaptationContext) {
	const { data, eventSlug } = context;
	return (
		data.gallery?.items.map((item: { image: string | AssetSource; caption?: string }) => ({
			...item,
			image: requireAsset(eventSlug, item.image, data.title),
		})) || []
	);
}

export function buildSectionImages(context: AdaptationContext) {
	const { data, eventSlug } = context;

	return {
		familyImage: data.family?.featuredImage
			? resolveAsset(eventSlug, data.family.featuredImage, data.title)
			: undefined,
		thankYouImage: data.thankYou?.image
			? resolveAsset(eventSlug, data.thankYou.image, data.title)
			: undefined,
		ceremony: data.location.ceremony
			? {
					...data.location.ceremony,
					image: resolveAsset(
						eventSlug,
						data.location.ceremony.image as string | AssetSource,
						data.title,
					),
				}
			: undefined,
		reception: data.location.reception
			? {
					...data.location.reception,
					image: resolveAsset(
						eventSlug,
						data.location.reception.image as string | AssetSource,
						data.title,
					),
				}
			: undefined,
	};
}

export function buildLocationIndications(context: AdaptationContext) {
	const { data } = context;

	return data.location.indications?.map(
		(indication: NonNullable<typeof data.location.indications>[number]) => {
			return {
				iconName:
					indication.iconName ??
					LEGACY_INDICATION_ICON_MAP[indication.icon as IndicationIconKey] ??
					'Gift',
				styleVariant: indication.styleVariant ?? 'default',
				text: indication.text,
			};
		},
	);
}

export function buildContentBlocks(context: AdaptationContext): ContentBlock[] | undefined {
	const { data, eventSlug, sharedSectionFallback } = context;

	const rawBlocks = data.contentBlocks as Array<{
		type: string;
		section?: string;
		image?: AssetSource | string;
		alt?: string;
		height?: string;
		variant?: string;
	}>;

	return rawBlocks?.flatMap((block): ContentBlock[] => {
		if (block.type === 'section' && block.section) {
			return [{ type: 'section', section: block.section as ContentSectionKey }];
		}

		if (block.type === 'interlude' && block.image) {
			const image = resolveAsset(eventSlug, block.image, data.title);
			if (!image) return [];

			return [
				{
					type: 'interlude',
					image,
					alt: block.alt || `Interludio de ${data.title}`,
					height: (block.height as 'screen' | 'tall') || 'tall',
					variant: pickVariant(
						'contentBlocks.interlude.variant',
						block.variant ?? sharedSectionFallback,
						SHARED_SECTION_VARIANTS,
						sharedSectionFallback,
					),
				},
			];
		}

		return [];
	});
}

export function buildSections(
	context: AdaptationContext,
	galleryItems: NonNullable<InvitationViewModel['sections']['gallery']>['items'],
	images: ReturnType<typeof buildSectionImages>,
	locationIndications: NonNullable<InvitationViewModel['sections']['location']>['indications'],
): InvitationViewModel['sections'] {
	return {
		quote: buildQuoteSection(context),
		countdown: buildCountdownSection(context),
		location: buildLocationSection(context, images, locationIndications),
		family: buildFamilySection(context, images.familyImage),
		gallery: buildGallerySection(context, galleryItems),
		itinerary: buildItinerarySection(context),
		rsvp: buildRsvpSection(context),
		gifts: buildGiftsSection(context),
		thankYou: buildThankYouSection(context, images.thankYouImage),
	};
}

function buildQuoteSection(context: AdaptationContext) {
	const { data, quoteFallback } = context;
	if (!data.quote) return undefined;

	return {
		...data.quote,
		variant: pickVariant(
			'sectionStyles.quote.variant',
			data.sectionStyles?.quote?.variant ?? quoteFallback,
			QUOTE_VARIANTS,
			quoteFallback,
		),
		animation: data.sectionStyles?.quote?.animation,
	};
}

function buildCountdownSection(context: AdaptationContext) {
	const { data, countdownFallback } = context;
	if (!data.countdown) return undefined;

	return {
		...data.countdown,
		eventDate: data.hero.date,
		variant: pickVariant(
			'sectionStyles.countdown.variant',
			data.sectionStyles?.countdown?.variant ?? countdownFallback,
			COUNTDOWN_VARIANTS,
			countdownFallback,
		),
		showParticles: data.sectionStyles?.countdown?.showParticles,
	};
}

function buildLocationSection(
	context: AdaptationContext,
	images: ReturnType<typeof buildSectionImages>,
	locationIndications: NonNullable<InvitationViewModel['sections']['location']>['indications'],
) {
	const { data, locationFallback } = context;

	return {
		ceremony: images.ceremony,
		reception: images.reception,
		indications: locationIndications,
		variant: pickVariant(
			'sectionStyles.location.variant',
			data.sectionStyles?.location?.variant ?? locationFallback,
			LOCATION_VARIANTS,
			locationFallback,
		),
		mapStyle: data.sectionStyles?.location?.mapStyle,
		showFlourishes: data.sectionStyles?.location?.showFlourishes,
		city: data.location.city,
		venueName: data.location.venueName,
	};
}

function buildFamilySection(
	context: AdaptationContext,
	familyImage: ReturnType<typeof buildSectionImages>['familyImage'],
) {
	const { data, sharedSectionFallback } = context;
	if (!data.family) return undefined;

	return {
		...data.family,
		godparents: data.family.godparents,
		groups: data.family.groups,
		featuredImage: familyImage,
		celebrantName: data.hero.name,
		variant: pickVariant(
			'sectionStyles.family.variant',
			data.sectionStyles?.family?.variant ?? sharedSectionFallback,
			SHARED_SECTION_VARIANTS,
			sharedSectionFallback,
		),
		layoutVariant: data.family.layoutVariant,
	};
}

function buildGallerySection(
	context: AdaptationContext,
	galleryItems: NonNullable<InvitationViewModel['sections']['gallery']>['items'],
) {
	const { data, sharedSectionFallback } = context;
	if (!data.gallery) return undefined;

	return {
		...data.gallery,
		items: galleryItems,
		variant: pickVariant(
			'sectionStyles.gallery.variant',
			data.sectionStyles?.gallery?.variant ?? sharedSectionFallback,
			SHARED_SECTION_VARIANTS,
			sharedSectionFallback,
		),
	};
}

function buildItinerarySection(context: AdaptationContext) {
	const { data, itineraryFallback } = context;
	if (!data.itinerary) return undefined;

	return {
		...data.itinerary,
		variant: pickVariant(
			'sectionStyles.itinerary.variant',
			data.sectionStyles?.itinerary?.variant ?? itineraryFallback,
			ITINERARY_VARIANTS,
			itineraryFallback,
		),
	};
}

function resolveCelebrantName(data: EventContentEntry['data']) {
	return (
		data.hero.nickname ||
		(data.hero.secondaryName
			? `${data.hero.name} & ${data.hero.secondaryName}`
			: data.hero.name.split(' ')[0])
	);
}

function buildRsvpSection(context: AdaptationContext) {
	const { data, eventSlug, sharedSectionFallback } = context;
	if (!data.rsvp) return undefined;

	return {
		...data.rsvp,
		eventSlug,
		celebrantName: resolveCelebrantName(data),
		variant: pickVariant(
			'sectionStyles.rsvp.variant',
			data.sectionStyles?.rsvp?.variant ?? sharedSectionFallback,
			SHARED_SECTION_VARIANTS,
			sharedSectionFallback,
		),
		labels: data.sectionStyles?.rsvp?.labels,
	};
}

function buildGiftsSection(context: AdaptationContext) {
	const { data, sharedSectionFallback } = context;
	if (!data.gifts) return undefined;

	return {
		...data.gifts,
		variant: pickVariant(
			'sectionStyles.gifts.variant',
			data.sectionStyles?.gifts?.variant ?? sharedSectionFallback,
			SHARED_SECTION_VARIANTS,
			sharedSectionFallback,
		),
	};
}

function buildThankYouSection(
	context: AdaptationContext,
	thankYouImage: ReturnType<typeof buildSectionImages>['thankYouImage'],
) {
	const { data, sharedSectionFallback } = context;
	if (!data.thankYou) return undefined;

	return {
		...data.thankYou,
		image: thankYouImage,
		variant: pickVariant(
			'sectionStyles.thankYou.variant',
			data.sectionStyles?.thankYou?.variant ?? sharedSectionFallback,
			SHARED_SECTION_VARIANTS,
			sharedSectionFallback,
		),
	};
}
