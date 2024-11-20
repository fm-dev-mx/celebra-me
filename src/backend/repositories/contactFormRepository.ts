// src/backend/repositories/contactSubmissionRepository.ts

import SupabaseClientManager from '@/infrastructure/supabaseClient';
import logger from '@/backend/utilities/logger';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';

/**
 * Repository class for handling contact submission data storage.
 */
export class ContactFormRepository {
	/**
	 * Saves a contact submission to the database.
	 * @param submission - The contact submission data.
	 * @throws Will throw an error if data insertion fails.
	 */
	async saveSubmission(
		submission: ContactFormData
	): Promise<void> {
		const supabase = await SupabaseClientManager.getInstance();

		const { error: insertError } = await supabase
			.from('contact_submissions')
			.insert([submission]);

		if (insertError) {
			logger.error('Failed to store submission data.', { error: insertError.message });
			throw new Error('Failed to store submission data.');
		}
	}
}
