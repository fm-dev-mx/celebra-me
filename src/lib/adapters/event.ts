import type {
	InvitationViewModel,
	ThemeConfig,
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
	type ItineraryVariant,
	type SharedSectionVariant,
} from '@/lib/theme/theme-contract';
import { getContentEntrySlug, type EventContentEntry } from '@/lib/content/events';
import {
	pickVariant,
	pickPreset,
	hexToRgb,
	resolveAsset,
	requireAsset,
	runtimeEnv,
} from './event-helpers';

type RawContentBlock = NonNullable<EventContentEntry['data']['contentBlocks']>[number];

export function adaptEvent(event: EventContentEntry): InvitationViewModel {
	const { data, id: contentEntryId } = event;
	const eventSlug = getContentEntrySlug(contentEntryId);
	const isDemo = data.isDemo ?? false;
	const normalizedPreset = pickPreset(data.theme.preset);

	const primaryColorRgb = hexToRgb(data.theme.primaryColor);
	const accentColorRgb = hexToRgb(data.theme.accentColor || '#333333');
	const itineraryFallback = (
		(ITINERARY_VARIANTS as readonly string[]).includes(normalizedPreset)
			? normalizedPreset
			: 'base'
	) as ItineraryVariant;
	const sharedSectionFallback = (
		(SHARED_SECTION_VARIANTS as readonly string[]).includes(normalizedPreset)
			? normalizedPreset
			: 'standard'
	) as SharedSectionVariant;

	const theme: ThemeConfig = {
		primaryColor: data.theme.primaryColor,
		accentColor: data.theme.accentColor,
		fontFamily: data.theme.fontFamily,
		preset: normalizedPreset,
		themeClass: `theme-preset--${normalizedPreset}`,
		colors: {
			primaryRgb: primaryColorRgb,
			accentRgb: accentColorRgb,
		},
	};

	const heroBg = requireAsset(eventSlug, data.hero.backgroundImage, data.title);
	const heroPortrait = resolveAsset(eventSlug, data.hero.portrait, data.title);
	const hero: HeroViewModel = {
		name: data.hero.name,
		secondaryName: data.hero.secondaryName,
		label: data.hero.label || 'Invitación Especial',
		nickname: data.hero.nickname,
		date: data.hero.date,
		venueName: data.location.venueName,
		backgroundImage: heroBg,
		portrait: heroPortrait,
		variant: pickVariant(
			'hero.variant',
			data.hero.variant ?? normalizedPreset,
			THEME_PRESETS,
			normalizedPreset,
		),
	};

	const showEnvelope = !!(data.envelope && !data.envelope.disabled);
	const envelope: EnvelopeViewModel = {
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
							background: data.envelope.closedPalette.background,
							primary: data.envelope.closedPalette.primary,
							accent: data.envelope.closedPalette.accent,
						},
					}
				: undefined,
	};

	const galleryItems =
		data.gallery?.items.map((item: { image: string; caption?: string }) => ({
			...item,
			image: requireAsset(eventSlug, item.image, data.title),
		})) || [];

	const familyImage = data.family?.featuredImage
		? resolveAsset(eventSlug, data.family.featuredImage, data.title)
		: undefined;

	const thankYouImage = data.thankYou?.image
		? resolveAsset(eventSlug, data.thankYou.image, data.title)
		: undefined;

	const ceremony = data.location.ceremony
		? {
				...data.location.ceremony,
				image: resolveAsset(eventSlug, data.location.ceremony.image as string, data.title),
			}
		: undefined;

	const reception = data.location.reception
		? {
				...data.location.reception,
				image: resolveAsset(eventSlug, data.location.reception.image as string, data.title),
			}
		: undefined;

	const locationIndications = data.location.indications?.map(
		(indication: NonNullable<typeof data.location.indications>[number]) => {
			if (!indication.iconName && indication.icon === 'dress' && runtimeEnv.DEV) {
				console.warn(
					'[EventAdapter] Legacy indication icon "dress" detected. Use indication.iconName for explicit icon semantics.',
				);
			}

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

	const contentBlocks: ContentBlock[] | undefined = data.contentBlocks?.flatMap(
		(block: RawContentBlock): ContentBlock[] => {
			if (block.type === 'section') {
				return [{ type: 'section', section: block.section as ContentSectionKey }];
			}

			const image = resolveAsset(eventSlug, block.image, data.title);
			if (!image) return [];

			return [
				{
					type: 'interlude',
					image,
					alt: block.alt || `Interludio de ${data.title}`,
					height: block.height,
				},
			];
		},
	);

	return {
		id: eventSlug,
		isDemo,
		title: data.title,
		description: data.description,
		theme,
		hero,
		envelope,
		sections: {
			quote: data.quote
				? {
						...data.quote,
						variant: pickVariant(
							'sectionStyles.quote.variant',
							data.sectionStyles?.quote?.variant,
							QUOTE_VARIANTS,
							'elegant',
						),
						animation: data.sectionStyles?.quote?.animation,
					}
				: undefined,
			countdown:
				data.sections?.countdown && data.countdown
					? {
							...data.countdown,
							eventDate: data.hero.date,
							variant: pickVariant(
								'sectionStyles.countdown.variant',
								data.sectionStyles?.countdown?.variant,
								COUNTDOWN_VARIANTS,
								'minimal',
							),
							showParticles: data.sectionStyles?.countdown?.showParticles,
						}
					: undefined,
			location: {
				ceremony,
				reception,
				indications: locationIndications,
				variant: pickVariant(
					'sectionStyles.location.variant',
					data.sectionStyles?.location?.variant,
					LOCATION_VARIANTS,
					'structured',
				),
				mapStyle: data.sectionStyles?.location?.mapStyle,
				showFlourishes: data.sectionStyles?.location?.showFlourishes,
				city: data.location.city,
				venueName: data.location.venueName,
			},
			family: data.family
				? {
						...data.family,
						godparents: data.family.godparents,
						groups: data.family.groups,
						featuredImage: familyImage,
						celebrantName: data.hero.name,
						variant: pickVariant(
							'sectionStyles.family.variant',
							data.sectionStyles?.family?.variant,
							SHARED_SECTION_VARIANTS,
							'standard',
						),
					}
				: undefined,
			gallery:
				data.sections?.gallery && data.gallery
					? {
							...data.gallery,
							items: galleryItems,
							variant: pickVariant(
								'sectionStyles.gallery.variant',
								data.sectionStyles?.gallery?.variant,
								SHARED_SECTION_VARIANTS,
								'standard',
							),
						}
					: undefined,
			itinerary: data.itinerary
				? {
						...data.itinerary,
						variant: pickVariant(
							'sectionStyles.itinerary.variant',
							data.sectionStyles?.itinerary?.variant ?? itineraryFallback,
							ITINERARY_VARIANTS,
							itineraryFallback,
						),
					}
				: undefined,
			rsvp:
				data.sections?.rsvp && data.rsvp
					? {
							...data.rsvp,
							eventSlug,
							celebrantName:
								data.hero.nickname ||
								(data.hero.secondaryName
									? `${data.hero.name} & ${data.hero.secondaryName}`
									: data.hero.name.split(' ')[0]),
							variant: pickVariant(
								'sectionStyles.rsvp.variant',
								data.sectionStyles?.rsvp?.variant ?? sharedSectionFallback,
								SHARED_SECTION_VARIANTS,
								sharedSectionFallback,
							),
							nameLabel:
								data.sectionStyles?.rsvp?.labels?.name ??
								data.sectionStyles?.rsvp?.legacy?.nameLabel,
							guestCountLabel:
								data.sectionStyles?.rsvp?.labels?.guestCount ??
								data.sectionStyles?.rsvp?.legacy?.guestCountLabel,
							attendanceLabel: data.sectionStyles?.rsvp?.labels?.attendance,
							buttonLabel:
								data.sectionStyles?.rsvp?.labels?.confirmButton ??
								data.sectionStyles?.rsvp?.legacy?.buttonLabel,
						}
					: undefined,
			gifts:
				data.sections?.gifts && data.gifts
					? {
							...data.gifts,
							variant: pickVariant(
								'sectionStyles.gifts.variant',
								data.sectionStyles?.gifts?.variant,
								SHARED_SECTION_VARIANTS,
								'standard',
							),
						}
					: undefined,
			thankYou: data.thankYou
				? {
						...data.thankYou,
						image: thankYouImage,
						variant: pickVariant(
							'sectionStyles.thankYou.variant',
							data.sectionStyles?.thankYou?.variant,
							SHARED_SECTION_VARIANTS,
							'standard',
						),
					}
				: undefined,
		},
		music: data.music
			? {
					...data.music,
					revealMode: showEnvelope ? 'envelope' : 'immediate',
				}
			: undefined,
		contentBlocks,
		navigation: data.navigation,
	};
}
