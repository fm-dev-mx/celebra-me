// src/core/interfaces/contactFormAPIContext.interface.ts

import { ContactFormData } from '@/core/interfaces/contactFormData.interface';

/**
 * Interface representing the context for the Contact Form API.
 */
export interface ContactFormAPIContext {
	request: Request;
	clientIp?: string;
	validatedData?: ContactFormData;
	// Add other properties as needed
}
