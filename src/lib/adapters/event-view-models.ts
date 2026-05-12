import type { InvitationViewModel, HeroViewModel, EnvelopeViewModel } from './types';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';
import { type AssetSource } from '@/lib/assets/asset-registry';
import { pickVariant, resolveAsset, requireAsset } from '@/lib/adapters/event-helpers';
import type { AdaptationContext } from '@/lib/adapters/event';
import { resolveColorRole } from '@/lib/theme/color-tokens';
import { buildRevealCard } from '@/lib/invitation/reveal-card';

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
						variant: normalizedPreset,
						card: buildRevealCard({
							name: data.hero.name,
							date: data.hero.date,
							city: data.location.city,
							documentLabel: data.envelope.documentLabel,
							sealIcon: data.envelope.sealIcon,
						}),
						colors: {
							background: data.envelope.closedPalette?.background
								? resolveColorRole(data.envelope.closedPalette.background)
								: undefined,
							primary: data.envelope.closedPalette?.primary
								? resolveColorRole(data.envelope.closedPalette.primary)
								: undefined,
							accent: data.envelope.closedPalette?.accent
								? resolveColorRole(data.envelope.closedPalette.accent)
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
				iconName: indication.iconName ?? indication.icon ?? 'Gift',
				styleVariant: indication.styleVariant ?? 'default',
				text: indication.text,
			};
		},
	);
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

export function buildSharing(context: AdaptationContext) {
	const { data, eventSlug } = context;
	if (!data.sharing) return undefined;

	return {
		whatsappTemplate: data.sharing.whatsappTemplate,
		ogImage: data.sharing.ogImage
			? resolveAsset(eventSlug, data.sharing.ogImage, data.title)
			: undefined,
	};
}

function buildQuoteSection(context: AdaptationContext) {
	const { data, normalizedPreset } = context;
	if (!data.quote) return undefined;

	return {
		...data.quote,
		variant: pickVariant(
			'sectionStyles.quote.variant',
			data.sectionStyles?.quote?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
	};
}

function buildCountdownSection(context: AdaptationContext) {
	const { data, normalizedPreset } = context;
	if (!data.countdown) return undefined;

	return {
		...data.countdown,
		eventDate: data.hero.date,
		variant: pickVariant(
			'sectionStyles.countdown.variant',
			data.sectionStyles?.countdown?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
	};
}

function buildLocationSection(
	context: AdaptationContext,
	images: ReturnType<typeof buildSectionImages>,
	locationIndications: NonNullable<InvitationViewModel['sections']['location']>['indications'],
) {
	const { data, normalizedPreset } = context;

	return {
		ceremony: images.ceremony,
		reception: images.reception,
		indications: locationIndications,
		variant: pickVariant(
			'sectionStyles.location.variant',
			data.sectionStyles?.location?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
		showFlourishes: data.sectionStyles?.location?.showFlourishes,
		indicationsHeading: data.location.indicationsHeading ?? '',
		city: data.location.city,
		venueName: data.location.venueName,
	};
}

function buildFamilySection(
	context: AdaptationContext,
	familyImage: ReturnType<typeof buildSectionImages>['familyImage'],
) {
	const { data, normalizedPreset } = context;
	if (!data.family) return undefined;

	return {
		...data.family,
		godparents: data.family.godparents,
		groups: data.family.groups,
		featuredImage: familyImage,
		focalPoint: data.family.focalPoint,
		celebrantName: data.hero.name,
		variant: pickVariant(
			'sectionStyles.family.variant',
			data.sectionStyles?.family?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
	};
}

function buildGallerySection(
	context: AdaptationContext,
	galleryItems: NonNullable<InvitationViewModel['sections']['gallery']>['items'],
) {
	const { data, normalizedPreset } = context;
	if (!data.gallery) return undefined;

	return {
		...data.gallery,
		items: galleryItems,
		variant: pickVariant(
			'sectionStyles.gallery.variant',
			data.sectionStyles?.gallery?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
	};
}

function buildItinerarySection(context: AdaptationContext) {
	const { data, normalizedPreset } = context;
	if (!data.itinerary) return undefined;

	return {
		...data.itinerary,
		variant: pickVariant(
			'sectionStyles.itinerary.variant',
			data.sectionStyles?.itinerary?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
	};
}

function buildRsvpSection(context: AdaptationContext) {
	const { data, eventSlug, normalizedPreset } = context;
	if (!data.rsvp) return undefined;

	return {
		...data.rsvp,
		eventSlug,
		eventType: data.eventType,
		variant: pickVariant(
			'sectionStyles.rsvp.variant',
			data.sectionStyles?.rsvp?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
		labels: data.sectionStyles?.rsvp?.labels,
	};
}

function buildGiftsSection(context: AdaptationContext) {
	const { data, normalizedPreset } = context;
	if (!data.gifts) return undefined;

	return {
		...data.gifts,
		variant: pickVariant(
			'sectionStyles.gifts.variant',
			data.sectionStyles?.gifts?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
	};
}

function buildThankYouSection(
	context: AdaptationContext,
	thankYouImage: ReturnType<typeof buildSectionImages>['thankYouImage'],
) {
	const { data, normalizedPreset } = context;
	if (!data.thankYou) return undefined;

	return {
		...data.thankYou,
		image: thankYouImage,
		focalPoint: data.thankYou.focalPoint,
		variant: pickVariant(
			'sectionStyles.thankYou.variant',
			data.sectionStyles?.thankYou?.variant,
			THEME_PRESETS,
			normalizedPreset,
		),
	};
}
