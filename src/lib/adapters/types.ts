import type { ImageAsset } from '@/lib/assets/asset-registry';
import type {
	CountdownVariant,
	FamilyLayoutVariant,
	IndicationIconName,
	IndicationStyleVariant,
	HeroLayoutVariant,
	ItineraryVariant,
	LocationMapStyle,
	LocationVariant,
	QuoteAnimation,
	QuoteVariant,
	SharedSectionVariant,
	ThemePreset,
} from '@/lib/theme/theme-contract';
import type { EnvelopeSealIcon, RevealCardData } from '@/lib/invitation/reveal-card';

export interface ThemeConfig {
	preset?: ThemePreset;
	// Derived CSS class for the body/wrapper
	themeClass: string;
}

export interface HeroViewModel {
	name: string;
	secondaryName?: string;
	label: string;
	nickname?: string;
	date: string;
	venueName: string;
	backgroundImage: ImageAsset;
	portrait?: ImageAsset;
	portraitAlt?: ImageAsset;
	family?: ImageAsset;
	variant?: ThemePreset;
	layoutVariant?: HeroLayoutVariant;
}

export interface Coordinate {
	lat: number;
	lng: number;
}

export interface Ceremony {
	venueEvent: string;
	venueName: string;
	address: string;
	date: string;
	time: string;
	mapUrl?: string;
	appleMapsUrl?: string;
	googleMapsUrl?: string;
	wazeUrl?: string;
	image?: ImageAsset;
	coordinates?: Coordinate;
}

export const ITINERARY_ICON_KEYS = [
	'waltz',
	'dinner',
	'toast',
	'cake',
	'party',
	'church',
	'reception',
	'photo',
	'boot',
	'heel',
	'western-hat',
	'taco',
	'tuba',
	'accordion',
] as const;

export type ItineraryIconKey = (typeof ITINERARY_ICON_KEYS)[number];

export const ITINERARY_ICON_DISPLAY_NAMES: Record<ItineraryIconKey, string> = {
	waltz: 'Waltz',
	dinner: 'Dinner',
	toast: 'Toast',
	cake: 'Cake',
	party: 'Party',
	church: 'Church',
	reception: 'Reception',
	photo: 'Photo',
	boot: 'Boot',
	heel: 'Heel',
	'western-hat': 'WesternHat',
	taco: 'Taco',
	tuba: 'Tuba',
	accordion: 'Accordion',
};

export interface ItineraryItem {
	icon: ItineraryIconKey;
	label: string;
	description?: string;
	time: string;
}

export interface Reception {
	venueEvent: string;
	venueName: string;
	address: string;
	date: string;
	time: string;
	mapUrl?: string;
	appleMapsUrl?: string;
	googleMapsUrl?: string;
	wazeUrl?: string;
	image?: ImageAsset;
	coordinates?: Coordinate;
	itinerary?: ItineraryItem[];
	countdown?: {
		title: string;
		subtitlePrefix: string;
		footerText: string;
	};
}

export interface Indication {
	iconName: IndicationIconName;
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

export type ContentSectionKey =
	| 'quote'
	| 'countdown'
	| 'location'
	| 'family'
	| 'itinerary'
	| 'gallery'
	| 'rsvp'
	| 'gifts'
	| 'thankYou';

export type ContentBlock =
	| {
			type: 'section';
			section: ContentSectionKey;
	  }
	| {
			type: 'interlude';
			image: ImageAsset;
			alt: string;
			height: 'screen' | 'tall';
			variant?: SharedSectionVariant;
			focalPoint?: string;
	  };

export interface InvitationViewModel {
	id: string; // The event's slug/id
	isDemo: boolean;
	title: string;
	description?: string;
	theme: ThemeConfig;
	hero: HeroViewModel;
	envelope: EnvelopeViewModel;

	// Sections (Normalized and resolved)
	sections: {
		quote?: {
			text: string;
			author?: string;
			variant?: QuoteVariant;
			animation?: QuoteAnimation;
		};
		countdown?: {
			eventDate: string;
			title: string;
			subtitlePrefix: string;
			footerText: string;
			variant?: CountdownVariant;
			showParticles?: boolean;
		};
		location?: {
			ceremony?: Ceremony;
			reception?: Reception;
			indications?: Indication[];
			variant?: LocationVariant;
			mapStyle?: LocationMapStyle;
			showFlourishes?: boolean;
			indicationsHeading?: string;
			city: string;
			venueName: string;
		};
		family?: {
			parents?: Parents;
			spouse?: string;
			children?: FamilyMember[];
			godparents?: FamilyMember[];
			groups?: FamilyGroup[];
			featuredImage?: ImageAsset;
			focalPoint?: string;
			labels?: FamilyLabels;
			celebrantName: string;
			variant?: SharedSectionVariant;
			layoutVariant?: FamilyLayoutVariant;
		};
		gallery?: {
			title: string;
			subtitle?: string;
			items: Array<{ image: ImageAsset; caption?: string }>;
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
			title: string;
			guestCap: number;
			accessMode: 'personalized-only' | 'hybrid';
			confirmationMessage: string;
			confirmationMode: 'api' | 'whatsapp' | 'both';
			whatsappConfig?: WhatsAppConfig;
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
			variant?: SharedSectionVariant;
		};
	};

	music?: {
		url: string;
		autoPlay: boolean;
		title?: string;
		revealMode: 'envelope' | 'immediate';
	};
	contentBlocks?: ContentBlock[];
	navigation?: Array<{ label: string; href: string }>;
	sharing?: {
		whatsappTemplate?: string;
		ogImage?: ImageAsset;
	};
}
