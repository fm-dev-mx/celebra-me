// src/backend/services/emailService.ts

import { EmailProvider } from '@/core/interfaces/emailProvider.interface';
import { EmailData } from '@/core/interfaces/emailData.interface';
import { validateInput } from '@/core/utilities/validateInput';
import { validationRules } from '@/core/utilities/validationRules';
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
	 * Sends an email after validating the provided data.
	 * @param data - The email data to send.
	 * @throws Will throw an error if validation fails or email sending fails.
	 */
	async sendEmail(data: EmailData): Promise<void> {
		// Validate the email data
		const validationErrors = validateInput(data, validationRules);
		if (Object.keys(validationErrors).length > 0) {
			(await logger).warn('Validation errors occurred while sending email', validationErrors);
			throw new Error('Validation errors occurred.');
		}

		try {
			await this.emailProvider.sendEmail(data);
		} catch (error: unknown) {
			let errorMessage = 'Unknown error';
			if (error instanceof Error) {
				errorMessage = error.message;
				(await logger).error('Failed to send email', {
					error: errorMessage,
					stack: error.stack,
				});
			} else {
				(await logger).error('Failed to send email', { error });
			}
			throw new Error('Failed to send email. Please try again later.');
		}
	}
}
