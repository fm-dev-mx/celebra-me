import type { Interlude, InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import type { InterludeInput } from '@/lib/schemas/content/interludes.schema';
import { type ThemePreset } from '@/lib/theme/theme-contract';
import { getContentEntrySlug, type EventContentEntry } from '@/lib/content/events';
import { pickPreset, resolveAsset } from '@/lib/adapters/event-helpers';
import {
	buildHero,
	buildEnvelope,
	buildGalleryItems,
	buildSectionImages,
	buildLocationIndications,
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
	const showEnvelope = envelope.enabled;

	const interludes = adapterData.interludes
		?.map((interlude: InterludeInput) => {
			const resolvedImage = resolveAsset(eventSlug, interlude.image, adapterData.title);
			if (!resolvedImage) return null;
			return {
				afterSection: interlude.afterSection,
				alt: interlude.alt,
				height: interlude.height,
				variant: interlude.variant,
				focalPoint: interlude.focalPoint,
				image: resolvedImage,
			} as Interlude;
		})
		.filter((i: Interlude | null): i is Interlude => i !== null);

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
		interludes,
		navigation: adapterData.navigation,
		sharing: buildSharing(context),
	};
}
