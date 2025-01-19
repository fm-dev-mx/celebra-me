// src/backend/repositories/contactFormRepository.ts

import SupabaseClientFactory from '@/infrastructure/clients/supabaseClientFactory';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { logError, logInfo } from '@/backend/services/logger';
import { LogLevel, ErrorLoggerInput, InfoLoggerInput } from '@/core/interfaces/loggerInput.interface';
import { getErrorMessage } from '@/core/utilities/errorUtils';

const MODULE_NAME = 'ContactFormRepository';

/**
 * Repository class for handling contact submission data storage.
 * Logs errors but does not throw them to avoid blocking operations.
 */
export class ContactFormRepository {
	private supabaseFactory = new SupabaseClientFactory();

	/**
	 * Saves a contact form submission to the database.
	 * Logs success or error messages based on the result.
	 */
	async saveSubmission(submission: ContactFormData): Promise<void> {
		try {
			const supabase = await this.supabaseFactory.getClient();
			const { error: insertError } = await supabase
				.from('contact_submissions')
				.insert([submission]);

			if (insertError) {
				const errorLog: ErrorLoggerInput = {
					message: 'Failed to save contact form submission',
					module: MODULE_NAME,
					level: LogLevel.ERROR, // Set level to ERROR
					meta: {
						event: 'DB_SAVE_FAILURE',
						error: getErrorMessage(insertError),
						immediateNotification: true,
					},
				};
				logError(errorLog);
				return;
			}

			const infoLog: InfoLoggerInput = {
				message: 'Contact form submission saved successfully.',
				module: MODULE_NAME,
				level: LogLevel.INFO, // Set level to INFO
				meta: {
					event: 'DB_SAVE_SUCCESS',
					immediateNotification: true,
				},
			};
			logInfo(infoLog);
		} catch (error: unknown) {
			const errorLog: ErrorLoggerInput = {
				message: 'Unexpected error while saving contact form submission.',
				module: MODULE_NAME,
				level: LogLevel.ERROR, // Set level to ERROR
				meta: {
					event: 'DB_SAVE_UNEXPECTED_ERROR',
					error: getErrorMessage(error),
					immediateNotification: true,
				},
			};
			logError(errorLog);
		}
	}
}
