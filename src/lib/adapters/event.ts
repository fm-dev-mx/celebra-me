import type { CollectionEntry } from 'astro:content';
import { getEventAsset, type EventAssetKey, type ImageAsset } from '@/lib/assets/AssetRegistry';
import type { InvitationViewModel, ThemeConfig, HeroViewModel, EnvelopeViewModel } from './types';

// --- Helpers ---

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

	// If it's a URL (cloud or external), return as ImageAsset
	if (keyOrUrl.startsWith('http') || keyOrUrl.startsWith('/')) {
		return {
			src: keyOrUrl,
			alt: 'Recurso del evento',
		};
	}

	// Otherwise treat as registry key
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

// --- Main Adapter ---

export function adaptEvent(event: CollectionEntry<'events'>): InvitationViewModel {
	const { data, id: eventSlug } = event;
	const preset = data.theme.preset;

	// --- Theme Processing ---
	const primaryColorRgb = hexToRgb(data.theme.primaryColor);
	const accentColorRgb = hexToRgb(data.theme.accentColor || '#333333');

	const theme: ThemeConfig = {
		primaryColor: data.theme.primaryColor,
		accentColor: data.theme.accentColor,
		fontFamily: data.theme.fontFamily,
		preset: preset,
		themeClass: preset ? `theme-preset--${preset}` : '',
		colors: {
			primaryRgb: primaryColorRgb,
			accentRgb: accentColorRgb,
		},
	};

	// --- Hero Processing ---
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
		variant: (preset || data.hero.variant) as 'jewelry-box' | 'luxury-hacienda',
	};

	// --- Envelope Processing ---
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
						variant: data.envelope.variant || preset,
						colors: {
							background: data.envelope.closedPalette.background,
							primary: data.envelope.closedPalette.primary,
							accent: data.envelope.closedPalette.accent,
						},
					}
				: undefined,
	};

	// --- Sections Processing ---

	// Gallery
	const galleryItems =
		data.gallery?.items.map((item: any) => ({
			...item,
			image: requireAsset(eventSlug, item.image as string),
		})) || [];

	// Family
	const familyImage = data.family?.featuredImage
		? resolveAsset(eventSlug, data.family.featuredImage)
		: undefined;

	// Thank You
	const thankYouImage = data.thankYou?.image
		? resolveAsset(eventSlug, data.thankYou.image)
		: undefined;

	// Location Images
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

	return {
		id: eventSlug,
		title: data.title,
		description: data.description,
		theme,
		hero,
		envelope,
		sections: {
			quote: data.quote
				? {
						...data.quote,
						variant: data.sectionStyles?.quote?.variant as
							| 'elegant'
							| 'modern'
							| 'minimal'
							| 'floral'
							| 'jewelry-box'
							| 'luxury-hacienda',
						animation: data.sectionStyles?.quote?.animation,
					}
				: undefined,
			countdown:
				data.sections?.countdown && data.countdown
					? {
							...data.countdown,
							eventDate: data.hero.date,
							variant: data.sectionStyles?.countdown?.variant as
								| 'minimal'
								| 'vibrant'
								| 'classic'
								| 'modern'
								| 'jewelry-box'
								| 'luxury-hacienda',
							showParticles: data.sectionStyles?.countdown?.showParticles,
						}
					: undefined,
			location: {
				ceremony,
				reception,
				indications: data.location.indications,
				variant: data.sectionStyles?.location?.variant as
					| 'structured'
					| 'organic'
					| 'minimal'
					| 'luxury'
					| 'jewelry-box'
					| 'luxury-hacienda',
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
						variant: data.sectionStyles?.family?.variant as
							| 'standard'
							| 'jewelry-box'
							| 'luxury-hacienda',
					}
				: undefined,
			gallery:
				data.sections?.gallery && data.gallery
					? {
							...data.gallery,
							items: galleryItems,
							variant: data.sectionStyles?.gallery?.variant as
								| 'standard'
								| 'jewelry-box'
								| 'luxury-hacienda',
						}
					: undefined,
			itinerary: data.itinerary
				? {
						...data.itinerary,
						variant: (data.sectionStyles?.itinerary?.variant ?? preset) as
							| 'base'
							| 'jewelry-box'
							| 'luxury-hacienda',
					}
				: undefined,
			rsvp:
				data.sections?.rsvp && data.rsvp
					? {
							...data.rsvp,
							eventSlug,
							celebrantName: data.hero.nickname || data.hero.name.split(' ')[0],
							variant: (data.sectionStyles?.rsvp?.variant ?? preset) as
								| 'standard'
								| 'jewelry-box'
								| 'luxury-hacienda',
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
							variant: data.sectionStyles?.gifts?.variant as
								| 'standard'
								| 'jewelry-box'
								| 'luxury-hacienda',
						}
					: undefined,
			thankYou: data.thankYou
				? {
						...data.thankYou,
						image: thankYouImage,
						variant: data.sectionStyles?.thankYou?.variant as
							| 'standard'
							| 'jewelry-box'
							| 'luxury-hacienda',
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
