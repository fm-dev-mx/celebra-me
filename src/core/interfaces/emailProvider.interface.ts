// src/core/interfaces/emailProvider.interface.ts

import { EmailData } from './emailData.interface';

/**
 * Interface for sending emails.
 *
 * Implementations should handle provider-specific configurations and throw meaningful errors if email sending fails.
 */
export interface EmailProvider {
	/**
	 * Sends an email with the given data.
	 * @param data - The email data to send.
	 * @throws Will throw an error if the email fails to send.
	 */
	sendEmail(data: EmailData): Promise<void>;
}
