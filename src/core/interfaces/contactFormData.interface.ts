// src/core/interfaces/contactFormData.interface.ts

/**
 * Interface representing the contact form data submitted by users.
 */
export interface ContactFormData {
	name: string;
	email: string;
	mobile?: string;
	message: string;
}
