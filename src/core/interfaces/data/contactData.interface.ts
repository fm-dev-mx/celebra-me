// src/core/interfaces/data/contactData.interface.ts
/**
 * Interface for contact details.
 */
export interface ContactData {
	email: string; // Contact email
	contactType: string;
	phoneNumber?: string; // Optional phone number
	address?: Address; // Physical address
}

export interface Address {
	street?: string;
	city?: string;
	state?: string;
	zipCode?: string;
	country?: string;
}
