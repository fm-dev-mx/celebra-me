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

/**
 * Initializes the EmailService with a SendGridProvider.
 * This setup allows sending emails through SendGrid.
 */
const emailProvider = new SendGridProvider();
const emailService = new EmailService(emailProvider);

/**
 * Handles POST requests to the /api/sendEmail endpoint.
 * This endpoint processes contact form submissions by validating input,
 * sending an email, and storing the submission details in Supabase.
 *
 * The request is processed through a composed middleware stack that includes:
 * - Error handling
 * - Logging
 * - Rate limiting
 * - Validation
 *
 * @type {APIRoute}
 */
export const POST: APIRoute = composeMiddlewares(
	/**
	 * Main handler function for processing the email sending logic.
	 *
	 * @param {ContactFormAPIContext} context - The API context containing validated data and client IP.
	 * @returns {Promise<Response>} - The HTTP response after processing the request.
	 */
	async (context: ContactFormAPIContext) => {
		const { validatedData, clientIp } = context;

		// Check if validation passed
		if (!validatedData) {
			return jsonResponse({ error: 'Validation failed.' }, 400);
		}

		// Send the email using the EmailService
		await emailService.sendEmail(validatedData);

		// Initialize Supabase client to store submission details
		const supabase = await SupabaseClientManager.getInstance();
		const { error: insertError } = await supabase.from('contact_submissions').insert([
			{
				...validatedData,
				ip_address: clientIp || 'Unknown',
				created_at: new Date().toISOString(),
			},
		]);

		// Handle potential errors during data storage
		if (insertError) {
			throw new Error('Failed to store submission data.');
		}

		// Respond with a success message
		return jsonResponse(
			{ message: 'We have received your message and will respond shortly.' },
			200
		);
	},
	[
		/**
		 * Middleware to handle any unhandled errors in the request processing.
		 * It ensures that errors are logged and a standardized error response is sent.
		 */
		errorHandlerMiddleware,

		/**
		 * Middleware to log incoming requests with details such as method, URL, and client IP.
		 * This aids in monitoring and debugging API usage.
		 */
		loggerMiddleware,

		/**
		 * Middleware to enforce rate limiting on incoming requests.
		 * Limits the number of requests a client can make within a specified time window.
		 *
		 * Configuration:
		 * - limit: Maximum of 5 requests
		 * - duration: 15 minutes
		 * - prefix: Identifier for the rate limiter
		 */
		rateLimiterMiddleware({
			limit: 5,
			duration: '15 m',
			prefix: 'emailRateLimiter',
		}),

		/**
		 * Middleware to validate incoming request data against predefined rules.
		 * Ensures that the data conforms to expected formats and constraints.
		 */
		validationMiddleware(validationRules),
	]
);

/**
 * Disables prerendering for this API route.
 * Ensures that the route is only accessible via API requests and not during static site generation.
 */
export const prerender = false;
