import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import { type ThemePreset } from '@/lib/theme/theme-contract';
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

export interface AdaptationContext {
	data: EventContentEntry['data'];
	eventSlug: string;
	normalizedPreset: ThemePreset;
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
		? {
				...originalData,
				theme: { ...originalData.theme, preset: previewTheme },
				sectionStyles: {},
			}
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
