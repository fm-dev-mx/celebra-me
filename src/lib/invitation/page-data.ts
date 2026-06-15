import { adaptEvent } from '@/lib/adapters/event';
import { resolveBrandingVisibility } from '@/lib/adapters/branding';
import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { EventContentEntry } from '@/lib/content/events';
import type { RevealCardData } from '@/lib/invitation/reveal-card';
import type { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { resolveShareDescription } from '@/lib/rsvp/services/shared/share-message-defaults';
import { CONTENT_SECTION_KEYS, THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';
import { generateThemeScopedStyles } from '@/lib/invitation/theme-styles.utils';
import { isEventEligibleForBrandingRemoval } from '@/lib/constants/branding-removal-rules';

export type InvitationGuestContext = Awaited<ReturnType<typeof getInvitationContextByInviteId>>;
type LocationSection = NonNullable<InvitationViewModel['sections']['location']>;

export type InterludeRenderItem = {
	type: 'interlude';
	image: ImageAsset;
	alt?: string;
	height: 'screen' | 'tall' | 'medium';
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

const DEFAULT_THEME_PRESET: ThemePreset = THEME_PRESETS[0];

export function buildLayoutData(viewModel: InvitationViewModel, guestName: string | undefined) {
	const image = viewModel.sharing?.ogImage ?? viewModel.hero.backgroundImage;
	const imageSrc = typeof image.src === 'string' ? image.src : image.src.src;

	const resolvedDescription =
		viewModel.sharing?.ogDescription?.trim() ||
		viewModel.description?.trim() ||
		resolveShareDescription(undefined, viewModel.title);

	return {
		title: guestName ? `Invitación para ${guestName}` : viewModel.title,
		description: resolvedDescription,
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

function redactEnvelopeTeaserWhenLocationLocked<T extends { teaserDetails?: string }>(
	envelope: T | undefined,
	location: LocationSection | undefined,
): T | undefined {
	if (!envelope || !location?.isLocked || !envelope.teaserDetails) return envelope;

	return {
		...envelope,
		teaserDetails: envelope.teaserDetails.split('•')[0]?.trim() ?? envelope.teaserDetails,
	};
}

function resolveFooterVariant(
	sectionStyles: { footer?: { variant?: ThemePreset } } | undefined,
	themePreset: ThemePreset,
	isPreview: boolean,
): ThemePreset {
	if (!isPreview && sectionStyles?.footer?.variant) {
		return sectionStyles.footer.variant;
	}
	return themePreset;
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
		items.push(
			interludeToRenderItem(interlude, viewModel.theme.preset ?? DEFAULT_THEME_PRESET),
		);
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
		for (const section of CONTENT_SECTION_KEYS) {
			if (!hasRenderableSection(viewModel, section)) continue;

			if (section === 'rsvp' && showPersonalizedAccess) {
				items.push({ type: 'personalized-access' });
			}

			appendSectionWithInterludes(items, viewModel, section);
		}
	}

	return items;
}

function pickHeroValue(
	sections: InvitationPageContext['viewModel']['sections'] | undefined,
	field: 'time' | 'venueName',
): string | undefined {
	return (
		sections?.location?.venues?.[0]?.[field] ||
		sections?.location?.reception?.[field] ||
		sections?.location?.ceremony?.[field]
	);
}

function isConfirmedGuest(guestContext: InvitationGuestContext | null | undefined): boolean {
	return guestContext?.guest.attendanceStatus === 'confirmed';
}

function redactProtectedLocation(location: LocationSection): LocationSection {
	return {
		visibility: 'after-rsvp',
		isLocked: true,
		variant: location.variant,
		showFlourishes: location.showFlourishes,
		introEyebrow: location.introEyebrow,
		introHeading: location.introHeading ?? 'Ubicación',
		introLede: location.introLede,
		indicationsHeading: '',
		lockedTitle: 'Ubicación reservada',
		lockedMessage:
			'Por cuidado de la familia, los detalles del lugar se mostrarán después de confirmar asistencia.',
		lockedCtaLabel: 'Confirmar asistencia',
	};
}

function applyProtectedLocationRedaction(
	viewModel: InvitationViewModel,
	guestContext: InvitationGuestContext | null | undefined,
): InvitationViewModel {
	const location = viewModel.sections.location;
	if (!location || location.visibility !== 'after-rsvp' || isConfirmedGuest(guestContext)) {
		return viewModel;
	}

	return {
		...viewModel,
		hero: {
			...viewModel.hero,
			venueName: undefined,
		},
		sections: {
			...viewModel.sections,
			location: redactProtectedLocation(location),
		},
	};
}

export function buildPageContextFromViewModel(input: {
	viewModel: InvitationViewModel;
	slug: string;
	guestContext?: InvitationGuestContext | null;
	eventType: string;
	sectionStyles?: { footer?: { variant?: ThemePreset } };
	isPreview?: boolean;
}): InvitationPageContext {
	const { viewModel, slug, guestContext, eventType, sectionStyles, isPreview = false } = input;
	const renderViewModel = applyProtectedLocationRedaction(viewModel, guestContext);

	renderViewModel.brandingVisibility = resolveBrandingVisibility({
		isDemo: renderViewModel.isDemo,
		guest: guestContext?.guest ?? null,
		isEventEligibleForGuestBrandingRemoval: isEventEligibleForBrandingRemoval(eventType, slug),
	});

	const { theme, envelope, sections } = renderViewModel;
	const eventScopeClass = `event--${slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
	const isDemo = renderViewModel.isDemo;

	const styles = generateThemeScopedStyles(theme, envelope, renderViewModel.id, isDemo);
	const wrapperClassName = ['event-theme-wrapper', eventScopeClass, theme.themeClass]
		.filter(Boolean)
		.join(' ');

	const guestName = guestContext?.guest.fullName;
	const heroTime = pickHeroValue(sections, 'time');
	const heroVenueName = pickHeroValue(sections, 'venueName');

	const isDemoPreview = isDemo && !guestContext;
	const envelopeData = redactEnvelopeTeaserWhenLocationLocked(
		buildEnvelopeData(styles.showEnvelope, envelope, renderViewModel.id, guestName, isDemo),
		sections.location,
	);

	return {
		guestContext,
		isDemoPreview,
		layout: buildLayoutData(renderViewModel, guestName),
		wrapper: {
			className: wrapperClassName,
			showEnvelope: styles.showEnvelope,
			dataAttributes: styles.dataAttributes,
			scopedStyles: styles.scopedStyles,
		},
		guestName,
		heroTime,
		heroVenueName,
		envelope: envelopeData,
		footerVariant: resolveFooterVariant(sectionStyles, theme.preset, isPreview),
		viewModel: renderViewModel,
		renderPlan: buildInvitationRenderPlan(renderViewModel, {
			hasGuestContext: Boolean(guestContext),
			isDemoPreview,
		}),
	};
}

export function prepareInvitationPageContext(input: {
	eventEntry: EventContentEntry;
	slug: string;
	guestContext?: InvitationGuestContext | null;
	previewTheme?: ThemeConfig['preset'];
}): InvitationPageContext {
	const viewModel = adaptEvent(input.eventEntry, input.previewTheme);

	return buildPageContextFromViewModel({
		viewModel,
		slug: input.slug,
		guestContext: input.guestContext,
		eventType: input.eventEntry.data.eventType,
		sectionStyles: input.eventEntry.data.sectionStyles,
		isPreview: Boolean(input.previewTheme),
	});
}
