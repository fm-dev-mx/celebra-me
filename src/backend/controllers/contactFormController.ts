// src/backend/controllers/contactFormController.ts

import { EmailService } from '@/backend/services/emailService';
import { ContactFormRepository } from '@/backend/repositories/contactFormRepository';
import { logInfo, logError } from '@/backend/services/logger';
import { ContactFormFields } from '@/core/interfaces/forms/contactFormFields.interface';
import { getErrorMessage } from '@utilities/errorUtils';
import { EmailServiceError } from '@/core/errors/emailServiceError';
import { ControllerError } from '@/core/errors/controllerError';
import { prepareEmailData } from '@/backend/utilities/emailContentBuilder';
import { sanitizeObject } from '@/backend/utilities/dataSanitization';

const MODULE_NAME = 'ContactFormController';

export class ContactFormController {
	constructor(
		private readonly emailService: EmailService,
		private readonly contactFormRepository: ContactFormRepository,
	) {}

	/**
	 * Processes a contact form submission.
	 */
	async processContactSubmission(data: ContactFormFields): Promise<void> {
		try {
			await Promise.all([this.saveSubmission(data), this.sendNotificationEmail(data)]);
			this.logSuccess(data);
		} catch (error) {
			throw new ControllerError(
				'There was an error processing the contact form. Please try again later.',
				MODULE_NAME,
				error,
			);
		}
	}

	/**
	 * Saves the contact form submission to the database.
	 */
	private async saveSubmission(data: ContactFormFields): Promise<void> {
		try {
			await this.contactFormRepository.saveSubmission(data);
		} catch (error) {
			// Instead of logging again here, just rethrow a contextual error
			// so that the global middleware logs it once.
			throw new ControllerError('Error saving contact form submission', MODULE_NAME, error);
		}
	}

	/**
	 * Sends the notification email for the contact form submission.
	 */
	private async sendNotificationEmail(data: ContactFormFields): Promise<void> {
		try {
			const emailData = prepareEmailData(data);
			await this.emailService.sendEmail(emailData);
		} catch (error) {
			logError({
				message: 'Error sending notification email',
				module: MODULE_NAME,
				meta: {
					event: 'email_send_failure',
					error: getErrorMessage(error),
					rawData: sanitizeObject({
						userName: data.name,
						userEmail: data.email,
					}),
				},
			});
			throw new EmailServiceError('Error sending email notification', MODULE_NAME, error);
		}
	}

	/**
	 * Logs the successful processing of the contact form submission.
	 */
	private logSuccess(data: ContactFormFields): void {
		logInfo({
			message: 'Contact form submission processed successfully.',
			module: MODULE_NAME,
			meta: {
				event: 'contact_form_success',
				rawData: sanitizeObject({
					userName: data.name,
					userEmail: data.email,
				}),
			},
		});
	}
}
