import {
	getCommonAsset,
	getEventAsset,
	isCommonAssetKey,
	isEventAssetKey,
	isAssetRegistryKey,
	type AssetSource,
	type ImageAsset,
} from '@/lib/assets/asset-registry';
import { buildCanonicalNavigation } from '@/lib/invitation/canonical-navigation';
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';
import { getContentEntrySlug, type EventContentEntry } from '@/lib/content/events';
import type {
	InvitationViewModel,
	HeroViewModel,
	EnvelopeViewModel,
	Interlude,
	VenueEntry,
} from '@/lib/adapters/types';
import type { InterludeInput } from '@/lib/schemas/content/interludes.schema';
import { resolveColorRole } from '@/lib/theme/color-tokens';
import { buildRevealCard } from '@/lib/invitation/reveal-card';
import { DEFAULT_BRANDING_VISIBILITY } from '@/lib/adapters/branding';
import { resolveCountdownTarget } from '@/lib/time/event-time';
import { COUNTDOWN_DEFAULTS } from '@/lib/intake/constants';

const LOCATION_THEME_DEFAULTS: Partial<
	Record<
		ThemePreset,
		{
			introEyebrow: string;
			introHeading: string;
			introLede: string;
			indicationsHeading: string;
		}
	>
> = {
	'enchanted-rose': {
		introEyebrow: 'El camino al palacio',
		introHeading: 'Ubicación',
		introLede:
			'Guarda la ruta y llega con calma a una noche entre rosas, música y luz de velas.',
		indicationsHeading: 'Detalles adicionales',
	},
};

interface AdaptationContext {
	data: EventContentEntry['data'];
	eventSlug: string;
	normalizedPreset: ThemePreset;
}

function pickVenueValue(
	location: EventContentEntry['data']['location'] | undefined,
	key: 'venueName' | 'city',
): string | undefined {
	return location?.reception?.[key] ?? location?.ceremony?.[key];
}

function normalizeAssetSource(source: AssetSource | string | undefined): AssetSource | undefined {
	if (!source) return undefined;
	if (typeof source !== 'string') return source;

	if (isAssetRegistryKey(source)) {
		return { type: 'internal', key: source };
	}

	if (source.startsWith('https://') || source.startsWith('/')) {
		return { type: 'external', src: source };
	}

	throw new Error(`[AssetRegistry] Invalid asset reference "${source}".`);
}

function resolveAsset(
	eventSlug: string,
	source: AssetSource | string | undefined,
	eventTitle: string,
): ImageAsset | undefined {
	const normalizedSource = normalizeAssetSource(source);
	if (!normalizedSource) return undefined;

	if (normalizedSource.type === 'external') {
		return {
			src: normalizedSource.src,
			alt: `Recurso de ${eventTitle}`,
		};
	}

	if (normalizedSource.type === 'uploaded') {
		if ('src' in normalizedSource) {
			return { src: normalizedSource.src, alt: `Imagen de ${eventTitle}` };
		}
		return undefined;
	}

	if (isCommonAssetKey(normalizedSource.key)) {
		return getCommonAsset(normalizedSource.key);
	}

	if (!isEventAssetKey(normalizedSource.key)) {
		return undefined;
	}

	const metadata = getEventAsset(eventSlug, normalizedSource.key);
	if (!metadata) return undefined;

	let alt = `Imagen de ${eventTitle}`;
	if (normalizedSource.key === 'hero') alt = `Portada de ${eventTitle}`;
	else if (normalizedSource.key === 'portrait') alt = `Retrato de ${eventTitle}`;
	else if (normalizedSource.key.startsWith('gallery')) {
		const num = normalizedSource.key.replace('gallery', '');
		alt = `Galería ${num} de ${eventTitle}`;
	} else if (normalizedSource.key.startsWith('interlude')) {
		alt = `Interludio de ${eventTitle}`;
	}

	return { src: metadata, alt };
}

function resolveAssetSrc(eventSlug: string, source: AssetSource | string | undefined): string {
	const asset = resolveAsset(eventSlug, source, '');
	if (!asset) {
		throw new Error(
			`[AssetRegistry] Required asset source is missing for event "${eventSlug}".`,
		);
	}
	return typeof asset.src === 'string' ? asset.src : asset.src.src;
}

function requireAsset(
	eventSlug: string,
	source: AssetSource | string,
	eventTitle: string,
): ImageAsset {
	const asset = resolveAsset(eventSlug, source, eventTitle);
	if (!asset) {
		throw new Error(`[AssetRegistry] Required asset is missing for event "${eventSlug}".`);
	}
	return asset;
}

function pickVariant<T extends string>(
	scope: string,
	candidate: string | undefined,
	allowed: readonly string[],
	fallback: T,
): T {
	if (!candidate) return fallback;
	if (allowed.includes(candidate)) return candidate as T;

	console.warn(
		`[ThemeVariant] Invalid variant "${candidate}" in ${scope}. Using fallback: "${fallback}".`,
	);
	return fallback;
}

function pickPreset(candidate: string | undefined): ThemePreset {
	if (!candidate) return THEME_PRESETS[0];
	if ((THEME_PRESETS as readonly string[]).includes(candidate)) return candidate as ThemePreset;
	throw new Error(
		`[ThemePreset] Invalid preset "${candidate}". Expected one of: ${THEME_PRESETS.join(', ')}.`,
	);
}

function sectionVariant(
	section: string,
	candidate: string | undefined,
	fallback: ThemePreset,
): ThemePreset {
	return pickVariant(`sectionStyles.${section}.variant`, candidate, THEME_PRESETS, fallback);
}

function buildHero(context: AdaptationContext): HeroViewModel {
	const { data, eventSlug, normalizedPreset } = context;
	const preset = pickVariant(
		'hero.variant',
		data.hero.variant ?? normalizedPreset,
		THEME_PRESETS,
		normalizedPreset,
	);
	return {
		name: data.hero.name,
		secondaryName: data.hero.secondaryName,
		label: data.hero.label || 'Invitación Especial',
		nickname: data.hero.nickname,
		date: data.hero.date,
		venueName: pickVenueValue(data.location, 'venueName'),
		backgroundImage: requireAsset(eventSlug, data.hero.backgroundImage, data.title),
		backgroundImageDesktop: data.hero.backgroundImageDesktop
			? { src: resolveAssetSrc(eventSlug, data.hero.backgroundImageDesktop) }
			: undefined,
		backgroundImageMobile: resolveAsset(eventSlug, data.hero.backgroundImageMobile, data.title),
		portrait: resolveAsset(eventSlug, data.hero.portrait, data.title),
		variant: preset,
		focalPoint: data.hero.focalPoint,
		focalPointMobile: data.hero.focalPointMobile,
		focalPointTablet: data.hero.focalPointTablet,
		focalPointDesktop: data.hero.focalPointDesktop,
		scrollLabel: preset === 'enchanted-rose' ? 'Continúa' : undefined,
	};
}

function buildEnvelope(context: AdaptationContext): EnvelopeViewModel {
	const { data, eventSlug, normalizedPreset } = context;

	if (!data.envelope || data.envelope.disabled) return { enabled: false };

	const venueName = pickVenueValue(data.location, 'venueName');
	const venueCity = pickVenueValue(data.location, 'city');
	// Teaser uses lowercase `es-MX` date ("25 abr 2026 • Venue") intentionally
	// distinct from the reveal-card's uppercase dot-separated format ("25 · ABR · 2026").
	const teaserDate = new Intl.DateTimeFormat('es-MX', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(new Date(data.hero.date));
	const teaserDetails = venueName
		? `${teaserDate} • ${venueName}`
		: venueCity
			? `${teaserDate} • ${venueCity}`
			: teaserDate;

	return {
		enabled: true,
		data: {
			teaserDetails,
			sealStyle: data.envelope.sealStyle,
			sealIcon: data.envelope.sealIcon,
			sealInitials: data.envelope.sealInitials,
			sealVariant: data.envelope.sealVariant,
			sealImage:
				data.envelope.sealVariant === 'premium-rose'
					? resolveAsset(eventSlug, 'sealImage', data.title)
					: undefined,
			microcopy: data.envelope.microcopy,
			documentLabel: data.envelope.documentLabel,
			stampText: data.envelope.stampText,
			stampYear: data.envelope.stampYear,
			tooltipText: data.envelope.tooltipText,
			variant: normalizedPreset,
			card: buildRevealCard({
				name: data.hero.name,
				date: data.hero.date,
				label: data.envelope.cardLabel ?? data.envelope.documentLabel,
				tagline: data.envelope.cardTagline,
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
		},
	};
}

function buildInterludes(context: AdaptationContext): Interlude[] {
	const { data, eventSlug } = context;
	if (!data.interludes) return [];

	return data.interludes
		.map((interlude: InterludeInput): Interlude | null => {
			const resolvedImage = resolveAsset(eventSlug, interlude.image, data.title);
			if (!resolvedImage) {
				console.warn(
					`[Interlude] Failed to resolve image "${interlude.image}" for event "${eventSlug}". skipping interludes.`,
				);
				return null;
			}
			return {
				afterSection: interlude.afterSection,
				alt: interlude.alt,
				height: interlude.height,
				variant: interlude.variant,
				focalPoint: interlude.focalPoint,
				lightX: interlude.lightX,
				lightY: interlude.lightY,
				overlayOpacity: interlude.overlayOpacity,
				image: resolvedImage,
			};
		})
		.filter((i: Interlude | null): i is Interlude => i !== null);
}

function buildQuoteSectionData(context: AdaptationContext) {
	const { data, normalizedPreset } = context;
	if (!data.quote) return undefined;
	return {
		...data.quote,
		variant: sectionVariant('quote', data.sectionStyles?.quote?.variant, normalizedPreset),
	};
}

function buildCountdownSectionData(context: AdaptationContext) {
	const { data, normalizedPreset } = context;

	const target = resolveCountdownTarget(data.eventTiming, data.hero.date);
	if (!target) return undefined;

	const title = data.countdown?.title ?? COUNTDOWN_DEFAULTS.title;
	const footerText =
		data.countdown?.footerText ??
		formatVenueLocation(data.location) ??
		COUNTDOWN_DEFAULTS.footerText;

	return {
		title,
		footerText,
		targetIso: target.targetIso,
		targetSource: target.source,
		eventTimeZone: data.eventTiming?.timeZone,
		variant: sectionVariant(
			'countdown',
			data.sectionStyles?.countdown?.variant,
			normalizedPreset,
		),
	};
}

function formatVenueLocation(
	location: EventContentEntry['data']['location'] | undefined,
): string | undefined {
	const venueName = pickVenueValue(location, 'venueName');
	const city = pickVenueValue(location, 'city');
	if (venueName && city) return `${venueName} · ${city}`;
	if (city) return city;
	return undefined;
}

function resolveVenueData(
	eventSlug: string,
	venue: NonNullable<EventContentEntry['data']['location']>['ceremony'],
	title: string,
) {
	if (!venue) return undefined;
	return {
		...venue,
		image: resolveAsset(eventSlug, venue.image, title),
	};
}

function buildLocationSectionData(context: AdaptationContext) {
	const { data, eventSlug, normalizedPreset } = context;
	if (!data.location) return undefined;

	const themeDefaults = LOCATION_THEME_DEFAULTS[normalizedPreset];

	const rawVenues = data.location.venues;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const venues: VenueEntry[] | undefined = (rawVenues as any[])?.map((v) => ({
		id: v.id,
		type: v.type,
		label: v.label,
		isVisible: v.isVisible,
		sortOrder: v.sortOrder,
		venueEvent: v.venueEvent,
		venueName: v.venueName,
		address: v.address,
		city: v.city,
		date: v.date,
		time: v.time,
		mapUrl: v.mapUrl,
		appleMapsUrl: v.appleMapsUrl,
		googleMapsUrl: v.googleMapsUrl,
		wazeUrl: v.wazeUrl,
		coordinates: v.coordinates,
		image: resolveAsset(eventSlug, v.image, data.title),
	}));

	return {
		visibility: data.location.visibility,
		...(rawVenues !== undefined
			? { venues }
			: {
					ceremony: resolveVenueData(eventSlug, data.location.ceremony, data.title),
					reception: resolveVenueData(eventSlug, data.location.reception, data.title),
				}),
		indications: data.location.indications,
		variant: sectionVariant(
			'location',
			data.sectionStyles?.location?.variant,
			normalizedPreset,
		),
		showFlourishes: data.sectionStyles?.location?.showFlourishes,
		introEyebrow: data.location.introEyebrow ?? themeDefaults?.introEyebrow,
		introHeading: data.location.introHeading ?? themeDefaults?.introHeading,
		introLede: data.location.introLede ?? themeDefaults?.introLede,
		indicationsHeading:
			data.location.indicationsHeading ?? themeDefaults?.indicationsHeading ?? '',
	};
}

function buildFamilySectionData(context: AdaptationContext) {
	const { data, eventSlug, normalizedPreset } = context;
	if (!data.family) return undefined;
	return {
		...data.family,
		featuredImage: data.family.featuredImage
			? resolveAsset(eventSlug, data.family.featuredImage, data.title)
			: undefined,
		celebrantName: data.hero.name,
		variant: sectionVariant('family', data.sectionStyles?.family?.variant, normalizedPreset),
	};
}

function buildGallerySectionData(context: AdaptationContext) {
	const { data, eventSlug } = context;
	if (!data.gallery) return undefined;
	const items = data.gallery.items
		.map((item: { image: string | AssetSource; caption?: string; focalPoint?: string }) => {
			const resolved = resolveAsset(eventSlug, item.image, data.title);
			if (!resolved) {
				console.warn(
					`[AssetRegistry] Gallery image not resolvable for event "${eventSlug}", skipping item.`,
				);
				return null;
			}
			return {
				...item,
				key: typeof item.image === 'string' ? item.image : undefined,
				image: resolved,
			};
		})
		.filter(<T>(i: T | null): i is T => i !== null);
	if (items.length === 0) return undefined;
	return {
		...data.gallery,
		items,
		variant:
			data.gallery.variant ??
			sectionVariant(
				'gallery',
				data.sectionStyles?.gallery?.variant,
				context.normalizedPreset,
			),
	};
}

function buildItinerarySectionData(context: AdaptationContext) {
	const { data, normalizedPreset } = context;
	if (!data.itinerary) return undefined;

	return {
		...data.itinerary,
		variant: sectionVariant(
			'itinerary',
			data.sectionStyles?.itinerary?.variant,
			normalizedPreset,
		),
	};
}

function buildRsvpSectionData(context: AdaptationContext, eventSlug: string) {
	const { data, normalizedPreset } = context;
	if (!data.rsvp) return undefined;
	return {
		...data.rsvp,
		eventSlug,
		eventType: data.eventType,
		variant: sectionVariant('rsvp', data.sectionStyles?.rsvp?.variant, normalizedPreset),
		labels: data.sectionStyles?.rsvp?.labels,
	};
}

function buildGiftsSectionData(context: AdaptationContext) {
	const { data, normalizedPreset } = context;
	if (!data.gifts) return undefined;
	return {
		...data.gifts,
		variant: sectionVariant('gifts', data.sectionStyles?.gifts?.variant, normalizedPreset),
	};
}

function buildThankYouSectionData(context: AdaptationContext) {
	const { data, eventSlug, normalizedPreset } = context;
	if (!data.thankYou) return undefined;
	return {
		...data.thankYou,
		image: data.thankYou.image
			? resolveAsset(eventSlug, data.thankYou.image, data.title)
			: undefined,
		variant: sectionVariant(
			'thankYou',
			data.sectionStyles?.thankYou?.variant,
			normalizedPreset,
		),
	};
}

export function adaptEvent(
	event: EventContentEntry,
	previewTheme?: ThemePreset,
	assetSlugOverride?: string,
): InvitationViewModel {
	const { data: originalData, id: contentEntryId } = event;
	const entrySlug = getContentEntrySlug(contentEntryId);
	const contentAssetSlug =
		typeof originalData._assetSlug === 'string' ? originalData._assetSlug : undefined;
	const eventSlug = assetSlugOverride ?? contentAssetSlug ?? entrySlug;

	const adapterData = previewTheme
		? {
				...originalData,
				theme: { ...originalData.theme, preset: previewTheme },
				sectionStyles: {},
			}
		: originalData;

	const normalizedPreset = pickPreset(adapterData.theme.preset);
	const context: AdaptationContext = {
		data: adapterData,
		eventSlug,
		normalizedPreset,
	};

	const envelope = buildEnvelope(context);
	const isDemo = adapterData.isDemo ?? false;

	const sections = {
		quote: buildQuoteSectionData(context),
		countdown: buildCountdownSectionData(context),
		location: buildLocationSectionData(context),
		family: buildFamilySectionData(context),
		gallery: buildGallerySectionData(context),
		itinerary: buildItinerarySectionData(context),
		rsvp: buildRsvpSectionData(context, entrySlug),
		gifts: buildGiftsSectionData(context),
		thankYou: buildThankYouSectionData(context),
	};

	// Ensure synthesized sections (e.g. countdown derived from eventTiming alone)
	// appear in the render plan even when the stored sectionOrder omits them.
	let resolvedSectionOrder = adapterData.sectionOrder;
	if (resolvedSectionOrder && sections.countdown && !resolvedSectionOrder.includes('countdown')) {
		const locIdx = resolvedSectionOrder.indexOf('location');
		resolvedSectionOrder =
			locIdx !== -1
				? [
						...resolvedSectionOrder.slice(0, locIdx),
						'countdown',
						...resolvedSectionOrder.slice(locIdx),
					]
				: [...resolvedSectionOrder, 'countdown'];
	}

	return {
		id: entrySlug,
		isDemo,
		title: adapterData.title,
		description: adapterData.description,
		theme: {
			preset: normalizedPreset,
			themeClass: `theme-preset--${normalizedPreset}`,
		},
		hero: buildHero(context),
		envelope,
		brandingVisibility: DEFAULT_BRANDING_VISIBILITY,
		sectionOrder: resolvedSectionOrder,
		sections,
		music: adapterData.music
			? {
					...adapterData.music,
					revealMode: envelope.enabled ? 'envelope' : 'immediate',
				}
			: undefined,
		interludes: buildInterludes(context),
		navigation: buildCanonicalNavigation(sections, entrySlug),
		sharing: adapterData.sharing
			? {
					whatsappTemplate: adapterData.sharing.whatsappTemplate,
					shareMessages: adapterData.sharing.shareMessages,
					ogImage: adapterData.sharing.ogImage
						? resolveAsset(eventSlug, adapterData.sharing.ogImage, adapterData.title)
						: undefined,
					ogDescription:
						typeof adapterData.sharing.ogDescription === 'string'
							? adapterData.sharing.ogDescription
							: undefined,
				}
			: undefined,
	};
}
