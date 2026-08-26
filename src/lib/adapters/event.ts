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
import {
	THEME_PRESETS,
	type ItineraryVariant,
	type ThemePreset,
	themeSupportsPortrait,
} from '@/lib/theme/theme-contract';
import { getContentEntrySlug, type EventContentEntry } from '@/lib/content/events';
import type {
	InvitationViewModel,
	HeroViewModel,
	EnvelopeViewModel,
	Interlude,
	VenueEntry,
} from '@/lib/adapters/types';
import type { InterludeInput } from '@/lib/schemas/content/interludes.schema';
import type { VenueEntryInput } from '@/lib/schemas/content/location.schema';
import { resolveColorRole } from '@/lib/theme/color-tokens';
import { buildOpeningViewModel } from '@/lib/invitation/reveal-card';
import { DEFAULT_BRANDING_VISIBILITY } from '@/lib/adapters/branding';
import { resolveCountdownTarget } from '@/lib/time/event-time';
import { COUNTDOWN_DEFAULTS } from '@/lib/intake/constants';
import { resolveCountdownVisibleUnits } from '@/lib/invitation/countdown-presentation';
import { resolveGalleryMobileBrowse } from '@/lib/invitation/gallery-presentation';
import { resolveGiftsPresentation } from '@/lib/invitation/gifts-presentation';
import { resolvePortraitEnabled } from '@/lib/invitation/hero-presentation';
import { hasPlayableMusicUrl } from '@/lib/invitation/local-preview-config';
import {
	resolveLocationShowFlourishes,
	resolveLocationShowNavigationButtons,
} from '@/lib/invitation/location-presentation';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import type { z } from 'zod';

type CanonicalEventContent = z.output<typeof eventContentSchema>;

interface AdaptationContext {
	data: CanonicalEventContent;
	eventSlug: string;
	normalizedPreset: ThemePreset;
}

function pickVenueValue(
	location: CanonicalEventContent['location'] | undefined,
	key: 'venueName' | 'city',
): string | undefined {
	if (!location) return undefined;
	const venues = location.venues;
	const reception = venues.find((v) => v.type === 'reception' && v.isVisible !== false);
	if (reception?.[key]) return reception[key];
	const ceremony = venues.find((v) => v.type === 'ceremony' && v.isVisible !== false);
	if (ceremony?.[key]) return ceremony[key];
	const fallback = venues.find((v) => v.isVisible !== false) ?? venues[0];
	return fallback?.[key];
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

function pickPreset(candidate: string | undefined): ThemePreset {
	if (!candidate) return THEME_PRESETS[0];
	if ((THEME_PRESETS as readonly string[]).includes(candidate)) return candidate as ThemePreset;
	throw new Error(
		`[ThemePreset] Invalid preset "${candidate}". Expected one of: ${THEME_PRESETS.join(', ')}.`,
	);
}

function buildHero(context: AdaptationContext): HeroViewModel {
	const { data, eventSlug, normalizedPreset } = context;
	const preset = normalizedPreset;
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
		portrait: resolvePortraitEnabled(data.hero.presentation, themeSupportsPortrait(preset))
			? resolveAsset(eventSlug, data.hero.portrait, data.title)
			: undefined,
		variant: data.hero.variant,
		focalPoint: data.hero.focalPoint,
		focalPointMobile: data.hero.focalPointMobile,
		focalPointTablet: data.hero.focalPointTablet,
		focalPointDesktop: data.hero.focalPointDesktop,
		scrollLabel: data.hero.scrollLabel,
	};
}

function buildEnvelope(context: AdaptationContext): EnvelopeViewModel {
	const { data, eventSlug, normalizedPreset } = context;

	if (!data.envelope || data.envelope.disabled) return { enabled: false };
	const opening = buildOpeningViewModel({
		hero: data.hero,
		envelope: data.envelope,
	});

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
	const derivedTeaser = venueName
		? `${teaserDate} • ${venueName}`
		: venueCity
			? `${teaserDate} • ${venueCity}`
			: teaserDate;
	// Explicit `teaserDetails`, including '', is authorial. Empty omits the
	// closed date/venue line the same way `microcopy: ''` omits the CTA.
	const teaserDetails =
		typeof data.envelope.teaserDetails === 'string'
			? data.envelope.teaserDetails.trim()
			: derivedTeaser;

	return {
		enabled: true,
		data: {
			teaserDetails,
			sealStyle: data.envelope.sealStyle,
			sealIcon: data.envelope.sealIcon,
			sealInitials: data.envelope.sealInitials,
			sealVariant: data.envelope.sealVariant,
			sealColor: data.envelope.sealColor,
			sealImage: data.envelope.sealImage
				? resolveAsset(eventSlug, data.envelope.sealImage, data.title)
				: undefined,
			microcopy: data.envelope.microcopy,
			documentLabel: data.envelope.documentLabel,
			stampText: data.envelope.stampText,
			stampYear: data.envelope.stampYear,
			tooltipText: data.envelope.tooltipText,
			variant: data.envelope.variant ?? normalizedPreset,
			name: opening.envelope.name,
			guestPlacement: data.envelope.guestPlacement,
			card: opening.card,
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
			coverEdition: data.envelope.coverEdition,
			coverVolume: data.envelope.coverVolume,
			coverIssue: data.envelope.coverIssue,
			revealVariant: data.envelope.revealVariant,
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
				focalPoint: interlude.focalPoint,
				focalPointDesktop: interlude.focalPointDesktop,
				lightX: interlude.lightX,
				lightY: interlude.lightY,
				overlayOpacity: interlude.overlayOpacity,
				image: resolvedImage,
			};
		})
		.filter((i: Interlude | null): i is Interlude => i !== null);
}

function buildQuoteSectionData(context: AdaptationContext) {
	const { data } = context;
	if (!data.quote) return undefined;
	return {
		...data.quote,
		variant: 'standard' as const,
	};
}

function buildCountdownSectionData(context: AdaptationContext) {
	const { data } = context;
	if (!data.sectionOrder?.includes('countdown')) return undefined;

	const variant = data.countdown?.variant;
	if (variant === undefined) {
		throw new Error(
			'Canonical content requires countdown.variant when sectionOrder includes countdown.',
		);
	}

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
		visibleUnits: resolveCountdownVisibleUnits(data.countdown?.presentationOptions),
		variant,
		isDemo: data.isDemo,
	};
}

function formatVenueLocation(
	location: CanonicalEventContent['location'] | undefined,
): string | undefined {
	const venueName = pickVenueValue(location, 'venueName');
	const city = pickVenueValue(location, 'city');
	if (venueName && city) return `${venueName} · ${city}`;
	if (city) return city;
	return undefined;
}

function toVenueEntry(v: VenueEntryInput, eventSlug: string, eventTitle: string): VenueEntry {
	return {
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
		image: resolveAsset(eventSlug, v.image, eventTitle),
	};
}

function buildLocationSectionData(context: AdaptationContext) {
	const { data, eventSlug } = context;
	if (!data.location) return undefined;

	const venues: VenueEntry[] = data.location.venues.map((v: VenueEntryInput) =>
		toVenueEntry(v, eventSlug, data.title),
	);

	return {
		visibility: data.location.visibility,
		presentation: data.location.presentation,
		mapStyle: data.location.mapStyle,
		variant: data.location.variant,
		presentationOptions: data.location.presentationOptions,
		venues,
		indications: data.location.indications,
		showFlourishes: resolveLocationShowFlourishes(
			data.location.presentationOptions,
			data.location.variant,
		),
		showNavigationButtons: resolveLocationShowNavigationButtons(
			data.location.presentationOptions,
		),
		introEyebrow: data.location.introEyebrow,
		introHeading: data.location.introHeading,
		introLede: data.location.introLede,
		indicationsHeading: data.location.indicationsHeading ?? '',
	};
}

function buildFamilySectionData(context: AdaptationContext) {
	const { data, eventSlug } = context;
	if (!data.family) return undefined;
	return {
		...data.family,
		featuredImage: data.family.featuredImage
			? resolveAsset(eventSlug, data.family.featuredImage, data.title)
			: undefined,
		celebrantName: data.hero.name,
		variant: data.family.variant,
	};
}

function buildGallerySectionData(context: AdaptationContext) {
	const { data, eventSlug } = context;
	if (!data.gallery) return undefined;
	const items = data.gallery.items
		.map(
			(item: {
				image: string | AssetSource;
				alt?: string;
				caption?: string;
				key?: string;
				layoutRole?: 'feature' | 'wide' | 'standard';
				aspectRatio?: string;
				focalPoint?: string;
				focalPointMobile?: string;
				focalPointTablet?: string;
				focalPointDesktop?: string;
			}) => {
				const resolved = resolveAsset(eventSlug, item.image, data.title);
				if (!resolved) {
					console.warn(
						`[AssetRegistry] Gallery image not resolvable for event "${eventSlug}", skipping item.`,
					);
					return null;
				}
				const stableKey =
					item.key ?? (typeof item.image === 'string' ? item.image : undefined);
				return {
					...item,
					key: stableKey,
					image: resolved,
				};
			},
		)
		.filter(<T>(i: T | null): i is T => i !== null);
	if (items.length === 0) return undefined;
	return {
		...data.gallery,
		items,
		variant: data.gallery.variant,
		mobileBrowse: resolveGalleryMobileBrowse(data.gallery.presentationOptions),
	};
}

function buildItinerarySectionData(
	context: AdaptationContext,
): (CanonicalEventContent['itinerary'] & { variant: ItineraryVariant }) | undefined {
	const { data } = context;
	if (!data.itinerary) return undefined;

	return {
		...data.itinerary,
		variant: data.itinerary.variant,
	};
}

function buildRsvpSectionData(context: AdaptationContext, entrySlug: string) {
	const { data } = context;
	if (!data.rsvp) return undefined;
	const { calendar, ...rsvpRest } = data.rsvp;
	const eventStartsAt = calendar?.startsAt ?? data.eventTiming?.startsAtUtc ?? data.hero.date;
	return {
		...rsvpRest,
		personalizedAccess: {
			...data.rsvp.personalizedAccess,
			variant: data.rsvp.personalizedAccess.variant,
		},
		eventSlug: entrySlug,
		eventType: data.eventType,
		variant: data.rsvp.variant,
		labels: data.rsvp.labels,
		eventStartsAt,
		eventTimeZone: data.eventTiming?.timeZone,
		locationVisibility: data.location?.visibility,
		calendarTitle: calendar?.title,
		calendarDescription: calendar?.description,
	};
}

function buildGiftsSectionData(context: AdaptationContext) {
	const { data } = context;
	if (!data.gifts) return undefined;
	const presentation = resolveGiftsPresentation(data.gifts.presentation);
	return {
		...data.gifts,
		presentation,
		items: presentation === 'legend-only' ? [] : (data.gifts.items ?? []),
		variant: data.gifts.variant,
	};
}

function buildThankYouSectionData(context: AdaptationContext) {
	const { data, eventSlug } = context;
	if (!data.thankYou) return undefined;
	return {
		...data.thankYou,
		image: data.thankYou.image
			? resolveAsset(eventSlug, data.thankYou.image, data.title)
			: undefined,
		variant: data.thankYou.variant,
	};
}

export function adaptEvent(
	event: EventContentEntry,
	previewTheme?: ThemePreset,
	assetSlugOverride?: string,
): InvitationViewModel {
	const { data: rawData, id: contentEntryId } = event;
	// Astro content and publication validate the full canonical schema before adaptation.
	const originalData = rawData as CanonicalEventContent;
	const entrySlug = getContentEntrySlug(contentEntryId);
	const contentAssetSlug =
		typeof originalData._assetSlug === 'string' ? originalData._assetSlug : undefined;
	const eventSlug = assetSlugOverride ?? contentAssetSlug ?? entrySlug;

	const adapterData = previewTheme
		? {
				...originalData,
				theme: { ...originalData.theme, preset: previewTheme },
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

	// An explicit sectionOrder is the publication visibility authority. The
	// canonical schema requires it; derived section data must never opt a section
	// back into an explicit configuration.

	const playableMusicUrl = adapterData.music?.url?.trim() ?? '';

	return {
		id: entrySlug,
		isDemo,
		visualProfileId: adapterData.visualProfileId,
		title: adapterData.title,
		description: adapterData.description,
		theme: {
			preset: normalizedPreset,
			themeClass: `theme-preset--${normalizedPreset}`,
		},
		hero: buildHero(context),
		envelope,
		brandingVisibility: DEFAULT_BRANDING_VISIBILITY,
		sectionOrder: adapterData.sectionOrder,
		composition: adapterData.composition,
		sections,
		music: hasPlayableMusicUrl(playableMusicUrl)
			? {
					url: playableMusicUrl,
					autoPlay: adapterData.music?.autoPlay ?? false,
					title: adapterData.music?.title,
					revealMode: envelope.enabled ? 'envelope' : 'immediate',
				}
			: undefined,
		interludes: buildInterludes(context),
		navigation: buildCanonicalNavigation(sections, adapterData.navigation),
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
