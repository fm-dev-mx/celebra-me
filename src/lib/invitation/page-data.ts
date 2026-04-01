import { adaptEvent } from '@/lib/adapters/event';
import { pickPreset } from '@/lib/adapters/event-helpers';
import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import type { EventContentEntry } from '@/lib/content/events';
import type { getInvitationContextByInviteId } from '@/lib/rsvp/services/invitation-context.service';
import {
	CLIENT_PREVIEW_THEME_PRESETS,
	PREMIERE_THEME_PRESETS,
	type SharedSectionVariant,
	type ThemePreset,
} from '@/lib/theme/theme-contract';
import { type ContentBlockData } from '@/lib/schemas/content/content-block.schema';

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
				city: string;
				date: string;
				eventSlug: string;
				guestName?: string;
				name: string;
				titleMaterial?: 'foil-gold' | 'debossed' | 'standard';
				detailMaterial?: 'debossed' | 'standard';
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
): { dataAttributes: Record<string, string>; scopedStyles: string } {
	const dataAttributes: Record<string, string> = {
		'data-theme-preset': theme.preset || 'base',
		'data-event-slug': eventSlug,
		'data-reveal-state': envelope.enabled ? 'sealed' : 'revealed',
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
		if (envelope.data.variant) {
			dataAttributes['data-env-variant'] = envelope.data.variant;
		}
		if (colors.background) overrides['--env-bg'] = colors.background;
		if (colors.primary) overrides['--env-primary'] = colors.primary;
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
): SharedSectionVariant {
	const configuredVariant = eventEntry.data.sectionStyles?.footer?.variant;
	if (configuredVariant) return configuredVariant;

	if (
		themePreset === 'jewelry-box' ||
		themePreset === 'jewelry-box-wedding' ||
		themePreset === 'luxury-hacienda' ||
		themePreset === 'editorial' ||
		(themePreset && (PREMIERE_THEME_PRESETS as readonly string[]).includes(themePreset))
	) {
		return themePreset;
	}

	return 'standard';
}

function buildLayoutData(
	viewModel: InvitationViewModel,
	hero: InvitationViewModel['hero'],
	guestName: string | undefined,
) {
	return {
		title: guestName ? `Invitación para ${guestName}` : viewModel.title,
		description: viewModel.description || '',
		image: resolveHeroImageSrc(hero),
		className: hero.layoutVariant ? `layout--${hero.layoutVariant}` : undefined,
	};
}

function buildWrapper(
	theme: InvitationViewModel['theme'],
	envelope: InvitationViewModel['envelope'],
	eventScopeClass: string,
	eventSlug: string,
) {
	const showEnvelope = envelope.enabled;
	return {
		className: ['event-theme-wrapper', eventScopeClass, theme.themeClass]
			.filter(Boolean)
			.join(' '),
		...buildWrapperData(theme, envelope, eventSlug),
		showEnvelope,
	};
}

function buildEnvelopeData(
	showEnvelope: boolean,
	envelope: InvitationViewModel['envelope'],
	hero: InvitationViewModel['hero'],
	locationSection: InvitationViewModel['sections']['location'],
	eventSlug: string,
	guestName: string | undefined,
) {
	if (!showEnvelope || !envelope.data) return undefined;

	return {
		...envelope.data,
		name: hero.name,
		date: hero.date,
		city: locationSection?.city || '',
		eventSlug,
		guestName,
		titleMaterial: (envelope.data.variant === 'luxury-hacienda' ||
		envelope.data.variant === 'jewelry-box' ||
		envelope.data.variant === 'jewelry-box-wedding'
			? 'foil-gold'
			: 'standard') as 'foil-gold' | 'debossed' | 'standard',
		detailMaterial: (envelope.data.variant === 'luxury-hacienda' ? 'debossed' : 'standard') as
			| 'debossed'
			| 'standard',
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
	previewTheme?: string | null;
}): InvitationPageData {
	const eventEntry = applyPreviewTheme(input.eventEntry, input.previewTheme);
	const viewModel = adaptEvent(eventEntry);
	const { theme, hero, envelope, sections, music, navigation } = viewModel;
	const eventScopeClass = `event--${input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
	const wrapper = buildWrapper(theme, envelope, eventScopeClass, viewModel.id);
	const showEnvelope = wrapper.showEnvelope;
	const heroTime = sections.location?.reception?.time ?? sections.location?.ceremony?.time;
	const guestName = input.guestContext?.guest.fullName;
	const footerVariant = resolveFooterVariant(eventEntry, theme.preset);

	return {
		eventSlug: viewModel.id,
		isDemo: input.eventEntry.data.isDemo ?? false,
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
		envelope: buildEnvelopeData(
			showEnvelope,
			envelope,
			hero,
			sections.location,
			viewModel.id,
			guestName,
		),
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

function resolvePreviewTheme(
	eventEntry: EventContentEntry,
	previewTheme: string | null | undefined,
): ThemePreset | undefined {
	if (!previewTheme) return undefined;

	if (!(CLIENT_PREVIEW_THEME_PRESETS as readonly string[]).includes(previewTheme)) {
		return undefined;
	}

	const sourcePreset = eventEntry.data.theme.preset;
	if (!sourcePreset || !(PREMIERE_THEME_PRESETS as readonly string[]).includes(sourcePreset)) {
		return undefined;
	}

	return pickPreset(previewTheme);
}

function applyPreviewTheme(
	eventEntry: EventContentEntry,
	previewTheme: string | null | undefined,
): EventContentEntry {
	const resolvedPreviewTheme = resolvePreviewTheme(eventEntry, previewTheme);
	if (!resolvedPreviewTheme) return eventEntry;

	return {
		...eventEntry,
		data: {
			...eventEntry.data,
			theme: {
				...eventEntry.data.theme,
				preset: resolvedPreviewTheme,
			},
			sectionStyles: eventEntry.data.sectionStyles
				? {
						...eventEntry.data.sectionStyles,
						countdown: rewritePreviewVariant(
							eventEntry.data.sectionStyles.countdown,
							resolvedPreviewTheme,
						),
						location: rewritePreviewVariant(
							eventEntry.data.sectionStyles.location,
							resolvedPreviewTheme,
						),
						family: rewritePreviewVariant(
							eventEntry.data.sectionStyles.family,
							resolvedPreviewTheme,
						),
						gallery: rewritePreviewVariant(
							eventEntry.data.sectionStyles.gallery,
							resolvedPreviewTheme,
						),
						gifts: rewritePreviewVariant(
							eventEntry.data.sectionStyles.gifts,
							resolvedPreviewTheme,
						),
						itinerary: rewritePreviewVariant(
							eventEntry.data.sectionStyles.itinerary,
							resolvedPreviewTheme,
						),
						thankYou: rewritePreviewVariant(
							eventEntry.data.sectionStyles.thankYou,
							resolvedPreviewTheme,
						),
						footer: rewritePreviewVariant(
							eventEntry.data.sectionStyles.footer,
							resolvedPreviewTheme,
						),
						rsvp: rewritePreviewVariant(
							eventEntry.data.sectionStyles.rsvp,
							resolvedPreviewTheme,
						),
					}
				: undefined,
			hero: {
				...eventEntry.data.hero,
				variant: rewritePremiereVariantValue(
					eventEntry.data.hero.variant,
					resolvedPreviewTheme,
				),
			},
			envelope: eventEntry.data.envelope
				? {
						...eventEntry.data.envelope,
						variant: rewritePremiereVariantValue(
							eventEntry.data.envelope.variant,
							resolvedPreviewTheme,
						),
					}
				: eventEntry.data.envelope,
			contentBlocks: eventEntry.data.contentBlocks?.map((block: ContentBlockData) =>
				block.type === 'interlude'
					? {
							...block,
							variant: rewritePremiereVariantValue(
								block.variant,
								resolvedPreviewTheme,
							),
						}
					: block,
			),
		},
	} as EventContentEntry;
}

function rewritePremiereVariantValue(
	value: string | undefined,
	previewTheme: ThemePreset,
): ThemePreset | string | undefined {
	if (!value) return value;
	return (PREMIERE_THEME_PRESETS as readonly string[]).includes(value) ? previewTheme : value;
}

function rewritePreviewVariant<T extends { variant?: string } | undefined>(
	value: T,
	previewTheme: ThemePreset,
): T {
	if (!value?.variant) return value;

	return {
		...value,
		variant: rewritePremiereVariantValue(value.variant, previewTheme),
	} as T;
}
