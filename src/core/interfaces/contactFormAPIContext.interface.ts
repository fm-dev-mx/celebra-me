// src/core/interfaces/contactFormAPIContext.interface.ts

import { APIContext } from 'astro';
import { type EmailData } from './emailData.interface';

export interface ContactFormAPIContext extends APIContext {
	validatedData?: Partial<EmailData>;
	clientIp?: string;
	// authToken?: string; // Optionally include authentication token if needed in future
}
