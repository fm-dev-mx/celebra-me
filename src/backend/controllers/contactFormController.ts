// src/backend/controllers/contactFormController.ts

import { EmailService } from '@/backend/services/emailService';
import { ContactFormRepository } from '@/backend/repositories/contactFormRepository';
import { EmailData } from '@/core/interfaces/emailData.interface';
import config from '@/core/config';
import logger from '@/backend/utilities/logger';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { escapeHtml } from '@/backend/utilities/dataSanitization';

const MODULE_NAME = 'ContactFormController';

/**
 * Controller for handling contact form submissions.
 * Prioritizes email delivery and logs any database or Redis errors silently.
 */
export class ContactFormController {
	constructor(
		private readonly emailService: EmailService,
		private readonly contactFormRepository: ContactFormRepository
	) { }

	/**
	 * Processes a contact form submission.
	 * @param data - The validated contact form data.
	 */
	async processContactSubmission(data: ContactFormData): Promise<void> {
		try {
			// Save the submission to the repository asynchronously without blocking email sending
			this.contactFormRepository.saveSubmission(data).catch((error) =>
				logger.error({
					message: 'Failed to save contact form submission to the repository.',
					meta: { error: error instanceof Error ? error.message : String(error) },
					module: MODULE_NAME,
				})
			);

			// Prepare email data and send the email
			const emailData = this.prepareEmailData(data);
			await this.emailService.sendEmail(emailData);

			// Log success after email delivery
			this.logSuccess(data);
		} catch (error) {
			logger.error({
				message: 'Failed to process contact form submission.',
				meta: { error: error instanceof Error ? error.message : String(error) },
				module: MODULE_NAME,
			});
			throw new Error('Hubo un error al procesar el formulario de contacto. Inténtalo de nuevo.');
		}
	}

	/**
	 * Prepares the email data from the contact form submission.
	 * @param data - The validated contact form data.
	 * @returns The email data ready to be sent.
	 */
	private prepareEmailData(data: ContactFormData): EmailData {
		const { name, email, mobile, message } = data;
		const { recipient, sender } = config.contactFormEmailConfig; // Unified email configuration

		return {
			to: recipient,
			from: sender,
			replyTo: email,
			subject: `Nuevo mensaje de ${name} a través del formulario de contacto`,
			html: this.buildEmailHtml({ name, email, mobile, message }),
		};
	}

	/**
	 * Builds the HTML content for the email.
	 * @param data - The validated contact form data.
	 * @returns The HTML string for the email content.
	 */
	private buildEmailHtml(data: ContactFormData): string {
		const { name, email, mobile = 'N/A', message } = data;
		return `
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(mobile)}</p>
      <p><strong>Message:</strong> ${escapeHtml(message)}</p>
    `;
	}

	/**
	 * Logs a successful contact form submission.
	 * @param data - The validated contact form data.
	 */
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
