import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import { type ThemePreset } from '@/lib/theme/theme-contract';
import { getContentEntrySlug, type EventContentEntry } from '@/lib/content/events';
import { pickPreset } from '@/lib/adapters/event-helpers';
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

function buildThemeConfig(normalizedPreset: ThemePreset): ThemeConfig {
	return {
		preset: normalizedPreset,
		themeClass: `theme-preset--${normalizedPreset}`,
	};
}

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
	const theme = buildThemeConfig(context.normalizedPreset);
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
