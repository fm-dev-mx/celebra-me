import type { InvitationPageContext, InvitationRenderPlanItem } from '@/lib/invitation/page-data';
import type { ContentSectionKey } from '@/lib/theme/theme-contract';
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';

type Sections = InvitationPageContext['viewModel']['sections'];
type SectionData<K extends keyof Sections> = NonNullable<Sections[K]>;
type RenderableSectionKey = Extract<InvitationRenderPlanItem, { type: 'section' }>['section'];
type InterludeBlock = Extract<InvitationRenderPlanItem, { type: 'interlude' }>;

type LocationProps = SectionData<'location'> & {
	nextSectionLink?: {
		href: string;
		label?: string;
	};
};

type GiftsProps = Omit<SectionData<'gifts'>, 'items'> & {
	gifts: SectionData<'gifts'>['items'];
};

type PersonalizedAccessProps = {
	guestName: string;
	maxAllowedAttendees: number;
	isDemoPreview?: boolean;
	variant?: ThemePreset;
};

export const DEMO_GUEST_NAME = 'María Fernanda Solís';
const DEFAULT_DEMO_GUEST_CAP = 2;

const SECTION_NAV_TARGETS: Partial<Record<ContentSectionKey, { href: string; label: string }>> = {
	quote: { href: '#quote-section', label: 'Mensaje' },
	family: { href: '#family-section', label: 'Familia' },
	gallery: { href: '#galeria', label: 'Galería' },
	countdown: { href: '#countdown', label: 'Cuenta regresiva' },
	location: { href: '#event-location', label: 'Ubicación' },
	itinerary: { href: '#itinerary', label: 'Itinerario' },
	rsvp: { href: '#rsvp', label: 'Pases y Confirmación' },
	gifts: { href: '#regalos', label: 'Regalos' },
	thankYou: { href: '#thank-you-section', label: 'Despedida' },
};

export type InvitationSectionRenderDescriptor =
	| {
			component: 'interlude';
			props: {
				image: InterludeBlock['image'];
				alt: InterludeBlock['alt'];
				height: InterludeBlock['height'];
				variant: ThemePreset;
				focalPoint?: string;
				lightX?: string;
				lightY?: string;
				overlayOpacity?: string;
				interludeIndex?: number;
			};
	  }
	| { component: 'quote'; props: SectionData<'quote'> & { variant: ThemePreset } }
	| { component: 'family'; props: SectionData<'family'> & { variant: ThemePreset } }
	| { component: 'gallery'; props: SectionData<'gallery'> & { variant: ThemePreset } }
	| { component: 'countdown'; props: SectionData<'countdown'> & { variant: ThemePreset } }
	| { component: 'location'; props: LocationProps & { variant: ThemePreset } }
	| {
			component: 'itinerary';
			props: SectionData<'itinerary'> & {
				variant: ThemePreset;
				monogram: string;
				subtitle?: string;
			};
	  }
	| {
			component: 'rsvp';
			props: SectionData<'rsvp'> & {
				celebrantName: string;
				guestCap: number;
				initialGuestData?: {
					fullName: string;
					maxAllowedAttendees: number;
					inviteId: string;
				};
				isDemoPreview?: boolean;
			};
	  }
	| { component: 'gifts'; props: GiftsProps }
	| {
			component: 'thankYou';
			props: SectionData<'thankYou'> & {
				variant: ThemePreset;
				showThankYouBranding: boolean;
			};
	  }
	| { component: 'personalized-access'; props: PersonalizedAccessProps };

function renderInterlude(
	pageContext: InvitationPageContext,
	block: InterludeBlock,
): InvitationSectionRenderDescriptor {
	return {
		component: 'interlude',
		props: {
			image: block.image,
			alt: block.alt,
			height: block.height,
			variant: block.variant ?? pageContext.viewModel.theme.preset ?? THEME_PRESETS[0],
			focalPoint: block.focalPoint,
			lightX: block.lightX,
			lightY: block.lightY,
			overlayOpacity: block.overlayOpacity,
		},
	};
}

function renderPersonalizedAccess(
	pageContext: InvitationPageContext,
): InvitationSectionRenderDescriptor | null {
	const isDemoPreview = pageContext.isDemoPreview ?? false;
	if (!isDemoPreview && !pageContext.guestContext) return null;

	const guestContext = pageContext.guestContext;
	const variant = pageContext.viewModel.theme.preset ?? THEME_PRESETS[0];

	return {
		component: 'personalized-access',
		props: {
			guestName: guestContext?.guest.fullName ?? DEMO_GUEST_NAME,
			maxAllowedAttendees:
				guestContext?.guest.maxAllowedAttendees ??
				pageContext.viewModel.sections.rsvp?.guestCap ??
				DEFAULT_DEMO_GUEST_CAP,
			isDemoPreview,
			variant,
		},
	};
}

function renderRsvpSection(
	pageContext: InvitationPageContext,
	themePreset: ThemePreset,
): InvitationSectionRenderDescriptor | null {
	const { sections, hero } = pageContext.viewModel;

	if (!sections.rsvp) return null;

	const guestContext = pageContext.guestContext;

	return {
		component: 'rsvp',
		props: {
			...sections.rsvp,
			variant: sectionVariant(sections.rsvp, themePreset),
			celebrantName: hero.name,
			guestCap: guestContext?.guest.maxAllowedAttendees ?? sections.rsvp.guestCap,
			initialGuestData: guestContext
				? {
						fullName: guestContext.guest.fullName,
						maxAllowedAttendees: guestContext.guest.maxAllowedAttendees,
						inviteId: guestContext.inviteId,
					}
				: undefined,
			isDemoPreview: pageContext.isDemoPreview ?? false,
		},
	};
}

function renderGiftsSection(sections: Sections): InvitationSectionRenderDescriptor | null {
	if (!sections.gifts) return null;

	const { items: gifts, ...rest } = sections.gifts;

	return {
		component: 'gifts',
		props: {
			...rest,
			gifts,
		},
	};
}

function getMonogram(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((n) => n[0])
		.join('')
		.toUpperCase();
}

function sectionVariant<T extends { variant?: ThemePreset }>(
	sectionData: T,
	fallback: ThemePreset,
): ThemePreset {
	return sectionData.variant ?? fallback;
}

function renderSection(
	pageContext: InvitationPageContext,
	section: RenderableSectionKey,
	nextSectionLink?: LocationProps['nextSectionLink'],
): InvitationSectionRenderDescriptor | null {
	const { sections, theme, hero } = pageContext.viewModel;
	const variant = theme?.preset ?? THEME_PRESETS[0];

	switch (section) {
		case 'quote':
			return sections.quote
				? {
						component: 'quote',
						props: {
							...sections.quote,
							variant: sectionVariant(sections.quote, variant),
						},
					}
				: null;

		case 'family':
			return sections.family
				? {
						component: 'family',
						props: {
							...sections.family,
							celebrantName: hero.name,
							variant: sectionVariant(sections.family, variant),
						},
					}
				: null;

		case 'gallery':
			return sections.gallery
				? {
						component: 'gallery',
						props: {
							...sections.gallery,
							variant: sectionVariant(sections.gallery, variant),
						},
					}
				: null;

		case 'countdown':
			return sections.countdown
				? {
						component: 'countdown',
						props: {
							...sections.countdown,
							variant: sectionVariant(sections.countdown, variant),
						},
					}
				: null;

		case 'location':
			return sections.location
				? {
						component: 'location',
						props: {
							...sections.location,
							nextSectionLink,
							variant: sectionVariant(sections.location, variant),
						},
					}
				: null;

		case 'itinerary': {
			return sections.itinerary
				? {
						component: 'itinerary',
						props: {
							...sections.itinerary,
							variant: sectionVariant(sections.itinerary, variant),
							monogram: getMonogram(hero.name),
							subtitle: sections.itinerary.subtitle,
						},
					}
				: null;
		}

		case 'rsvp':
			return renderRsvpSection(pageContext, variant);

		case 'gifts':
			return renderGiftsSection(sections);

		case 'thankYou':
			return sections.thankYou
				? {
						component: 'thankYou',
						props: {
							...sections.thankYou,
							variant: sectionVariant(sections.thankYou, variant),
							showThankYouBranding:
								pageContext.viewModel.brandingVisibility.showThankYouBranding,
						},
					}
				: null;
	}
}

function renderBlock(
	pageContext: InvitationPageContext,
	block: InvitationRenderPlanItem,
	index: number,
	renderPlan: InvitationRenderPlanItem[],
): InvitationSectionRenderDescriptor | null {
	switch (block.type) {
		case 'interlude':
			return renderInterlude(pageContext, block);

		case 'personalized-access':
			return renderPersonalizedAccess(pageContext);

		case 'section': {
			const nextSectionLink =
				block.section === 'location' ? findNextSectionLink(renderPlan, index) : undefined;

			return renderSection(pageContext, block.section, nextSectionLink);
		}
	}
}

// Personalized access should feel attached to the human message, preferably just after Quote.
function prioritizePersonalizedAccess(
	descriptors: InvitationSectionRenderDescriptor[],
): InvitationSectionRenderDescriptor[] {
	const paIndex = descriptors.findIndex((d) => d.component === 'personalized-access');
	if (paIndex === -1) return descriptors;

	const [personalizedAccess] = descriptors.splice(paIndex, 1);

	// Find the best insertion point: after Quote if possible, otherwise after the first content block.
	const quoteIndex = descriptors.findIndex((d) => d.component === 'quote');
	const targetIndex =
		quoteIndex !== -1
			? quoteIndex + 1
			: descriptors.findIndex((d) => d.component !== 'interlude');

	descriptors.splice(targetIndex === -1 ? 0 : targetIndex, 0, personalizedAccess);

	return descriptors;
}

export function buildInvitationSectionRenderDescriptors(
	pageContext: InvitationPageContext,
): InvitationSectionRenderDescriptor[] {
	const descriptors = pageContext.renderPlan
		.map((block, index) => renderBlock(pageContext, block, index, pageContext.renderPlan))
		.filter((block): block is InvitationSectionRenderDescriptor => block !== null);

	if (pageContext.viewModel.sectionOrder) return descriptors;

	return prioritizePersonalizedAccess(descriptors);
}

function findNextSectionLink(
	renderPlan: InvitationRenderPlanItem[],
	index: number,
): LocationProps['nextSectionLink'] {
	for (let nextIndex = index + 1; nextIndex < renderPlan.length; nextIndex += 1) {
		const block = renderPlan[nextIndex];
		if (block.type !== 'section') continue;

		const target = SECTION_NAV_TARGETS[block.section];
		if (target) return target;
	}

	return undefined;
}
