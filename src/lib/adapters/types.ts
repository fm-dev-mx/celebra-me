import type { ImageAsset } from '@/lib/assets/asset-registry';
import type {
	CountdownVariant,
	IndicationIconName,
	IndicationStyleVariant,
	ItineraryVariant,
	LocationMapStyle,
	LocationVariant,
	QuoteAnimation,
	QuoteVariant,
	SharedSectionVariant,
	ThemePreset,
} from '@/lib/theme/theme-contract';

export interface ThemeConfig {
	primaryColor: string;
	accentColor?: string;
	fontFamily: 'serif' | 'sans';
	preset?: ThemePreset;
	// Derived CSS class for the body/wrapper
	themeClass: string;
	// Processed RGB values for CSS variables
	colors: {
		primaryRgb: string;
		accentRgb: string;
		[key: string]: string; // Allow dynamic semantic tokens
	};
	// Raw hex semantic tokens
	tokens: Record<string, string>;
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
	variant?: ThemePreset;
	layoutVariant?: string;
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

export interface ItineraryItem {
	icon:
		| 'waltz'
		| 'dinner'
		| 'toast'
		| 'cake'
		| 'party'
		| 'ceremony'
		| 'doll'
		| 'church'
		| 'reception'
		| 'music'
		| 'photo'
		| 'boot'
		| 'heel'
		| 'western-hat'
		| 'taco'
		| 'tuba'
		| 'accordion';
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
	messageTemplate?: string;
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
		sealIcon?: 'boot' | 'heart' | 'monogram' | 'flower' | 'special-edition';
		microcopy: string;
		documentLabel?: string;
		stampText?: string;
		stampYear?: string;
		tooltipText?: string;
		variant?: ThemePreset;
		colors: {
			background: string;
			primary: string;
			accent: string;
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
			labels?: FamilyLabels;
			celebrantName: string;
			variant?: SharedSectionVariant;
		};
		gallery?: {
			title: string;
			subtitle?: string;
			items: Array<{ image: ImageAsset; caption?: string }>;
			variant?: SharedSectionVariant;
		};
		itinerary?: {
			title: string;
			items: ItineraryItem[];
			variant?: ItineraryVariant;
		};
		rsvp?: {
			eventSlug: string;
			title: string;
			guestCap: number;
			confirmationMessage: string;
			showDietaryField: boolean;
			dietaryLabel?: string;
			dietaryPlaceholder?: string;
			confirmationMode: 'api' | 'whatsapp' | 'both';
			whatsappConfig?: WhatsAppConfig;
			variant?: SharedSectionVariant;
			nameLabel?: string;
			guestCountLabel?: string;
			attendanceLabel?: string;
			buttonLabel?: string;
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
}
