// src/backend/controllers/emailController.ts

import { EmailService } from '@/backend/services/emailService';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import { jsonResponse } from '@/core/config/constants';
import logger from '@/backend/utilities/logger';
import SupabaseClientManager from '@/infrastructure/supabaseClient';

/**
 * Controller responsible for handling email-related requests.
 * Adheres to the Single Responsibility Principle by focusing solely on email operations.
 */
export class EmailController {
	private emailService: EmailService;

	/**
	 * Constructs an EmailController with the given EmailService.
	 * @param emailService - The service responsible for sending emails.
	 */
	constructor(emailService: EmailService) {
		this.emailService = emailService;
	}

	/**
	 * Handles sending an email and storing submission details.
	 * @param context - The API context containing validated data and client IP.
	 * @returns A JSON response indicating success or failure.
	 */
	async sendEmail(context: ContactFormAPIContext): Promise<Response> {
		const { validatedData, clientIp } = context;

		if (!validatedData) {
			// This should not happen if validation middleware is working correctly
			logger.error('Validated data is missing in the context.');
			return jsonResponse({ error: 'Validation failed.' }, 400);
		}

		try {
			// Send the email using EmailService
			await this.emailService.sendEmail(validatedData);

			// Get the Supabase client instance directly
			const supabase = await SupabaseClientManager.getInstance();

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
				logger.error('Failed to store submission data.', { error: insertError.message });
				throw new Error('Failed to store submission data.');
			}

			// Return a success response
			return jsonResponse(
				{ message: 'Hemos recibido tu mensaje, te respondemos muy pronto.' },
				200
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Error in EmailController.sendEmail', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
			});
			// Rethrow the error to be handled by the errorHandlerMiddleware
			throw error;
		}
	}
}
