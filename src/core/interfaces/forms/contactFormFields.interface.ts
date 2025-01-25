// src/core/interfaces/forms/contactFormFields.interface.ts

/**
 * Interface representing the contact form data submitted by users.
 */
export interface ContactFormFields {
	name: string;
	email: string;
	mobile?: string;
	message: string;
}
