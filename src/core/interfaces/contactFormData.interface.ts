// src/core/interfaces/contactFormData.interface.ts

/**
 * Interface representing the contact form data.
 */
export interface ContactFormData {
	name: string;
	email: string;
	mobile?: string; // Optional mobile field for contact number
	message: string;
}
