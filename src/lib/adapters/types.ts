import type { ImageAsset } from '@/lib/assets/asset-registry';
import type {
	ContentSectionKey,
	CountdownVariant,
	IndicationStyleVariant,
	InvitationRenderSectionKey,
	EventType,
	QuoteVariant,
	ThemePreset,
} from '@/lib/theme/theme-contract';
import type { ParentsOrder } from '@/lib/invitation/family-contract';
import type { IconName } from '@/lib/icons/icon-catalog';
import type { EnvelopeSealIcon, RevealCardData } from '@/lib/invitation/reveal-card';
import type { RsvpResponseMessages } from '@/lib/invitation/rsvp-messages';
import type { CountdownTargetSource } from '@/lib/time/event-time';
import type { CountdownUnit } from '@/lib/invitation/countdown-presentation';
import type { FamilyPresentation } from '@/lib/invitation/family-presentation';
import type {
	GalleryLayoutRole,
	GalleryMobileBrowseMode,
	GalleryPresentation,
} from '@/lib/invitation/gallery-presentation';
import type { GiftsPresentation } from '@/lib/invitation/gifts-presentation';
import type { LocationPresentation } from '@/lib/invitation/location-presentation';
import type { z } from 'zod';
import type { EnvelopeRevealVariant } from '@/lib/schemas/content/envelope.schema';
import type { giftItemSchema } from '@/lib/schemas/content/gifts.schema';
import type {
	FamilyVariant,
	GalleryVariant,
	GiftsVariant,
	HeroVariant,
	LocationVariant,
	PersonalizedAccessVariant,
	RsvpVariant,
	ThankYouVariant,
	ItineraryVariant,
} from '@/lib/invitation/section-variants';
import type { InvitationComposition } from '@/lib/invitation/composition-contract';

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
	variant: HeroVariant;
	/** @deprecated Use variant */
	structuralVariant?: HeroVariant;
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

export interface EnvelopeViewModel {
	enabled: boolean;
	data?: {
		sealStyle: 'wax' | 'ribbon' | 'flower' | 'monogram';
		sealIcon?: EnvelopeSealIcon;
		sealInitials?: string;
		sealVariant?: 'wax-organic' | 'wax-medallion' | 'premium-rose' | string;
		sealColor?: string;
		sealImage?: ImageAsset;
		microcopy: string;
		documentLabel?: string;
		stampText?: string;
		stampYear?: string;
		tooltipText?: string;
		variant?: ThemePreset;
		name: string;
		teaserDetails: string;
		guestPlacement?: 'inside-envelope' | 'outside-envelope';
		card: RevealCardData;
		colors: {
			background?: string;
			primary?: string;
			accent?: string;
			sealAccent?: string;
		};
		/** Editorial cover reveal: edition label (e.g. "XV"). When set, triggers editorial-cover reveal instead of envelope. */
		coverEdition?: string;
		/** Editorial cover reveal: volume number (e.g. "1"). */
		coverVolume?: string;
		/** Editorial cover reveal: issue year (e.g. "2027"). */
		coverIssue?: string;
		/** Explicit content reveal variant. Only 'editorial-cover' replaces the standard envelope. */
		revealVariant?: EnvelopeRevealVariant;
	};
}

export interface Interlude {
	image: ImageAsset;
	afterSection: ContentSectionKey;
	alt?: string;
	height: 'screen' | 'tall' | 'medium';
	variant?: ThemePreset;
	focalPoint?: string;
	focalPointDesktop?: string;
	lightX?: string;
	lightY?: string;
	overlayOpacity?: string;
}

export interface InvitationViewModelBrandingVisibility {
	showFooterBranding: boolean;
	showContactCta: boolean;
}

export interface LocationSection {
	visibility?: LocationVisibility;
	presentation?: LocationPresentation;
	variant: LocationVariant;
	/** @deprecated Use variant */
	structuralVariant?: LocationVariant;
	presentationOptions?: {
		showFlourishes?: boolean;
		showNavigationButtons?: boolean;
		revealSurface?: 'section' | 'rsvp';
	};
	isLocked?: boolean;
	lockedTitle?: string;
	lockedMessage?: string;
	lockedCtaLabel?: string;
	ceremony?: VenueBase;
	reception?: Reception;
	venues?: VenueEntry[];
	indications?: Indication[];
	showFlourishes?: boolean;
	showNavigationButtons?: boolean;
	introEyebrow?: string;
	introHeading?: string;
	introLede?: string;
	indicationsHeading?: string;
}

export interface InvitationViewModel {
	id: string; // The event's slug/id
	isDemo: boolean;
	visualProfileId?: string;
	title: string;
	description?: string;
	theme: ThemeConfig;
	hero: HeroViewModel;
	envelope: EnvelopeViewModel;
	brandingVisibility: InvitationViewModelBrandingVisibility;
	sectionOrder?: InvitationRenderSectionKey[];
	composition?: InvitationComposition;

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
			visibleUnits: CountdownUnit[];
			variant?: CountdownVariant;
			/** Demo-only: if true, countdown uses a random target 30-60 days ahead */
			isDemo?: boolean;
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
			presentation?: FamilyPresentation;
			variant: FamilyVariant;
			/** @deprecated Use variant */
			structuralVariant?: FamilyVariant;
			focalPoint?: string;
			labels?: FamilyLabels;
			celebrantName: string;
		};
		gallery?: {
			eyebrow?: string;
			title: string;
			subtitle?: string;
			items: Array<{
				image: ImageAsset;
				alt?: string;
				caption?: string;
				layoutRole?: GalleryLayoutRole;
				focalPoint?: string;
				focalPointMobile?: string;
				focalPointTablet?: string;
				focalPointDesktop?: string;
			}>;
			variant: GalleryVariant;
			visualVariant?: ThemePreset | 'single';
			presentation?: GalleryPresentation;
			mobileBrowse: GalleryMobileBrowseMode;
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
			variant: RsvpVariant;
			/** @deprecated Use variant */
			structuralVariant?: RsvpVariant;
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
			personalizedAccess: {
				variant: PersonalizedAccessVariant;
				/** @deprecated Use variant */
				structuralVariant?: PersonalizedAccessVariant;
				title?: string;
				subtitle?: string;
				footerText?: string;
				noteText?: string;
			};
		};
		gifts?: {
			title?: string;
			subtitle?: string;
			presentation: GiftsPresentation;
			items: GiftItem[];
			variant: GiftsVariant;
			/** @deprecated Use variant */
			structuralVariant?: GiftsVariant;
		};
		thankYou?: {
			message: string;
			closingName: string;
			closingPhrase?: string;
			date?: string;
			image?: ImageAsset;
			focalPoint?: string;
			overlayAnchor?: 'left' | 'right' | 'top' | 'bottom';
			overlaySafeArea?: {
				x: number;
				y: number;
				width: number;
				height: number;
			};
			variant: ThankYouVariant;
			/** @deprecated Use variant */
			structuralVariant?: ThankYouVariant;
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
