// src/core/interfaces/contactFormAPIContext.interface.ts

import { APIContext } from 'astro';
import { ContactFormData } from './contactFormData.interface';

export interface ContactFormAPIContext extends APIContext {
	validatedData?: ContactFormData;
	clientIp?: string | null;
	// authToken?: string; // Optionally include authentication token if needed in future
}
