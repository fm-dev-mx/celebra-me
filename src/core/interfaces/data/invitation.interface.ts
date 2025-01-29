// src/core/interfaces/data/invitation.interface.ts

import { NavBarProps } from '../ui/components/navBar.interface';
import { LegacyHeroProps } from '../ui/sections/hero.interface';

/**
 * Interface representing the data structure for the basic demo page.
 */
export interface InvitationData {
	heroSection: LegacyHeroProps;
	navBarData: NavBarProps;
	eventDetails: EventDetails;
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
