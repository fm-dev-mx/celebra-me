import { adaptEvent } from '@/lib/adapters/event';
import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import type { EventContentEntry } from '@/lib/content/events';
import type { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import type { RevealCardData } from '@/lib/invitation/reveal-card';
import {
	type SharedSectionVariant,
	type ThemePreset,
	THEME_PRESETS,
} from '@/lib/theme/theme-contract';

export type InvitationGuestContext = Awaited<ReturnType<typeof getInvitationContextByInviteId>>;

export type InvitationRenderPlanItem =
	| NonNullable<InvitationViewModel['contentBlocks']>[number]
	| {
			type: 'personalized-access';
	  };

export interface InvitationPageData {
	eventSlug: string;
	isDemo: boolean;
	themePreset: ThemeConfig['preset'];
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
	header: {
		eventName: string;
		theme: InvitationViewModel['theme'];
		links: NonNullable<InvitationViewModel['navigation']>;
		variant: ThemeConfig['preset'];
	};
	hero: InvitationViewModel['hero'] & {
		time?: string;
		guestName?: string;
	};
	envelope?:
		| (NonNullable<InvitationViewModel['envelope']['data']> & {
				eventSlug: string;
				guestName?: string;
				isDemo: boolean;
				name: string;
				card: RevealCardData;
		  })
		| undefined;
	sections: InvitationViewModel['sections'];
	rsvp?:
		| (NonNullable<InvitationViewModel['sections']['rsvp']> & {
				celebrantName: string;
				initialGuestData?: {
					fullName: string;
					maxAllowedAttendees: number;
					inviteId: string;
				};
		  })
		| undefined;
	personalizedAccess?:
		| {
				guestName: string;
				maxAllowedAttendees: number;
		  }
		| undefined;
	footer: {
		eventSlug: string;
		showEnvelope: boolean;
		variant: SharedSectionVariant;
	};
	music?:
		| (NonNullable<InvitationViewModel['music']> & {
				variant: ThemeConfig['preset'];
		  })
		| undefined;
	renderPlan: InvitationRenderPlanItem[];
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

function resolveHeroImageSrc(hero: InvitationViewModel['hero']): string {
	return typeof hero.backgroundImage.src === 'string'
		? hero.backgroundImage.src
		: hero.backgroundImage.src.src;
}

function buildWrapperData(
	theme: InvitationViewModel['theme'],
	envelope: InvitationViewModel['envelope'],
	eventSlug: string,
	isDemo: boolean,
): { dataAttributes: Record<string, string>; scopedStyles: string } {
	const dataAttributes: Record<string, string> = {
		'data-theme-preset': theme.preset || 'base',
		'data-event-slug': eventSlug,
		'data-reveal-state': envelope.enabled ? 'sealed' : 'revealed',
		'data-is-demo': isDemo ? 'true' : 'false',
	};

	const overrides: Record<string, string> = {};

	if (theme.tokens) {
		for (const [key, value] of Object.entries(theme.tokens)) {
			const kebabKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
			overrides[`--color-${kebabKey}-override`] = value;
		}
	}

	if (theme.colors) {
		for (const [key, value] of Object.entries(theme.colors)) {
			if (key.endsWith('Rgb')) {
				const baseName = key.replace(/Rgb$/, '');
				const kebabKey = baseName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
				overrides[`--color-${kebabKey}-rgb-override`] = value;
			}
		}
	}

	if (envelope.enabled && envelope.data) {
		const { colors } = envelope.data;
		if (colors.background) {
			overrides['--env-bg'] = colors.background;
			overrides['--env-paper-bg'] = colors.background;
		}
		if (colors.primary) overrides['--env-text-primary'] = colors.primary;
		if (colors.accent) overrides['--env-accent'] = colors.accent;
	}

	const overrideStyles = Object.entries(overrides)
		.map(([key, value]) => `${key}: ${value};`)
		.join(' ');

	return {
		dataAttributes,
		scopedStyles: `[data-event-slug="${eventSlug}"] { ${overrideStyles} }`,
	};
}

function resolveFooterVariant(
	eventEntry: EventContentEntry,
	themePreset: ThemeConfig['preset'],
	isPreview?: boolean,
): SharedSectionVariant {
	if (!isPreview) {
		const configuredVariant = eventEntry.data.sectionStyles?.footer?.variant;
		if (configuredVariant) return configuredVariant;
	}

	if (themePreset && (THEME_PRESETS as readonly string[]).includes(themePreset)) {
		return themePreset;
	}

	return 'standard';
}

function buildLayoutData(
	viewModel: InvitationViewModel,
	hero: InvitationViewModel['hero'],
	guestName: string | undefined,
) {
	const sharingImage = viewModel.sharing?.ogImage;
	const imageSrc = sharingImage
		? typeof sharingImage.src === 'string'
			? sharingImage.src
			: sharingImage.src.src
		: resolveHeroImageSrc(hero);

	return {
		title: guestName ? `Invitación para ${guestName}` : viewModel.title,
		description: viewModel.description || '',
		image: imageSrc,
		className: hero.layoutVariant ? `layout--${hero.layoutVariant}` : undefined,
	};
}

function buildWrapper(
	theme: InvitationViewModel['theme'],
	envelope: InvitationViewModel['envelope'],
	eventScopeClass: string,
	eventSlug: string,
	isDemo: boolean,
) {
	const showEnvelope = envelope.enabled;
	return {
		className: ['event-theme-wrapper', eventScopeClass, theme.themeClass]
			.filter(Boolean)
			.join(' '),
		...buildWrapperData(theme, envelope, eventSlug, isDemo),
		showEnvelope,
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

function buildRsvpData(
	rsvpSection: InvitationViewModel['sections']['rsvp'],
	hero: InvitationViewModel['hero'],
	guestContext: InvitationGuestContext | null | undefined,
) {
	if (!rsvpSection) return undefined;

	return {
		...rsvpSection,
		celebrantName: hero.name,
		guestCap: guestContext?.guest.maxAllowedAttendees || rsvpSection.guestCap,
		initialGuestData: guestContext
			? {
					fullName: guestContext.guest.fullName,
					maxAllowedAttendees: guestContext.guest.maxAllowedAttendees,
					inviteId: guestContext.inviteId,
				}
			: undefined,
	};
}

function buildPersonalizedAccess(guestContext: InvitationGuestContext | null | undefined) {
	if (!guestContext) return undefined;

	return {
		guestName: guestContext.guest.fullName,
		maxAllowedAttendees: guestContext.guest.maxAllowedAttendees,
	};
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

export function prepareInvitationPageData(input: {
	eventEntry: EventContentEntry;
	slug: string;
	guestContext?: InvitationGuestContext | null;
	previewTheme?: ThemePreset;
}): InvitationPageData {
	const viewModel = adaptEvent(input.eventEntry, input.previewTheme);
	const { theme, hero, envelope, sections, music, navigation } = viewModel;
	const eventScopeClass = `event--${input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
	const isDemo = input.eventEntry.data.isDemo ?? false;
	const wrapper = buildWrapper(theme, envelope, eventScopeClass, viewModel.id, isDemo);
	const showEnvelope = wrapper.showEnvelope;
	const heroTime = sections.location?.reception?.time ?? sections.location?.ceremony?.time;
	const guestName = input.guestContext?.guest.fullName;
	const footerVariant = resolveFooterVariant(
		input.eventEntry,
		theme.preset,
		!!input.previewTheme,
	);

	return {
		eventSlug: viewModel.id,
		isDemo,
		themePreset: theme.preset,
		layout: buildLayoutData(viewModel, hero, guestName),
		wrapper,
		header: {
			eventName: hero.name,
			theme,
			links: navigation || [],
			variant: theme.preset,
		},
		hero: {
			...hero,
			time: heroTime,
			guestName,
		},
		envelope: buildEnvelopeData(showEnvelope, envelope, viewModel.id, guestName, isDemo),
		sections,
		rsvp: buildRsvpData(sections.rsvp, hero, input.guestContext),
		personalizedAccess: buildPersonalizedAccess(input.guestContext),
		footer: {
			eventSlug: input.slug,
			showEnvelope,
			variant: footerVariant,
		},
		music: music
			? {
					...music,
					variant: theme.preset,
				}
			: undefined,
		renderPlan: buildInvitationRenderPlan(viewModel, {
			hasGuestContext: Boolean(input.guestContext),
		}),
	};
}
