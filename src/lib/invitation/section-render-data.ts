import type { InvitationPageContext } from '@/lib/invitation/page-data';
import type { InvitationRenderPlanItem } from '@/lib/invitation/render-plan';
import type { ContentSectionKey } from '@/lib/theme/theme-contract';
import type {
	InvitationRevealRecipe,
	SectionIntersectionFamily,
	SharedSectionVariant,
} from '@/lib/theme/theme-contract';
import type { PersonalizedAccessVariant } from '@/lib/invitation/section-variants';
import { getContactPhone, isPlaceholderContactPhone } from '@/utils/whatsapp';

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
	eventYear?: string;
	isDemoPreview?: boolean;
	variant?: PersonalizedAccessVariant;
	title?: string;
	subtitle?: string;
	footerText?: string;
	noteText?: string;
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

type DescriptorData =
	| {
			component: 'interlude';
			props: {
				image: InterludeBlock['image'];
				alt: InterludeBlock['alt'];
				height: InterludeBlock['height'];
				variant: SharedSectionVariant;
				focalPoint?: string;
				focalPointDesktop?: string;
				lightX?: string;
				lightY?: string;
				overlayOpacity?: string;
				interludeIndex?: number;
			};
	  }
	| { component: 'quote'; props: SectionData<'quote'> }
	| { component: 'family'; props: SectionData<'family'> }
	| {
			component: 'gallery';
			props: SectionData<'gallery'>;
	  }
	| { component: 'countdown'; props: SectionData<'countdown'> }
	| { component: 'location'; props: LocationProps }
	| {
			component: 'itinerary';
			props: SectionData<'itinerary'> & {
				monogram: string;
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
					attendanceStatus: 'pending' | 'confirmed' | 'declined';
					attendeeCount: number;
					guestComment: string;
				};
				isDemoPreview?: boolean;
			};
	  }
	| { component: 'gifts'; props: GiftsProps }
	| {
			component: 'thankYou';
			props: Omit<SectionData<'thankYou'>, 'closingPhrase'>;
	  }
	| { component: 'personalized-access'; props: PersonalizedAccessProps };

export type InvitationSectionRenderDescriptor = {
	afterInterlude: boolean;
	intersection: SectionIntersectionFamily;
	intersectionSource: string;
	reveal: InvitationRevealRecipe;
	renderMode?: 'interactive' | 'locked';
} & DescriptorData;

const REVEAL_RECIPES: Record<DescriptorData['component'], InvitationRevealRecipe> = {
	interlude: 'media-scale',
	quote: 'fade-up',
	family: 'stagger-group',
	gallery: 'stagger-group',
	countdown: 'stagger-group',
	location: 'stagger-group',
	itinerary: 'stagger-group',
	rsvp: 'fade',
	gifts: 'stagger-group',
	thankYou: 'fade-up',
	'personalized-access': 'fade-up',
};

function resolvePersonalizedAccessConfig(pageContext: InvitationPageContext): {
	isDemoPreview: boolean;
	variant: PersonalizedAccessVariant;
} | null {
	const isDemoPreview = pageContext.isDemoPreview ?? false;
	if (!isDemoPreview && !pageContext.guestContext) return null;

	const variant = pageContext.viewModel.sections.rsvp?.personalizedAccess.variant;
	return variant ? { isDemoPreview, variant } : null;
}

function renderInterlude(block: InterludeBlock) {
	return {
		component: 'interlude' as const,
		props: {
			image: block.image,
			alt: block.alt,
			height: block.height,
			variant: (block.variant ?? 'standard') as SharedSectionVariant,
			focalPoint: block.focalPoint,
			focalPointDesktop: block.focalPointDesktop,
			lightX: block.lightX,
			lightY: block.lightY,
			overlayOpacity: block.overlayOpacity,
		},
	};
}

function renderPersonalizedAccess(pageContext: InvitationPageContext): DescriptorData | null {
	const config = resolvePersonalizedAccessConfig(pageContext);
	if (!config) return null;

	const { isDemoPreview, variant } = config;
	const guestContext = pageContext.guestContext;
	const eventYear = pageContext.viewModel.hero.date
		? new Date(pageContext.viewModel.hero.date).getUTCFullYear().toString()
		: undefined;

	const rsvpSection = pageContext.viewModel.sections.rsvp;

	return {
		component: 'personalized-access' as const,
		props: {
			guestName: guestContext?.guest.fullName ?? DEMO_GUEST_NAME,
			maxAllowedAttendees:
				guestContext?.guest.maxAllowedAttendees ??
				rsvpSection?.guestCap ??
				DEFAULT_DEMO_GUEST_CAP,
			eventYear,
			isDemoPreview,
			variant,
			title: rsvpSection?.personalizedAccess?.title,
			subtitle: rsvpSection?.personalizedAccess?.subtitle,
			footerText: rsvpSection?.personalizedAccess?.footerText,
			noteText: rsvpSection?.personalizedAccess?.noteText,
		},
	};
}

function renderRsvpSection(pageContext: InvitationPageContext): DescriptorData | null {
	const { sections, hero } = pageContext.viewModel;

	if (!sections.rsvp) return null;

	const guestContext = pageContext.guestContext;
	const isDemo = pageContext.viewModel.isDemo;
	const rsvpProps = { ...sections.rsvp };

	if (isDemo) {
		const businessPhone = getContactPhone();
		const hasRealBusinessPhone = !isPlaceholderContactPhone(businessPhone);
		if (hasRealBusinessPhone) {
			if (rsvpProps.whatsappConfig) {
				rsvpProps.whatsappConfig = {
					...rsvpProps.whatsappConfig,
					phone: businessPhone,
				};
			}
		} else {
			// No real business contact configured, change RSVP mode to pure API/screen confirmation
			rsvpProps.confirmationMode = 'api';
		}
	}

	return {
		component: 'rsvp' as const,
		props: {
			...rsvpProps,
			celebrantName: hero.name,
			guestCap: guestContext?.guest.maxAllowedAttendees ?? rsvpProps.guestCap,
			initialGuestData: guestContext
				? {
						fullName: guestContext.guest.fullName,
						maxAllowedAttendees: guestContext.guest.maxAllowedAttendees,
						inviteId: guestContext.inviteId,
						attendanceStatus: guestContext.guest.attendanceStatus,
						attendeeCount: guestContext.guest.attendeeCount,
						guestComment: guestContext.guest.guestComment,
					}
				: undefined,
			isDemoPreview: pageContext.isDemoPreview ?? false,
		},
	};
}

function renderGiftsSection(sections: Sections): DescriptorData | null {
	if (!sections.gifts) return null;

	const { items: gifts, ...rest } = sections.gifts;

	return {
		component: 'gifts' as const,
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

function renderSection(
	pageContext: InvitationPageContext,
	section: RenderableSectionKey,
	nextSectionLink?: LocationProps['nextSectionLink'],
): DescriptorData | null {
	const { sections, hero } = pageContext.viewModel;

	switch (section) {
		case 'quote':
			return sections.quote
				? {
						component: 'quote' as const,
						props: sections.quote,
					}
				: null;

		case 'family':
			return sections.family
				? {
						component: 'family' as const,
						props: {
							...sections.family,
							celebrantName: hero.name,
						},
					}
				: null;

		case 'gallery':
			return sections.gallery
				? {
						component: 'gallery' as const,
						props: sections.gallery,
					}
				: null;

		case 'countdown':
			return sections.countdown
				? {
						component: 'countdown' as const,
						props: sections.countdown,
					}
				: null;

		case 'location':
			return sections.location
				? {
						component: 'location' as const,
						props: {
							...sections.location,
							nextSectionLink,
						},
					}
				: null;

		case 'itinerary': {
			return sections.itinerary
				? {
						component: 'itinerary' as const,
						props: {
							...sections.itinerary,
							monogram: getMonogram(hero.name),
						},
					}
				: null;
		}

		case 'rsvp':
			return renderRsvpSection(pageContext);

		case 'gifts':
			return renderGiftsSection(sections);

		case 'thankYou':
			if (!sections.thankYou) return null;
			{
				const { closingPhrase: _closingPhrase, ...thankYouProps } = sections.thankYou;
				return {
					component: 'thankYou' as const,
					props: thankYouProps,
				};
			}
	}
}

function renderBlock(
	pageContext: InvitationPageContext,
	block: InvitationRenderPlanItem,
	index: number,
	renderPlan: InvitationRenderPlanItem[],
): InvitationSectionRenderDescriptor | null {
	const afterInterlude = index > 0 && renderPlan[index - 1].type === 'interlude';
	const metadata = {
		afterInterlude,
		intersection: block.intersection.family,
		intersectionSource: block.intersection.source,
	};

	switch (block.type) {
		case 'interlude':
			return {
				...renderInterlude(block),
				...metadata,
				reveal: REVEAL_RECIPES.interlude,
			};

		case 'personalized-access':
			return withRenderMetadata(renderPersonalizedAccess(pageContext), metadata);

		case 'section': {
			const nextSectionLink =
				block.section === 'location' ? findNextSectionLink(renderPlan, index) : undefined;

			return withRenderMetadata(
				renderSection(pageContext, block.section, nextSectionLink),
				metadata,
			);
		}
	}
}

function isLockedRsvpDescriptor(descriptor: DescriptorData): boolean {
	return (
		descriptor.component === 'rsvp' &&
		descriptor.props.accessMode === 'personalized-only' &&
		!descriptor.props.initialGuestData?.inviteId &&
		!descriptor.props.isDemoPreview
	);
}

function resolveSectionReveal(descriptor: DescriptorData): InvitationRevealRecipe {
	if (isLockedRsvpDescriptor(descriptor)) return 'none';
	// Magazine-spread can be taller than the stagger observer threshold on mobile.
	if (descriptor.component === 'gallery' && descriptor.props.variant === 'magazine-spread') {
		return 'none';
	}
	return REVEAL_RECIPES[descriptor.component];
}

function withRenderMetadata<T extends DescriptorData>(
	descriptor: T | null,
	metadata: Pick<
		InvitationSectionRenderDescriptor,
		'afterInterlude' | 'intersection' | 'intersectionSource'
	>,
): InvitationSectionRenderDescriptor | null {
	if (!descriptor) return null;

	const isLockedRsvp = isLockedRsvpDescriptor(descriptor);

	return {
		...descriptor,
		...metadata,
		reveal: resolveSectionReveal(descriptor),
		...(descriptor.component === 'rsvp'
			? { renderMode: isLockedRsvp ? ('locked' as const) : ('interactive' as const) }
			: {}),
	};
}

function prioritizePersonalizedAccess(
	descriptors: InvitationSectionRenderDescriptor[],
): InvitationSectionRenderDescriptor[] {
	const paIndex = descriptors.findIndex((d) => d.component === 'personalized-access');
	if (paIndex === -1) return descriptors;

	const before = descriptors.slice(0, paIndex);
	const after = descriptors.slice(paIndex + 1);
	const [personalizedAccess] = descriptors.slice(paIndex, paIndex + 1);

	const quoteIndex = before.findIndex((d) => d.component === 'quote');
	const targetIndex =
		quoteIndex !== -1 ? quoteIndex + 1 : before.findIndex((d) => d.component !== 'interlude');

	const insertAt = targetIndex === -1 ? before.length : targetIndex;
	return [...before.slice(0, insertAt), personalizedAccess, ...before.slice(insertAt), ...after];
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
	const immediateNext = renderPlan[index + 1];
	if (immediateNext?.type === 'interlude') {
		return undefined;
	}

	for (let nextIndex = index + 1; nextIndex < renderPlan.length; nextIndex += 1) {
		const block = renderPlan[nextIndex];
		if (block.type !== 'section') continue;

		const target = SECTION_NAV_TARGETS[block.section];
		if (target) return target;
	}

	return undefined;
}
