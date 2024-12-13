// src/backend/repositories/contactFormRepository.ts

import { SupabaseClientFactory } from '@/infrastructure/clients/supabaseClientFactory';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { getErrorMessage } from '@/core/utilities/errorUtils';

const MODULE_NAME = 'ContactFormRepository';

/**
 * Repository class for handling contact submission data storage.
 * Logs errors but does not throw them to avoid blocking operations.
 */
export class ContactFormRepository {
	async saveSubmission(submission: ContactFormData): Promise<void> {
		try {
			const supabaseClientFactory = new SupabaseClientFactory();
			const supabase = await supabaseClientFactory.getClient();

			const { error: insertError } = await supabase
				.from('contact_submissions')
				.insert([submission]);

			if (insertError) {
				logger.error({
					message: 'Failed to save contact form submission.',
					meta: { error: getErrorMessage(insertError) },
					module: MODULE_NAME,
				});
			} else {
				logger.info({
					message: 'Contact form submission saved successfully.',
					meta: {
						event: 'ContactFormSave',
						user: { name: submission.name, email: submission.email },
					},
					module: MODULE_NAME,
				});
			}
		} catch (error) {
			logger.error({
				message: 'Unexpected error while saving contact form submission.',
				meta: { error: getErrorMessage(error) },
				module: MODULE_NAME,
			});
		}
	}
}
