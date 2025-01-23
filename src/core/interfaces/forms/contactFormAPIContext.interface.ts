// src/core/interfaces/forms/contactFormAPIContext.interface.ts

import { ContactFormData } from '@interfaces/forms/contactFormData.interface';

/**
 * Interface representing the context for the Contact Form API.
 */
export interface ContactFormAPIContext {
	request: Request;
	clientIp?: string;
	validatedData?: ContactFormData;
	user?: {
		id: string;
	};
	// Add other properties as needed
}
