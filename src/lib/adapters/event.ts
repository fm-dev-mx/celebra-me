import type { CollectionEntry } from 'astro:content';
import { getEventAsset, type EventAssetKey, type ImageAsset } from '@/lib/assets/asset-registry';
import type { InvitationViewModel, ThemeConfig, HeroViewModel, EnvelopeViewModel } from './types';
import {
	COUNTDOWN_VARIANTS,
	ITINERARY_VARIANTS,
	LEGACY_INDICATION_ICON_MAP,
	LOCATION_VARIANTS,
	QUOTE_VARIANTS,
	SHARED_SECTION_VARIANTS,
	THEME_PRESETS,
	type IndicationIconKey,
	type ThemePreset,
} from '@/lib/theme/theme-contract';

function pickVariant<T extends readonly string[]>(
	scope: string,
	candidate: string | undefined,
	allowed: T,
	fallback: T[number],
): T[number] {
	if (!candidate) return fallback;
	if ((allowed as readonly string[]).includes(candidate)) return candidate as T[number];
	console.warn(
		`[ThemeVariant] Invalid variant "${candidate}" in ${scope}. Fallback applied: "${fallback}".`,
	);
	return fallback;
}

function pickPreset(candidate: string | undefined): ThemePreset {
	if (!candidate) return THEME_PRESETS[0];
	if ((THEME_PRESETS as readonly string[]).includes(candidate)) return candidate as ThemePreset;

	if (import.meta.env.PROD) {
		throw new Error(`[ThemePreset] Invalid preset "${candidate}" in theme.preset.`);
	}

	console.warn(
		`[ThemePreset] Invalid preset "${candidate}". Using fallback "${THEME_PRESETS[0]}".`,
	);
	return THEME_PRESETS[0];
}

function hexToRgb(hex: string): string {
	hex = hex.replace(/^#/, '');
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((char) => char + char)
			.join('');
	}
	const bigint = parseInt(hex, 16);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return `${r}, ${g}, ${b}`;
}

function resolveAsset(eventSlug: string, keyOrUrl: string | undefined): ImageAsset | undefined {
	if (!keyOrUrl) return undefined;

	if (keyOrUrl.startsWith('http') || keyOrUrl.startsWith('/')) {
		return {
			src: keyOrUrl,
			alt: 'Recurso del evento',
		};
	}

	return getEventAsset(eventSlug, keyOrUrl as EventAssetKey);
}

function requireAsset(eventSlug: string, keyOrUrl: string): ImageAsset {
	const asset = resolveAsset(eventSlug, keyOrUrl);
	if (!asset) {
		console.warn(`[AssetWarning] Asset not found for key: ${keyOrUrl} in event ${eventSlug}`);
		return { src: '', alt: 'Recurso faltante' };
	}
	return asset;
}

export function adaptEvent(event: CollectionEntry<'events'>): InvitationViewModel {
	const { data, id: eventSlug } = event;
	const isDemo = data.isDemo ?? false;
	const normalizedPreset = pickPreset(data.theme.preset);

	const primaryColorRgb = hexToRgb(data.theme.primaryColor);
	const accentColorRgb = hexToRgb(data.theme.accentColor || '#333333');

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

	const heroBg = requireAsset(eventSlug, data.hero.backgroundImage);
	const heroPortrait = resolveAsset(eventSlug, data.hero.portrait);
	const hero: HeroViewModel = {
		name: data.hero.name,
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
			image: requireAsset(eventSlug, item.image),
		})) || [];

	const familyImage = data.family?.featuredImage
		? resolveAsset(eventSlug, data.family.featuredImage)
		: undefined;

	const thankYouImage = data.thankYou?.image
		? resolveAsset(eventSlug, data.thankYou.image)
		: undefined;

	const ceremony = data.location.ceremony
		? {
				...data.location.ceremony,
				image: resolveAsset(eventSlug, data.location.ceremony.image as string),
			}
		: undefined;

	const reception = data.location.reception
		? {
				...data.location.reception,
				image: data.location.reception.image,
			}
		: undefined;

	const locationIndications = data.location.indications?.map(
		(indication: NonNullable<typeof data.location.indications>[number]) => {
			if (!indication.iconName && indication.icon === 'dress' && import.meta.env.DEV) {
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
							data.sectionStyles?.itinerary?.variant ?? normalizedPreset,
							ITINERARY_VARIANTS,
							normalizedPreset,
						),
					}
				: undefined,
			rsvp:
				data.sections?.rsvp && data.rsvp
					? {
							...data.rsvp,
							eventSlug,
							celebrantName: data.hero.nickname || data.hero.name.split(' ')[0],
							variant: pickVariant(
								'sectionStyles.rsvp.variant',
								data.sectionStyles?.rsvp?.variant ?? normalizedPreset,
								SHARED_SECTION_VARIANTS,
								normalizedPreset,
							),
							nameLabel:
								data.sectionStyles?.rsvp?.labels?.name ??
								data.sectionStyles?.rsvp?.nameLabel,
							guestCountLabel:
								data.sectionStyles?.rsvp?.labels?.guestCount ??
								data.sectionStyles?.rsvp?.guestCountLabel,
							attendanceLabel: data.sectionStyles?.rsvp?.labels?.attendance,
							buttonLabel:
								data.sectionStyles?.rsvp?.labels?.confirmButton ??
								data.sectionStyles?.rsvp?.buttonLabel,
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
		navigation: data.navigation,
	};
}
