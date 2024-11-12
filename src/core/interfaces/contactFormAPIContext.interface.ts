// src/core/interfaces/contactFormAPIContext.interface.ts

import { APIContext } from 'astro';
import { type EmailData } from './emailData.interface';

export interface ContactFormAPIContext extends APIContext {
	validatedData?: EmailData;
	clientIp?: string;
}
