// src/core/interfaces/basicDemo.interface.ts

import type { Meta, SocialData } from './siteData.interface';
import type { MenuData } from './landingPage.interface';

/**
 * Interface representing the data structure for the basic demo page.
 */
export interface BasicDemoData {
	meta: Meta;
	menuData: MenuData;
	socialData: SocialData;
	eventDetails: EventDetails;
}

/**
 * Interface for event details in the demo.
 */
export interface EventDetails {
	title: string;
	description: string;
	images: string[];
	countdown: Date; // Changed from string to Date for better type safety
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
	expiryDate: Date; // Changed from string to Date for better type safety
}
