import type { ImageAsset } from '@/lib/assets/asset-registry';

export interface ThemeConfig {
	primaryColor: string;
	accentColor?: string;
	fontFamily: 'serif' | 'sans';
	preset?: 'jewelry-box' | 'luxury-hacienda';
	// Derived CSS class for the body/wrapper
	themeClass: string;
	// Processed RGB values for CSS variables
	colors: {
		primaryRgb: string;
		accentRgb: string;
	};
}

export interface HeroViewModel {
	name: string;
	label: string;
	nickname?: string;
	date: string;
	venueName: string;
	backgroundImage: ImageAsset;
	portrait?: ImageAsset;
	variant?: 'jewelry-box' | 'luxury-hacienda';
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
		| 'church'
		| 'reception'
		| 'music'
		| 'photo'
		| 'boot'
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
	image?: string;
	coordinates?: Coordinate;
	itinerary?: ItineraryItem[];
	countdown?: {
		title: string;
		subtitlePrefix: string;
		footerText: string;
	};
}

export interface Indication {
	icon: 'crown' | 'envelope' | 'forbidden' | 'dress' | 'gift' | 'western-hat';
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
		variant?: 'jewelry-box' | 'luxury-hacienda';
		colors: {
			background: string;
			primary: string;
			accent: string;
		};
	};
}

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
			variant?:
				| 'elegant'
				| 'modern'
				| 'minimal'
				| 'floral'
				| 'jewelry-box'
				| 'luxury-hacienda';
			animation?: 'fade' | 'bounce' | 'elastic' | 'none';
		};
		countdown?: {
			eventDate: string;
			title: string;
			subtitlePrefix: string;
			footerText: string;
			variant?:
				| 'minimal'
				| 'vibrant'
				| 'classic'
				| 'modern'
				| 'jewelry-box'
				| 'luxury-hacienda';
			showParticles?: boolean;
		};
		location?: {
			ceremony?: Ceremony;
			reception?: Reception;
			indications?: Indication[];
			variant?:
				| 'structured'
				| 'organic'
				| 'minimal'
				| 'luxury'
				| 'jewelry-box'
				| 'luxury-hacienda';
			mapStyle?: 'dark' | 'colorful' | 'minimal' | 'satellite';
			showFlourishes?: boolean;
			city: string;
			venueName: string;
		};
		family?: {
			parents?: Parents;
			spouse?: string;
			children?: FamilyMember[];
			godparents?: FamilyMember[];
			featuredImage?: ImageAsset;
			labels?: FamilyLabels;
			celebrantName: string;
			variant?: 'standard' | 'jewelry-box' | 'luxury-hacienda';
		};
		gallery?: {
			title: string;
			subtitle?: string;
			items: Array<{ image: ImageAsset; caption?: string }>;
			variant?: 'standard' | 'jewelry-box' | 'luxury-hacienda';
		};
		itinerary?: {
			title: string;
			items: ItineraryItem[];
			variant?: 'base' | 'jewelry-box' | 'luxury-hacienda';
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
			variant?: 'standard' | 'jewelry-box' | 'luxury-hacienda';
			nameLabel?: string;
			guestCountLabel?: string;
			attendanceLabel?: string;
			buttonLabel?: string;
		};
		gifts?: {
			title?: string;
			subtitle?: string;
			items: GiftItem[];
			variant?: 'standard' | 'jewelry-box' | 'luxury-hacienda';
		};
		thankYou?: {
			message: string;
			closingName: string;
			image?: ImageAsset;
			variant?: 'standard' | 'jewelry-box' | 'luxury-hacienda';
		};
	};

	music?: {
		url: string;
		autoPlay: boolean;
		title?: string;
		revealMode: 'envelope' | 'immediate';
	};
	navigation?: Array<{ label: string; href: string }>;
}
