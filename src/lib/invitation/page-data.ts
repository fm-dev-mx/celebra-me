import { adaptEvent } from '@/lib/adapters/event';
import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import type { ImageAsset } from '@/lib/assets/asset-registry';
import type { EventContentEntry } from '@/lib/content/events';
import type { RevealCardData } from '@/lib/invitation/reveal-card';
import type { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import { type SharedSectionVariant, SHARED_SECTION_VARIANTS } from '@/lib/theme/theme-contract';
import { generateThemeScopedStyles } from '@/lib/invitation/theme-styles.utils';

export type InvitationGuestContext = Awaited<ReturnType<typeof getInvitationContextByInviteId>>;

export type InvitationRenderPlanItem =
	| NonNullable<InvitationViewModel['contentBlocks']>[number]
	| {
			type: 'personalized-access';
	  };

export interface InvitationPageContext {
	viewModel: InvitationViewModel;
	guestContext?: InvitationGuestContext | null;
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
	envelope?:
		| (NonNullable<InvitationViewModel['envelope']['data']> & {
				eventSlug: string;
				guestName?: string;
				isDemo: boolean;
				name: string;
				card: RevealCardData;
		  })
		| undefined;
	footerVariant: SharedSectionVariant;
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
		className: hero.layoutVariant ? `layout--${hero.layoutVariant}` : undefined,
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
		guestName,
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
): SharedSectionVariant {
	if (!isPreview) {
		const configuredVariant = eventEntry.data.sectionStyles?.footer?.variant;
		if (configuredVariant) return configuredVariant;
	}

	// Preview themes should override event-specific footer styles without mutating content data.
	if (themePreset && (SHARED_SECTION_VARIANTS as readonly string[]).includes(themePreset)) {
		return themePreset as SharedSectionVariant;
	}

	return 'standard';
}

function hasRenderableSection(
	viewModel: InvitationViewModel,
	section: keyof InvitationViewModel['sections'],
): boolean {
	return Boolean(viewModel.sections[section]);
}

function appendSection(
	items: InvitationRenderPlanItem[],
	section: keyof InvitationViewModel['sections'],
	hasGuestContext: boolean,
): void {
	if (section === 'rsvp' && hasGuestContext) {
		items.push({ type: 'personalized-access' });
	}

	items.push({ type: 'section', section });
}

export function buildInvitationRenderPlan(
	viewModel: InvitationViewModel,
	options?: {
		hasGuestContext?: boolean;
	},
): InvitationRenderPlanItem[] {
	const hasGuestContext = options?.hasGuestContext ?? false;
	const items: InvitationRenderPlanItem[] = [];

	if (viewModel.contentBlocks?.length) {
		for (const block of viewModel.contentBlocks) {
			if (block.type === 'interlude') {
				items.push(block);
				continue;
			}

			if (hasRenderableSection(viewModel, block.section)) {
				appendSection(items, block.section, hasGuestContext);
			}
		}

		return items;
	}

	for (const section of DEFAULT_SECTION_ORDER) {
		if (hasRenderableSection(viewModel, section)) {
			appendSection(items, section, hasGuestContext);
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
	const { theme, hero, envelope, sections } = viewModel;
	const eventScopeClass = `event--${input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
	const isDemo = viewModel.isDemo;

	const styles = generateThemeScopedStyles(theme, envelope, viewModel.id, isDemo);
	const wrapperClassName = ['event-theme-wrapper', eventScopeClass, theme.themeClass]
		.filter(Boolean)
		.join(' ');

	const guestName = input.guestContext?.guest.fullName;
	const heroTime = sections.location?.reception?.time ?? sections.location?.ceremony?.time;

	return {
		viewModel,
		guestContext: input.guestContext,
		layout: buildLayoutData(viewModel, hero, guestName),
		wrapper: {
			className: wrapperClassName,
			showEnvelope: styles.showEnvelope,
			dataAttributes: styles.dataAttributes,
			scopedStyles: styles.scopedStyles,
		},
		guestName,
		heroTime,
		envelope: buildEnvelopeData(styles.showEnvelope, envelope, viewModel.id, guestName, isDemo),
		footerVariant: resolveFooterVariant(
			input.eventEntry,
			theme.preset,
			Boolean(input.previewTheme),
		),
		renderPlan: buildInvitationRenderPlan(viewModel, {
			hasGuestContext: Boolean(input.guestContext),
		}),
	};
}
