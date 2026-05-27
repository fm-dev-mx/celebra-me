import { adaptEvent } from '@/lib/adapters/event';
import { resolveBrandingVisibility } from '@/lib/adapters/branding';
import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { EventContentEntry } from '@/lib/content/events';
import type { RevealCardData } from '@/lib/invitation/reveal-card';
import type { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';
import { generateThemeScopedStyles } from '@/lib/invitation/theme-styles.utils';
import { isEventEligibleForBrandingRemoval } from '@/lib/constants/branding-removal-rules';

export type InvitationGuestContext = Awaited<ReturnType<typeof getInvitationContextByInviteId>>;

export type InterludeRenderItem = {
	type: 'interlude';
	image: ImageAsset;
	alt?: string;
	height: 'screen' | 'tall';
	variant?: ThemePreset;
	focalPoint?: string;
	lightX?: string;
	lightY?: string;
	overlayOpacity?: string;
};

export type InvitationRenderPlanItem =
	| {
			type: 'section';
			section: keyof InvitationViewModel['sections'];
	  }
	| {
			type: 'personalized-access';
	  }
	| InterludeRenderItem;

export interface InvitationPageContext {
	viewModel: InvitationViewModel;
	guestContext?: InvitationGuestContext | null;
	isDemoPreview?: boolean;
	renderPlan: InvitationRenderPlanItem[];
	layout: {
		title: string;
		description: string;
		image: string;
		className?: string;
	};
	wrapper: {
		className: string;
		showEnvelope: boolean;
		dataAttributes: Record<string, string>;
		scopedStyles: string;
	};
	guestName?: string;
	heroTime?: string;
	heroVenueName?: string;
	envelope?:
		| (NonNullable<InvitationViewModel['envelope']['data']> & {
				eventSlug: string;
				guestName?: string;
				isDemo: boolean;
				name: string;
				card: RevealCardData;
		  })
		| undefined;
	footerVariant: ThemePreset;
}

const DEFAULT_SECTION_ORDER: Array<keyof InvitationViewModel['sections']> = [
	'quote',
	'family',
	'gallery',
	'countdown',
	'location',
	'itinerary',
	'rsvp',
	'gifts',
	'thankYou',
];

function resolveImageSrc(image: ImageAsset): string {
	return typeof image.src === 'string' ? image.src : image.src.src;
}

function resolveHeroImageSrc(hero: InvitationViewModel['hero']): string {
	return resolveImageSrc(hero.backgroundImage);
}

function buildLayoutData(
	viewModel: InvitationViewModel,
	hero: InvitationViewModel['hero'],
	guestName: string | undefined,
) {
	const sharingImage = viewModel.sharing?.ogImage;
	const imageSrc = sharingImage ? resolveImageSrc(sharingImage) : resolveHeroImageSrc(hero);

	return {
		title: guestName ? `Invitación para ${guestName}` : viewModel.title,
		description: viewModel.description || '',
		image: imageSrc,
		className: `layout--${viewModel.theme.preset}`,
	};
}

function buildEnvelopeData(
	showEnvelope: boolean,
	envelope: InvitationViewModel['envelope'],
	eventSlug: string,
	guestName: string | undefined,
	isDemo: boolean,
) {
	if (!showEnvelope || !envelope.data) return undefined;

	return {
		...envelope.data,
		name: envelope.data.card.name,
		eventSlug,
		isDemo,
		card: {
			...envelope.data.card,
			guestName,
		},
	};
}

function resolveFooterVariant(
	eventEntry: EventContentEntry,
	themePreset: ThemeConfig['preset'],
	isPreview: boolean,
): ThemePreset {
	if (!isPreview) {
		const configuredVariant = eventEntry.data.sectionStyles?.footer?.variant;
		if (configuredVariant) return configuredVariant;
	}

	if (themePreset && (THEME_PRESETS as readonly string[]).includes(themePreset)) {
		return themePreset as ThemePreset;
	}

	return THEME_PRESETS[0];
}

function hasRenderableSection(
	viewModel: InvitationViewModel,
	section: keyof InvitationViewModel['sections'],
): boolean {
	return Boolean(viewModel.sections[section]);
}

function appendSectionWithInterludes(
	items: InvitationRenderPlanItem[],
	viewModel: InvitationViewModel,
	section: keyof InvitationViewModel['sections'],
): void {
	items.push({ type: 'section', section });

	for (const interlude of (viewModel.interludes ?? []).filter(
		(i) => i.afterSection === section,
	)) {
		items.push(interludeToRenderItem(interlude, viewModel.theme.preset ?? THEME_PRESETS[0]));
	}
}

function interludeToRenderItem(
	interlude: NonNullable<InvitationViewModel['interludes']>[number],
	themePreset: ThemePreset,
): InterludeRenderItem {
	return {
		type: 'interlude',
		image: interlude.image,
		alt: interlude.alt,
		height: interlude.height,
		variant: interlude.variant ?? themePreset,
		focalPoint: interlude.focalPoint,
		lightX: interlude.lightX,
		lightY: interlude.lightY,
		overlayOpacity: interlude.overlayOpacity,
	};
}

export function buildInvitationRenderPlan(
	viewModel: InvitationViewModel,
	options?: {
		hasGuestContext?: boolean;
		isDemoPreview?: boolean;
	},
): InvitationRenderPlanItem[] {
	const hasGuestContext = options?.hasGuestContext ?? false;
	const isDemoPreview = options?.isDemoPreview ?? false;
	const items: InvitationRenderPlanItem[] = [];
	const showPersonalizedAccess = hasGuestContext || isDemoPreview;
	const sectionOrder = viewModel.sectionOrder;

	if (sectionOrder) {
		for (const section of sectionOrder) {
			if (section === 'personalizedAccess') {
				items.push({ type: 'personalized-access' });
				continue;
			}

			if (!hasRenderableSection(viewModel, section)) continue;
			appendSectionWithInterludes(items, viewModel, section);
		}
	} else {
		for (const section of DEFAULT_SECTION_ORDER) {
			if (!hasRenderableSection(viewModel, section)) continue;

			if (section === 'rsvp' && showPersonalizedAccess) {
				items.push({ type: 'personalized-access' });
			}

			appendSectionWithInterludes(items, viewModel, section);
		}
	}

	return items;
}

export function prepareInvitationPageContext(input: {
	eventEntry: EventContentEntry;
	slug: string;
	guestContext?: InvitationGuestContext | null;
	previewTheme?: ThemeConfig['preset'];
}): InvitationPageContext {
	const viewModel = adaptEvent(input.eventEntry, input.previewTheme);
	viewModel.brandingVisibility = resolveBrandingVisibility({
		isDemo: viewModel.isDemo,
		guest: input.guestContext?.guest ?? null,
		isEventEligibleForGuestBrandingRemoval: isEventEligibleForBrandingRemoval(
			input.eventEntry.data.eventType,
			input.slug,
		),
	});
	const { theme, hero, envelope, sections } = viewModel;
	const eventScopeClass = `event--${input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
	const isDemo = viewModel.isDemo;

	const styles = generateThemeScopedStyles(theme, envelope, viewModel.id, isDemo);
	const wrapperClassName = ['event-theme-wrapper', eventScopeClass, theme.themeClass]
		.filter(Boolean)
		.join(' ');

	const guestName = input.guestContext?.guest.fullName;
	const heroTime = sections.location?.reception?.time ?? sections.location?.ceremony?.time;
	const heroVenueName =
		sections.location?.reception?.venueName ?? sections.location?.ceremony?.venueName;

	const isDemoPreview = isDemo && !input.guestContext;

	return {
		viewModel,
		guestContext: input.guestContext,
		isDemoPreview,
		layout: buildLayoutData(viewModel, hero, guestName),
		wrapper: {
			className: wrapperClassName,
			showEnvelope: styles.showEnvelope,
			dataAttributes: styles.dataAttributes,
			scopedStyles: styles.scopedStyles,
		},
		guestName,
		heroTime,
		heroVenueName,
		envelope: buildEnvelopeData(styles.showEnvelope, envelope, viewModel.id, guestName, isDemo),
		footerVariant: resolveFooterVariant(
			input.eventEntry,
			theme.preset,
			Boolean(input.previewTheme),
		),
		renderPlan: buildInvitationRenderPlan(viewModel, {
			hasGuestContext: Boolean(input.guestContext),
			isDemoPreview,
		}),
	};
}
