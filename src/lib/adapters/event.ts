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
import { isXareniAssetSlug } from '@/lib/assets/asset-keys';
import { DEFAULT_BRANDING_VISIBILITY } from '@/lib/adapters/branding';
import { resolveCountdownTarget } from '@/lib/time/event-time';
import { COUNTDOWN_DEFAULTS } from '@/lib/intake/constants';
import { resolveCountdownVisibleUnits } from '@/lib/invitation/countdown-presentation';
import { resolveGalleryMobileBrowse } from '@/lib/invitation/gallery-presentation';
import { resolveGiftsPresentation } from '@/lib/invitation/gifts-presentation';
import { resolvePortraitEnabled } from '@/lib/invitation/hero-presentation';
import { resolveItineraryPresentation } from '@/lib/invitation/itinerary-presentation';
import {
	resolveLocationShowFlourishes,
	resolveLocationShowNavigationButtons,
} from '@/lib/invitation/location-presentation-compatibility';
import { resolveXareniSealColor } from '@/lib/invitation/invitation-profile-css';
import {
	FAMILY_STRUCTURAL_VARIANTS,
	GALLERY_LAYOUT_VARIANTS,
	GIFTS_STRUCTURAL_VARIANTS,
	HERO_STRUCTURAL_VARIANTS,
	LOCATION_STRUCTURAL_VARIANTS,
	PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS,
	RSVP_STRUCTURAL_VARIANTS,
	THANK_YOU_STRUCTURAL_VARIANTS,
	resolveFamilyStructuralVariant,
	resolveGalleryLayoutVariant,
	resolveGalleryVisualVariant,
	resolveGiftsStructuralVariant,
	resolveHeroStructuralVariant,
	resolveLocationStructuralVariant,
	resolvePersonalizedAccessStructuralVariant,
	resolveRsvpStructuralVariant,
	resolveThankYouStructuralVariant,
} from '@/lib/invitation/structural-variants';

interface AdaptationContext {
	data: EventContentEntry['data'];
	eventSlug: string;
	normalizedPreset: ThemePreset;
}

function pickVenueValue(
	location: EventContentEntry['data']['location'] | undefined,
	key: 'venueName' | 'city',
): string | undefined {
	if (!location) return undefined;
	const direct = location.reception?.[key] ?? location.ceremony?.[key];
	if (direct) return direct;
	const venues = location.venues;
	if (!venues || venues.length === 0) return undefined;
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
		portrait: resolvePortraitEnabled(data.hero.presentation, themeSupportsPortrait(preset))
			? resolveAsset(eventSlug, data.hero.portrait, data.title)
			: undefined,
		variant: preset,
		structuralVariant: resolveHeroStructuralVariant(data.hero.structuralVariant, preset),
		structuralVariantExplicit: HERO_STRUCTURAL_VARIANTS.includes(
			data.hero.structuralVariant as (typeof HERO_STRUCTURAL_VARIANTS)[number],
		),
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
	const explicitTeaser =
		typeof data.envelope.teaserDetails === 'string' ? data.envelope.teaserDetails.trim() : '';
	const teaserDetails = explicitTeaser || derivedTeaser;

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
			variant: normalizedPreset,
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
				sealAccent: isXareniAssetSlug(eventSlug)
					? resolveXareniSealColor(data.envelope.sealColor)
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
		visibleUnits: resolveCountdownVisibleUnits(data.countdown?.presentationOptions),
		variant: sectionVariant(
			'countdown',
			data.sectionStyles?.countdown?.variant,
			normalizedPreset,
		),
		isDemo: data.isDemo,
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
	const { data, eventSlug, normalizedPreset } = context;
	if (!data.location) return undefined;

	const rawVenues = data.location.venues;
	const venues: VenueEntry[] | undefined = rawVenues?.map((v: VenueEntryInput) =>
		toVenueEntry(v, eventSlug, data.title),
	);

	return {
		visibility: data.location.visibility,
		presentation: data.location.presentation,
		structuralVariant: resolveLocationStructuralVariant(data.location.structuralVariant),
		structuralVariantExplicit: LOCATION_STRUCTURAL_VARIANTS.includes(
			data.location.structuralVariant as (typeof LOCATION_STRUCTURAL_VARIANTS)[number],
		),
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
		showFlourishes: resolveLocationShowFlourishes(
			data.location.presentationOptions,
			data.sectionStyles?.location?.showFlourishes,
		),
		showNavigationButtons: resolveLocationShowNavigationButtons(
			data.location.presentationOptions,
			data.sectionStyles?.location?.showNavigationButtons,
		),
		introEyebrow: data.location.introEyebrow,
		introHeading: data.location.introHeading,
		introLede: data.location.introLede,
		indicationsHeading: data.location.indicationsHeading ?? '',
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
		structuralVariant: resolveFamilyStructuralVariant(data.family.structuralVariant),
		structuralVariantExplicit: FAMILY_STRUCTURAL_VARIANTS.includes(
			data.family.structuralVariant as (typeof FAMILY_STRUCTURAL_VARIANTS)[number],
		),
		variant: sectionVariant('family', data.sectionStyles?.family?.variant, normalizedPreset),
	};
}

function buildGallerySectionData(context: AdaptationContext) {
	const { data, eventSlug, normalizedPreset } = context;
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
	const rawGalleryVariant = data.gallery.variant;
	const structuralVariantExplicit =
		typeof rawGalleryVariant === 'string' &&
		([...GALLERY_LAYOUT_VARIANTS, 'single'] as readonly string[]).includes(rawGalleryVariant);
	const structuralVariant = resolveGalleryLayoutVariant(
		rawGalleryVariant,
		rawGalleryVariant ?? data.sectionStyles?.gallery?.variant,
		normalizedPreset,
	);
	const legacyVisualVariant =
		rawGalleryVariant === 'single-keepsake'
			? 'single-keepsake'
			: typeof rawGalleryVariant === 'string' &&
				  !(GALLERY_LAYOUT_VARIANTS as readonly string[]).includes(rawGalleryVariant)
				? rawGalleryVariant
				: data.sectionStyles?.gallery?.variant;
	return {
		...data.gallery,
		items,
		variant: structuralVariant,
		visualVariant: resolveGalleryVisualVariant(legacyVisualVariant, normalizedPreset),
		structuralVariantExplicit,
		mobileBrowse: resolveGalleryMobileBrowse(data.gallery.presentationOptions),
	};
}

function buildItinerarySectionData(
	context: AdaptationContext,
): (EventContentEntry['data']['itinerary'] & { variant: ItineraryVariant }) | undefined {
	const { data } = context;
	if (!data.itinerary) return undefined;

	const presentationBehavior = resolveItineraryPresentation(data.itinerary.presentation);
	const legacyVariant = data.sectionStyles?.itinerary?.variant;
	const hasCanonicalPresentation = data.itinerary.presentation !== undefined;
	const variant: ItineraryVariant = hasCanonicalPresentation
		? presentationBehavior
		: legacyVariant === 'celestial-blue'
			? 'timeline-paper'
			: (legacyVariant ?? context.normalizedPreset);
	return {
		...data.itinerary,
		variant,
	};
}

function buildRsvpSectionData(context: AdaptationContext, entrySlug: string) {
	const { data, normalizedPreset } = context;
	if (!data.rsvp) return undefined;
	const { calendar, ...rsvpRest } = data.rsvp;
	const eventStartsAt = calendar?.startsAt ?? data.eventTiming?.startsAtUtc ?? data.hero.date;
	return {
		...rsvpRest,
		personalizedAccess: data.rsvp.personalizedAccess
			? {
					...data.rsvp.personalizedAccess,
					structuralVariant: resolvePersonalizedAccessStructuralVariant(
						data.rsvp.personalizedAccess.structuralVariant,
						normalizedPreset,
					),
					structuralVariantExplicit: PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS.includes(
						data.rsvp.personalizedAccess
							.structuralVariant as (typeof PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS)[number],
					),
				}
			: undefined,
		eventSlug: entrySlug,
		eventType: data.eventType,
		variant: sectionVariant('rsvp', data.sectionStyles?.rsvp?.variant, normalizedPreset),
		structuralVariant: resolveRsvpStructuralVariant(
			data.sectionStyles?.rsvp?.structuralVariant,
			normalizedPreset,
		),
		structuralVariantExplicit: RSVP_STRUCTURAL_VARIANTS.includes(
			data.sectionStyles?.rsvp
				?.structuralVariant as (typeof RSVP_STRUCTURAL_VARIANTS)[number],
		),
		labels: data.sectionStyles?.rsvp?.labels,
		eventStartsAt,
		eventTimeZone: data.eventTiming?.timeZone,
		locationVisibility: data.location?.visibility,
		calendarTitle: calendar?.title,
		calendarDescription: calendar?.description,
	};
}

function buildGiftsSectionData(context: AdaptationContext) {
	const { data, normalizedPreset } = context;
	if (!data.gifts) return undefined;
	const presentation = resolveGiftsPresentation(data.gifts.presentation);
	return {
		...data.gifts,
		presentation,
		items: presentation === 'legend-only' ? [] : (data.gifts.items ?? []),
		variant: sectionVariant('gifts', data.sectionStyles?.gifts?.variant, normalizedPreset),
		structuralVariant: resolveGiftsStructuralVariant(
			data.sectionStyles?.gifts?.structuralVariant,
			normalizedPreset,
		),
		structuralVariantExplicit: GIFTS_STRUCTURAL_VARIANTS.includes(
			data.sectionStyles?.gifts
				?.structuralVariant as (typeof GIFTS_STRUCTURAL_VARIANTS)[number],
		),
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
		structuralVariant: resolveThankYouStructuralVariant(
			data.sectionStyles?.thankYou?.structuralVariant,
			normalizedPreset,
		),
		structuralVariantExplicit: THANK_YOU_STRUCTURAL_VARIANTS.includes(
			data.sectionStyles?.thankYou
				?.structuralVariant as (typeof THANK_YOU_STRUCTURAL_VARIANTS)[number],
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

	// An explicit sectionOrder is the publication visibility authority. A missing
	// order is handled once by the render-plan legacy path; derived section data
	// must never opt a section back into an explicit configuration.

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
