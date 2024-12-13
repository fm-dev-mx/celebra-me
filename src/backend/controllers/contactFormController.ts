// src/backend/controllers/contactFormController.ts

import { EmailService } from '@/backend/services/emailService';
import { ContactFormRepository } from '@/backend/repositories/contactFormRepository';
import { EmailData } from '@/core/interfaces/emailData.interface';
import config from '@/core/config';
import logger from '@/backend/utilities/logger';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { getErrorMessage } from '@/core/utilities/errorUtils';
import { EmailServiceError } from '@/core/errors/emailServiceError';
import { ControllerError } from '@/core/errors/controllerError';
import { prepareEmailData } from '@/backend/utilities/emailContentBuilder';

const MODULE_NAME = 'ContactFormController';

export class ContactFormController {
	constructor(
		private readonly emailService: EmailService,
		private readonly contactFormRepository: ContactFormRepository
	) { }

	/**
	 * Processes a contact form submission.
	 * Logs repository errors but continues to send the email,
	 * ensuring that database failures do not block email notifications.
	 */
	async processContactSubmission(data: ContactFormData): Promise<void> {
		try {
			// Attempt to save the submission to the database
			try {
				await this.contactFormRepository.saveSubmission(data);
			} catch (error) {
				logger.error({
					message: 'Database save failed; continuing with email notification.',
					meta: {
						error: getErrorMessage(error),
						event: 'ContactFormSubmission',
					},
					module: MODULE_NAME,
				});
				// Proceed with sending the email even if DB fails
			}

			const emailData = prepareEmailData(data);
			await this.emailService.sendEmail(emailData);

			this.logSuccess(data);

		} catch (error) {
			let userFriendlyMessage = 'There was an error processing the contact form. Please try again later.';
			if (error instanceof EmailServiceError) {
				userFriendlyMessage = 'We encountered an issue sending the notification email. Please try again later.';
			}

			logger.error({
				message: 'Failed to process contact form submission.',
				meta: {
					error: getErrorMessage(error),
					event: 'ContactFormSubmission',
				},
				module: MODULE_NAME,
			});

			throw new ControllerError(userFriendlyMessage, MODULE_NAME, error);
		}
	}

	private logSuccess(data: ContactFormData): void {
		logger.info({
			message: 'Contact form submission processed successfully.',
			meta: {
				event: 'ContactFormSubmission',
				user: {
					name: data.name,
					email: data.email,
				},
			},
			module: MODULE_NAME,
		});
	}
}
