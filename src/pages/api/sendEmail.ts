// src/pages/api/sendEmail.ts

import type { APIRoute } from 'astro';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import { EmailService } from '@/backend/services/emailService';
import { SendGridProvider } from '@/backend/services/sendGridProvider';
import SupabaseClientManager from '@/infrastructure/supabaseClient';
import { loggerMiddleware } from '@/backend/middlewares/loggerMiddleware';
import { rateLimiterMiddleware } from '@/backend/middlewares/rateLimiterMiddleware';
import { validationMiddleware } from '@/backend/middlewares/validationMiddleware';
import { errorHandlerMiddleware } from '@/backend/middlewares/errorHandlerMiddleware';
import { validationRules } from '@/core/utilities/validationRules';
import { composeMiddlewares } from '@/backend/utilities/composeMiddlewares';
import { jsonResponse } from '@/core/config/constants';

// Initialize the EmailService and SendGridProvider once
const emailProvider = new SendGridProvider();
const emailService = new EmailService(emailProvider);
const supabase = await SupabaseClientManager.getInstance();

// API endpoint to send an email
export const POST: APIRoute = composeMiddlewares(async (context: ContactFormAPIContext) => {
	const { validatedData, clientIp } = context;

	if (!validatedData) {
		return jsonResponse({ error: 'Validation failed.' }, 400);
	}

	// Send the email using EmailService
	await emailService.sendEmail(validatedData);

	// Store the submission details in Supabase
	const { error: insertError } = await supabase
		.from('contact_submissions')
		.insert([
			{
				...validatedData,
				ip_address: clientIp || 'Unknown',
				created_at: new Date().toISOString(),
			},
		]);

	if (insertError) {
		throw new Error('Failed to store submission data.');
	}

	// Return a success response
	return jsonResponse(
		{ message: 'We have received your message and will respond shortly.' },
		200
	);
}, [
	errorHandlerMiddleware,
	loggerMiddleware,
	rateLimiterMiddleware({
		limit: 5,
		duration: '15 m',
		prefix: 'emailRateLimiter',
	}),
	validationMiddleware(validationRules),
]);

export const prerender = false;
