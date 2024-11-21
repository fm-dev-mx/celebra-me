// src/backend/repositories/contactFormRepository.ts

import SupabaseClientManager from '@/infrastructure/supabaseClient';
import logger from '@/backend/utilities/logger';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { ApiErrorResponse } from '@/core/interfaces/apiResponse.interface';

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
			logger.error('Failed to store submission data.', { error: insertError.message });
			throw {
				success: false,
				statusCode: 500,
				message: 'Failed to store submission data.',
			} as ApiErrorResponse;
		}
	}
}
