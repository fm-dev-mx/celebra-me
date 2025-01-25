// src/core/interfaces/data/invitation.interface.ts

import type { Meta, SocialData } from './siteData.interface';
import type { MenuData } from './landingPage.interface';

/**
 * Interface representing the data structure for the basic demo page.
 */
export interface InvitationData {
	heroSection: HeroSection;
	meta: Meta;
	menuData: MenuData;
	socialData: SocialData;
	eventDetails: EventDetails;
}

/**
 * Interface for hero section in the demo.
 */
export interface HeroSection {
	title: string;
	subtitle: string;
	image: string;
	altText: string;
	primaryButton: Button;
	secondaryButton: Button;
}

/**
 * Interface for button details.
 */
export interface Button {
	text: string;
	link: string;
}

/**
 * Interface for event details in the demo.
 */
export interface EventDetails {
	title: string;
	description: string;
	images: string[];
	countdown: string;
	itinerary: string[];
	rsvp: Rsvp;
	socialMedia: SocialMedia;
	validity: Validity;
}

/**
 * Interface for RSVP details.
 */
export interface Rsvp {
	enabled: boolean;
	confirmText: string;
}

/**
 * Interface for social media links.
 */
export interface SocialMedia {
	whatsapp?: string; // Changed to string for consistency
	facebook?: string;
	instagram?: string;
	twitter?: string;
}

/**
 * Interface for validity details.
 */
export interface Validity {
	duration: string;
	expiryDate: string;
}
