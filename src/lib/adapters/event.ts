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
import { resolveColorToken, PRESET_COLOR_MAP } from '@/lib/theme/color-tokens';
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

	const primaryColorHex = resolveColorToken(
		data.theme.primaryColor || 'primary',
		normalizedPreset,
	);
	const accentColorHex = resolveColorToken(data.theme.accentColor || 'accent', normalizedPreset);
	const primaryColorRgb = hexToRgb(primaryColorHex);
	const accentColorRgb = hexToRgb(accentColorHex);
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
	const quoteFallback = (QUOTE_VARIANTS as readonly string[]).includes(normalizedPreset)
		? normalizedPreset
		: 'elegant';
	const countdownFallback = (COUNTDOWN_VARIANTS as readonly string[]).includes(normalizedPreset)
		? normalizedPreset
		: 'minimal';
	const locationFallback = (LOCATION_VARIANTS as readonly string[]).includes(normalizedPreset)
		? normalizedPreset
		: 'structured';

	const presetMap = PRESET_COLOR_MAP[normalizedPreset] || PRESET_COLOR_MAP['jewelry-box'];
	const rawTokens: Record<string, string> = { ...presetMap };
	const rgbColors: { primaryRgb: string; accentRgb: string; [key: string]: string } = {
		primaryRgb: primaryColorRgb,
		accentRgb: accentColorRgb,
	};

	// Generate RGB equivalents for all properties
	for (const [key, value] of Object.entries(rawTokens)) {
		if (value.startsWith('#')) {
			rgbColors[`${key}Rgb`] = hexToRgb(value);
		}
	}

	const theme: ThemeConfig = {
		primaryColor: primaryColorHex,
		accentColor: accentColorHex,
		fontFamily: data.theme.fontFamily,
		preset: normalizedPreset,
		themeClass: `theme-preset--${normalizedPreset}`,
		tokens: rawTokens,
		colors: rgbColors,
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
		layoutVariant: data.hero.layoutVariant,
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
							background: resolveColorToken(
								data.envelope.closedPalette?.background || 'surfacePrimary',
								normalizedPreset,
							),
							primary: resolveColorToken(
								data.envelope.closedPalette?.primary || 'actionPrimary',
								normalizedPreset,
							),
							accent: resolveColorToken(
								data.envelope.closedPalette?.accent || 'actionAccent',
								normalizedPreset,
							),
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
					variant: pickVariant(
						'contentBlocks.interlude.variant',
						block.variant ?? sharedSectionFallback,
						SHARED_SECTION_VARIANTS,
						sharedSectionFallback,
					),
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
							data.sectionStyles?.quote?.variant ?? quoteFallback,
							QUOTE_VARIANTS,
							quoteFallback,
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
								data.sectionStyles?.countdown?.variant ?? countdownFallback,
								COUNTDOWN_VARIANTS,
								countdownFallback,
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
					data.sectionStyles?.location?.variant ?? locationFallback,
					LOCATION_VARIANTS,
					locationFallback,
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
							data.sectionStyles?.family?.variant ?? sharedSectionFallback,
							SHARED_SECTION_VARIANTS,
							sharedSectionFallback,
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
								data.sectionStyles?.gallery?.variant ?? sharedSectionFallback,
								SHARED_SECTION_VARIANTS,
								sharedSectionFallback,
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
								data.sectionStyles?.gifts?.variant ?? sharedSectionFallback,
								SHARED_SECTION_VARIANTS,
								sharedSectionFallback,
							),
						}
					: undefined,
			thankYou: data.thankYou
				? {
						...data.thankYou,
						image: thankYouImage,
						variant: pickVariant(
							'sectionStyles.thankYou.variant',
							data.sectionStyles?.thankYou?.variant ?? sharedSectionFallback,
							SHARED_SECTION_VARIANTS,
							sharedSectionFallback,
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
