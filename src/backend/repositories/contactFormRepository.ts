// Modified code with comments explaining the changes.

// src/backend/repositories/contactFormRepository.ts

import SupabaseClientManager from '@/infrastructure/supabaseClient';
import logger from '@/backend/utilities/logger';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { createErrorResponse } from '@/core/utilities/apiResponseUtils';

/**
 * Repository class for handling contact submission data storage.
 */
export class ContactFormRepository {
	/**
	 * Saves a contact submission to the database.
	 * @param submission - The contact submission data.
	 * @throws Will throw an error if data insertion fails.
	 */
	async saveSubmission(submission: ContactFormData): Promise<void> {
		const supabase = await SupabaseClientManager.getInstance();

		const { error: insertError } = await supabase.from('contact_submissions').insert([submission]);

		if (insertError) {
			// Log the error with additional context, avoiding sensitive information
			logger.error('Failed to store submission data.', {
				error: insertError.message,
				user: {
					name: submission.name,
					email: submission.email,
					// Do not log message content or phone number
				},
				event: 'ContactFormSave',
			});
			throw createErrorResponse(500, 'Failed to store submission data.');
		} else {
			// Log successful storage at INFO level
			logger.info('Contact form submission saved successfully.', {
				user: {
					name: submission.name,
					email: submission.email,
					// Do not log sensitive data
				},
				event: 'ContactFormSave',
			});
		}
	}
}
