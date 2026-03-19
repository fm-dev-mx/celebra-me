import { adaptEvent } from '@/lib/adapters/event';
import type { InvitationViewModel, ThemeConfig } from '@/lib/adapters/types';
import type { EventContentEntry } from '@/lib/content/events';
import {
	buildInvitationRenderPlan,
	type InvitationRenderPlanItem,
} from '@/lib/invitation/render-plan';
import type { getInvitationContextByInviteId } from '@/lib/rsvp/service';

export type InvitationGuestContext = Awaited<ReturnType<typeof getInvitationContextByInviteId>>;

export interface InvitationPagePresenter {
	eventSlug: string;
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
		| ({
				guestName?: string;
				eventSlug: string;
		  } & NonNullable<InvitationViewModel['envelope']['data']> & {
					name: string;
					date: string;
					city: string;
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
	};
	music?:
		| (NonNullable<InvitationViewModel['music']> & {
				variant: ThemeConfig['preset'];
		  })
		| undefined;
	renderPlan: InvitationRenderPlanItem[];
}

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
		if (colors.background) overrides['--env-bg'] = colors.background;
		if (colors.primary) overrides['--env-primary'] = colors.primary;
		if (colors.accent) overrides['--env-accent'] = colors.accent;

		dataAttributes['data-env-state'] = 'ready';
		dataAttributes['data-env-variant'] = envelope.data.variant || theme.preset || 'base';
	}

	const overrideStyles = Object.entries(overrides)
		.map(([key, value]) => `${key}: ${value};`)
		.join(' ');

	const scopedStyles = `[data-event-slug="${eventSlug}"] { ${overrideStyles} }`;

	return { dataAttributes, scopedStyles };
}

export function presentInvitationPage(input: {
	eventEntry: EventContentEntry;
	slug: string;
	guestContext?: InvitationGuestContext | null;
}): InvitationPagePresenter {
	const viewModel = adaptEvent(input.eventEntry);
	const { theme, hero, envelope, sections, music, navigation } = viewModel;
	const eventScopeClass = `event--${input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
	const showEnvelope = envelope.enabled;
	const heroTime = sections.location?.reception?.time ?? sections.location?.ceremony?.time;
	const guestName = input.guestContext?.guest.fullName;

	return {
		eventSlug: viewModel.id,
		themePreset: theme.preset,
		layout: {
			title: guestName ? `Invitación para ${guestName}` : viewModel.title,
			description: viewModel.description || '',
			image: resolveHeroImageSrc(hero),
			className: hero.layoutVariant ? `layout--${hero.layoutVariant}` : undefined,
		},
		wrapper: {
			className: [
				'event-theme-wrapper',
				eventScopeClass,
				theme.themeClass,
				showEnvelope ? 'event-theme-wrapper--sealed' : '',
			]
				.filter(Boolean)
				.join(' '),
			...buildWrapperData(theme, envelope, viewModel.id),
			showEnvelope,
		},
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
		envelope:
			showEnvelope && envelope.data
				? {
						...envelope.data,
						name: hero.name,
						date: hero.date,
						city: sections.location?.city || '',
						eventSlug: viewModel.id,
						guestName,
					}
				: undefined,
		sections,
		rsvp: sections.rsvp && {
			...sections.rsvp,
			celebrantName: hero.name,
			guestCap: input.guestContext?.guest.maxAllowedAttendees || sections.rsvp.guestCap,
			initialGuestData: input.guestContext
				? {
						fullName: input.guestContext.guest.fullName,
						maxAllowedAttendees: input.guestContext.guest.maxAllowedAttendees,
						inviteId: input.guestContext.inviteId,
					}
				: undefined,
		},
		personalizedAccess: input.guestContext
			? {
					guestName: input.guestContext.guest.fullName,
					maxAllowedAttendees: input.guestContext.guest.maxAllowedAttendees,
				}
			: undefined,
		footer: {
			eventSlug: input.slug,
			showEnvelope,
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
