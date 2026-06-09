import type { ImageAsset } from '@/lib/assets/asset-registry';
import type {
	ContentSectionKey,
	CountdownVariant,
	IndicationStyleVariant,
	InvitationRenderSectionKey,
	ItineraryVariant,
	LocationVariant,
	QuoteVariant,
	SharedSectionVariant,
	ThemePreset,
} from '@/lib/theme/theme-contract';
import type { ParentsOrder } from '@/lib/intake/types';
import type { IconName } from '@/lib/icons/icon-catalog';
import type { EnvelopeSealIcon, RevealCardData } from '@/lib/invitation/reveal-card';
import type { RsvpResponseMessages } from '@/components/invitation/rsvp-logic';

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

export interface Coordinate {
	lat: number;
	lng: number;
}

export interface Ceremony {
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

export interface Reception {
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

export type GiftItem =
	| { type: 'store'; title: string; url: string; logo?: string }
	| {
			type: 'bank';
			title: string;
			bankName: string;
			accountHolder: string;
			clabe: string;
			accountNumber?: string;
	  }
	| { type: 'paypal'; title: string; url: string }
	| { type: 'cash'; title: string; text?: string };

export interface EnvelopeViewModel {
	enabled: boolean;
	data?: {
		sealStyle: 'wax' | 'ribbon' | 'flower' | 'monogram';
		sealIcon?: EnvelopeSealIcon;
		sealInitials?: string;
		microcopy: string;
		documentLabel?: string;
		stampText?: string;
		stampYear?: string;
		tooltipText?: string;
		variant?: ThemePreset;
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
	height: 'screen' | 'tall';
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
			eventDate: string;
			title: string;
			footerText?: string;
			variant?: CountdownVariant;
		};
		location?: {
			ceremony?: Ceremony;
			reception?: Reception;
			indications?: Indication[];
			variant?: LocationVariant;
			showFlourishes?: boolean;
			introEyebrow?: string;
			introHeading?: string;
			introLede?: string;
			indicationsHeading?: string;
		};
		family?: {
			parents?: Parents;
			parentsOrder?: ParentsOrder;
			spouse?: string;
			children?: FamilyMember[];
			godparents?: FamilyMember[];
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
			variant?: SharedSectionVariant;
		};
		itinerary?: {
			title: string;
			subtitle?: string;
			items: ItineraryItem[];
			variant?: ItineraryVariant;
		};
		rsvp?: {
			eventSlug: string;
			eventType: 'xv' | 'boda' | 'bautizo' | 'cumple';
			subcopy?: string;
			title: string;
			guestCap: number;
			accessMode: 'personalized-only' | 'hybrid';
			confirmationMessage: string;
			confirmationMode: 'api' | 'whatsapp' | 'both';
			whatsappConfig?: WhatsAppConfig;
			responseMessages?: RsvpResponseMessages;
			variant?: SharedSectionVariant;
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
			whatsappWithPhone: string;
			whatsappWithoutPhone: string;
		};
		ogImage?: ImageAsset;
	};
}
