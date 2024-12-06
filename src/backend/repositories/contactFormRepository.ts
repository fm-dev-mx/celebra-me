// src/backend/repositories/contactFormRepository.ts

import { SupabaseClientFactory } from '@/infrastructure/supabaseClient';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import logger from '@/backend/utilities/logger';

const MODULE_NAME = 'ContactFormRepository';

/**
 * Repository class for handling contact submission data storage.
 * Logs errors silently if data cannot be saved to the database.
 */
export class ContactFormRepository {
	/**
	 * Saves a contact submission to the database.
	 * Logs errors but does not throw them to ensure smooth user experience.
	 * @param submission - The contact submission data.
	 */
	async saveSubmission(submission: ContactFormData): Promise<void> {
		try {
			const supabase = await SupabaseClientFactory.getClient();
			const { error: insertError } = await supabase
				.from('contact_submissions')
				.insert([submission]);

			if (insertError) {
				logger.error({
					message: 'Failed to save contact form submission to the database.',
					meta: { error: insertError.message, submission },
					module: MODULE_NAME,
				});
			} else {
				logger.info({
					message: 'Contact form submission saved successfully.',
					meta: {
						event: 'ContactFormSave',
						user: { name: submission.name, email: submission.email, mobile: submission.mobile },
					},
					module: MODULE_NAME,
				});
			}
		} catch (error) {
			logger.error({
				message: 'Unexpected error while saving contact form submission.',
				meta: { error: error instanceof Error ? error.message : String(error), submission },
				module: MODULE_NAME,
			});
		}
	}
}
