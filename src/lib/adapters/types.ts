import type { ImageAsset } from '@/lib/assets/asset-registry';
import type {
	ContentSectionKey,
	CountdownVariant,
	IndicationStyleVariant,
	InvitationRenderSectionKey,
	EventType,
	ItineraryVariant,
	LocationVariant,
	QuoteVariant,
	SharedSectionVariant,
	ThemePreset,
} from '@/lib/theme/theme-contract';
import type { ParentsOrder } from '@/lib/intake/types';
import type { IconName } from '@/lib/icons/icon-catalog';
import type { EnvelopeSealIcon, RevealCardData } from '@/lib/invitation/reveal-card';
import type { RsvpResponseMessages } from '@/lib/invitation/rsvp-messages';
import type { CountdownTargetSource } from '@/lib/time/event-time';
import type { z } from 'zod';
import type { giftItemSchema } from '@/lib/schemas/content/gifts.schema';

export interface ThemeConfig {
	preset: ThemePreset;
	// Derived CSS class for the body/wrapper
	themeClass: string;
}

export interface HeroViewModel {
	name: string;
	secondaryName?: string;
	label: string;
	nickname?: string;
	date: string;
	venueName?: string;
	backgroundImage: ImageAsset;
	backgroundImageDesktop?: { src: string };
	backgroundImageMobile?: ImageAsset;
	portrait?: ImageAsset;
	variant: ThemePreset;
	focalPoint?: string;
	focalPointMobile?: string;
	focalPointTablet?: string;
	focalPointDesktop?: string;
	scrollLabel?: string;
}

export type LocationVisibility = 'public' | 'after-rsvp';

export interface Coordinate {
	lat: number;
	lng: number;
}

export interface VenueBase {
	venueEvent: string;
	venueName: string;
	address: string;
	city?: string;
	date: string;
	time: string;
	mapUrl?: string;
	appleMapsUrl?: string;
	googleMapsUrl?: string;
	wazeUrl?: string;
	image?: ImageAsset;
	coordinates?: Coordinate;
}

export interface ItineraryItem {
	iconName: IconName;
	label: string;
	description?: string;
	time: string;
}

export interface VenueEntry extends VenueBase {
	id?: string;
	type?: string;
	label?: string;
	isVisible?: boolean;
	sortOrder?: number;
}

export interface Reception extends VenueBase {
	itinerary?: ItineraryItem[];
}

export interface Indication {
	iconName: IconName;
	styleVariant: IndicationStyleVariant;
	text: string;
}

export interface Parents {
	father?: string;
	mother?: string;
	fatherDeceased?: boolean;
	motherDeceased?: boolean;
}

export interface FamilyLabels {
	sectionTitle?: string;
	sectionSubtitle?: string;
	spouseTitle?: string;
	spouseRole?: string;
	childrenTitle?: string;
	parentsTitle?: string;
	godparentsTitle?: string;
	sectionMessage?: string;
}

export interface FamilyMember {
	name: string;
	role?: string;
	deceased?: boolean;
}

export interface GodparentGroup {
	honoreeName: string;
	label?: string;
	godparents: FamilyMember[];
}

export interface FamilyGroup {
	title: string;
	items: FamilyMember[];
}

export interface WhatsAppConfig {
	phone: string;
	confirmedTemplate?: string;
	declinedTemplate?: string;
	omitTitle?: boolean;
}

export type GiftItem = z.infer<typeof giftItemSchema>;

export type GalleryVariant = SharedSectionVariant | 'single';

export interface EnvelopeViewModel {
	enabled: boolean;
	data?: {
		sealStyle: 'wax' | 'ribbon' | 'flower' | 'monogram';
		sealIcon?: EnvelopeSealIcon;
		sealInitials?: string;
		sealVariant?: 'premium-rose';
		sealImage?: ImageAsset;
		microcopy: string;
		documentLabel?: string;
		stampText?: string;
		stampYear?: string;
		tooltipText?: string;
		variant?: ThemePreset;
		name: string;
		teaserDetails: string;
		card: RevealCardData;
		colors: {
			background?: string;
			primary?: string;
			accent?: string;
		};
	};
}

export interface Interlude {
	image: ImageAsset;
	afterSection: ContentSectionKey;
	alt?: string;
	height: 'screen' | 'tall' | 'medium';
	variant?: SharedSectionVariant;
	focalPoint?: string;
	lightX?: string;
	lightY?: string;
	overlayOpacity?: string;
}

export interface InvitationViewModelBrandingVisibility {
	showFooterBranding: boolean;
	showContactCta: boolean;
	showThankYouBranding: boolean;
}

export interface LocationSection {
	visibility?: LocationVisibility;
	isLocked?: boolean;
	lockedTitle?: string;
	lockedMessage?: string;
	lockedCtaLabel?: string;
	ceremony?: VenueBase;
	reception?: Reception;
	venues?: VenueEntry[];
	indications?: Indication[];
	variant?: LocationVariant;
	showFlourishes?: boolean;
	introEyebrow?: string;
	introHeading?: string;
	introLede?: string;
	indicationsHeading?: string;
}

export interface InvitationViewModel {
	id: string; // The event's slug/id
	isDemo: boolean;
	title: string;
	description?: string;
	theme: ThemeConfig;
	hero: HeroViewModel;
	envelope: EnvelopeViewModel;
	brandingVisibility: InvitationViewModelBrandingVisibility;
	sectionOrder?: InvitationRenderSectionKey[];

	// Sections (Normalized and resolved)
	sections: {
		quote?: {
			text: string;
			author?: string;
			variant?: QuoteVariant;
		};
		countdown?: {
			targetIso: string;
			targetSource: CountdownTargetSource;
			eventTimeZone?: string;
			title: string;
			footerText?: string;
			variant?: CountdownVariant;
		};
		location?: LocationSection;
		family?: {
			parents?: Parents;
			parentsOrder?: ParentsOrder;
			spouse?: string;
			children?: FamilyMember[];
			godparents?: FamilyMember[];
			godparentGroups?: GodparentGroup[];
			groups?: FamilyGroup[];
			featuredImage?: ImageAsset;
			focalPoint?: string;
			labels?: FamilyLabels;
			celebrantName: string;
			variant?: SharedSectionVariant;
		};
		gallery?: {
			eyebrow?: string;
			title: string;
			subtitle?: string;
			items: Array<{
				image: ImageAsset;
				caption?: string;
				focalPoint?: string;
				focalPointMobile?: string;
				focalPointTablet?: string;
				focalPointDesktop?: string;
			}>;
			variant: GalleryVariant;
			presentation?: 'pet-keepsake';
		};
		itinerary?: {
			title: string;
			subtitle?: string;
			items: ItineraryItem[];
			variant?: ItineraryVariant;
		};
		rsvp?: {
			eventSlug: string;
			eventType: EventType;
			subcopy?: string;
			title: string;
			guestCap: number;
			locationVisibility?: LocationVisibility;
			accessMode: 'personalized-only' | 'hybrid';
			confirmationMessage: string;
			confirmationMode: 'api' | 'whatsapp' | 'both';
			whatsappConfig?: WhatsAppConfig;
			responseMessages?: RsvpResponseMessages;
			variant?: SharedSectionVariant;
			revealedLocation?: LocationSection;
			/**
			 * Controls whether the guest can change their RSVP response after
			 * submission:
			 * - `undefined` → uses the platform default (currently enabled).
			 * - `true` → explicitly enables response editing.
			 * - `false` → explicitly disables response editing.
			 */
			allowResponseEditing?: boolean;
			eventStartsAt?: string;
			eventTimeZone?: string;
			labels?: {
				name?: string;
				guestCount?: string;
				attendance?: string;
				confirmButton?: string;
			};
		};
		gifts?: {
			title?: string;
			subtitle?: string;
			items: GiftItem[];
			variant?: SharedSectionVariant;
		};
		thankYou?: {
			message: string;
			closingName: string;
			image?: ImageAsset;
			focalPoint?: string;
			overlayAnchor?: 'left' | 'right' | 'top' | 'bottom';
			overlaySafeArea?: {
				x: number;
				y: number;
				width: number;
				height: number;
			};
			variant?: SharedSectionVariant;
		};
	};

	music?: {
		url: string;
		autoPlay: boolean;
		title?: string;
		revealMode: 'envelope' | 'immediate';
	};
	interludes?: Interlude[];
	navigation?: Array<{ label: string; href: string }>;
	sharing?: {
		whatsappTemplate?: string;
		shareMessages?: {
			invitation: string;
			reminder: string;
		};
		ogImage?: ImageAsset;
		ogDescription?: string;
	};
}
