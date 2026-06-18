import { adaptEvent } from '@/lib/adapters/event';
import { resolveBrandingVisibility } from '@/lib/adapters/branding';
import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import type { EventContentEntry } from '@/lib/content/events';
import type { RevealCardData } from '@/lib/invitation/reveal-card';
import type { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { resolveShareDescription } from '@/lib/rsvp/services/shared/share-message-defaults';
import { type ThemePreset } from '@/lib/theme/theme-contract';
import { generateThemeScopedStyles } from '@/lib/invitation/theme-styles.utils';
import { isEventEligibleForBrandingRemoval } from '@/lib/constants/branding-removal-rules';
import { buildInvitationRenderPlan } from './render-plan';
import type { InterludeRenderItem, InvitationRenderPlanItem } from './render-plan';
import {
	applyProtectedLocationRules,
	redactEnvelopeTeaserWhenLocationLocked,
} from './protected-location';

export type InvitationGuestContext = Awaited<ReturnType<typeof getInvitationContextByInviteId>>;

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
		name: envelope.data.name,
		eventSlug,
		isDemo,
		card: {
			...envelope.data.card,
			guestName: guestName ?? envelope.data.card.guestName,
		},
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

export function buildPageContextFromViewModel(input: {
	viewModel: InvitationViewModel;
	slug: string;
	guestContext?: InvitationGuestContext | null;
	eventType: string;
	sectionStyles?: { footer?: { variant?: ThemePreset } };
	isPreview?: boolean;
}): InvitationPageContext {
	const { viewModel, slug, guestContext, eventType, sectionStyles, isPreview = false } = input;
	const renderViewModel = applyProtectedLocationRules({
		viewModel,
		isConfirmedGuest: guestContext?.guest.attendanceStatus === 'confirmed',
		routeSlug: slug,
		eventType,
	});

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
	const lunaEstrellaRoute = slug === 'luna-y-estrella' && eventType === 'primera-comunion';
	const shouldRedactEnvelopeLocationTeaser =
		Boolean(sections.location?.isLocked) ||
		(lunaEstrellaRoute && viewModel.sections.location?.visibility === 'after-rsvp');
	const envelopeData = redactEnvelopeTeaserWhenLocationLocked(
		buildEnvelopeData(styles.showEnvelope, envelope, renderViewModel.id, guestName, isDemo),
		shouldRedactEnvelopeLocationTeaser,
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

export type { InterludeRenderItem, InvitationRenderPlanItem };
export { buildInvitationRenderPlan } from './render-plan';
