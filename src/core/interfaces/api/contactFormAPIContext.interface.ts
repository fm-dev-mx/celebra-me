// src/core/interfaces/api/contactFormAPIContext.interface.ts

import { ContactFormFields } from '@/core/interfaces/forms/contactFormFields.interface';

/**
 * Interface representing the context for the Contact Form API.
 */
export interface ContactFormAPIContext {
	request: Request;
	clientIp?: string;
	validatedData?: ContactFormFields;
	user?: {
		id: string;
	};
	// Add other properties as needed
}
