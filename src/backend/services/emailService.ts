// src/backend/services/emailService.ts

import { EmailProvider } from '@/core/interfaces/emailProvider.interface';
import { EmailData } from '@/core/interfaces/emailData.interface';
import logger from '@/backend/utilities/logger';

/**
 * EmailService class responsible for coordinating the email sending process.
 * It uses an injected EmailProvider to send emails.
 */
export class EmailService {
	private emailProvider: EmailProvider;

	/**
	 * Constructs an EmailService with the given EmailProvider.
	 * @param emailProvider - An instance of a class that implements EmailProvider.
	 */
	constructor(emailProvider: EmailProvider) {
		this.emailProvider = emailProvider;
	}

	/**
	 * Sends an email using the provided data.
	 * @param data - The email data to send.
	 * @throws Will throw an error if email sending fails.
	 */
	async sendEmail(data: EmailData): Promise<void> {
		try {
			await this.emailProvider.sendEmail(data);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Failed to send email', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw new Error(`Failed to send email: ${errorMessage}`);
		}
	}
}
