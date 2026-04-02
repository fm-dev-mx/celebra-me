import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import {
	ITINERARY_VARIANTS,
	SHARED_SECTION_VARIANTS,
	QUOTE_VARIANTS,
	COUNTDOWN_VARIANTS,
	LOCATION_VARIANTS,
	type ItineraryVariant,
	type SharedSectionVariant,
	type ThemePreset,
} from '@/lib/theme/theme-contract';
import { resolveColorToken, PRESET_COLOR_MAP } from '@/lib/theme/color-tokens';
import { getContentEntrySlug, type EventContentEntry } from '@/lib/content/events';
import { pickPreset, hexToRgb } from '@/lib/adapters/event-helpers';
import {
	buildHero,
	buildEnvelope,
	buildGalleryItems,
	buildSectionImages,
	buildLocationIndications,
	buildContentBlocks,
	buildSections,
	buildSharing,
} from './event-view-models';

type QuoteVariantValue = (typeof QUOTE_VARIANTS)[number];
type CountdownVariantValue = (typeof COUNTDOWN_VARIANTS)[number];
type LocationVariantValue = (typeof LOCATION_VARIANTS)[number];

export interface AdaptationContext {
	data: EventContentEntry['data'];
	eventSlug: string;
	normalizedPreset: ThemePreset;
	itineraryFallback: ItineraryVariant;
	sharedSectionFallback: SharedSectionVariant;
	quoteFallback: QuoteVariantValue;
	countdownFallback: CountdownVariantValue;
	locationFallback: LocationVariantValue;
}

function buildThemeConfig(
	data: EventContentEntry['data'],
	normalizedPreset: ThemePreset,
): ThemeConfig {
	const primaryColorHex = resolveColorToken(
		data.theme.primaryColor || 'primary',
		normalizedPreset,
	);
	const accentColorHex = resolveColorToken(data.theme.accentColor || 'accent', normalizedPreset);
	const primaryColorRgb = hexToRgb(primaryColorHex);
	const accentColorRgb = hexToRgb(accentColorHex);
	const presetMap = PRESET_COLOR_MAP[normalizedPreset] || PRESET_COLOR_MAP['jewelry-box'];
	const tokens: Record<string, string> = { ...presetMap };
	const colors: ThemeConfig['colors'] = {
		primaryRgb: primaryColorRgb,
		accentRgb: accentColorRgb,
	};

	for (const [key, value] of Object.entries(tokens)) {
		if (value.startsWith('#')) {
			colors[`${key}Rgb`] = hexToRgb(value);
		}
	}

	return {
		primaryColor: primaryColorHex,
		accentColor: accentColorHex,
		fontFamily: data.theme.fontFamily,
		preset: normalizedPreset,
		themeClass: `theme-preset--${normalizedPreset}`,
		tokens,
		colors,
	};
}

// Moved builders to event-view-models.ts: buildHero, buildEnvelope, buildGalleryItems, etc.

function buildContext(event: EventContentEntry, eventSlug: string): AdaptationContext {
	const { data } = event;
	const normalizedPreset = pickPreset(data.theme.preset);

	return {
		data,
		eventSlug,
		normalizedPreset,
		itineraryFallback: (ITINERARY_VARIANTS as readonly string[]).includes(normalizedPreset)
			? (normalizedPreset as ItineraryVariant)
			: 'base',
		sharedSectionFallback: (SHARED_SECTION_VARIANTS as readonly string[]).includes(
			normalizedPreset,
		)
			? (normalizedPreset as SharedSectionVariant)
			: 'standard',
		quoteFallback: (QUOTE_VARIANTS as readonly string[]).includes(normalizedPreset)
			? (normalizedPreset as QuoteVariantValue)
			: 'elegant',
		countdownFallback: (COUNTDOWN_VARIANTS as readonly string[]).includes(normalizedPreset)
			? (normalizedPreset as CountdownVariantValue)
			: 'minimal',
		locationFallback: (LOCATION_VARIANTS as readonly string[]).includes(normalizedPreset)
			? (normalizedPreset as LocationVariantValue)
			: 'structured',
	};
}

export function adaptEvent(
	event: EventContentEntry,
	previewTheme?: ThemePreset,
): InvitationViewModel {
	const { data: originalData, id: contentEntryId } = event;
	const eventSlug = getContentEntrySlug(contentEntryId);

	// Create a safe context for adaptation, overriding the preset if requested
	const adapterData = previewTheme
		? { ...originalData, theme: { ...originalData.theme, preset: previewTheme } }
		: originalData;

	const context = buildContext({ ...event, data: adapterData }, eventSlug);
	const theme = buildThemeConfig(adapterData, context.normalizedPreset);
	const hero = buildHero(context);
	const envelope = buildEnvelope(context);
	const galleryItems = buildGalleryItems(context);
	const images = buildSectionImages(context);
	const locationIndications = buildLocationIndications(context);
	const sections = buildSections(context, galleryItems, images, locationIndications);
	const contentBlocks = buildContentBlocks(context);
	const showEnvelope = envelope.enabled;

	return {
		id: eventSlug,
		isDemo: adapterData.isDemo ?? false,
		title: adapterData.title,
		description: adapterData.description,
		theme,
		hero,
		envelope,
		sections,
		music: adapterData.music
			? {
					...adapterData.music,
					revealMode: showEnvelope ? 'envelope' : 'immediate',
				}
			: undefined,
		contentBlocks,
		navigation: adapterData.navigation,
		sharing: buildSharing(context),
	};
}
