// src/backend/services/sendGridProvider.ts

import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { EmailProvider } from '@interfaces/email/emailProvider.interface';
import { EmailData } from '@interfaces/email/emailData.interface';
import { EmailServiceError } from '@/core/errors/emailServiceError';
import { getErrorMessage } from '@utilities/errorUtils';

const MODULE_NAME = 'SendGridProvider';

/**
 * The SendGridProvider class implements the EmailProvider interface.
 * It handles the logic of sending emails via the SendGrid API.
 *
 * Note: Logging or retry mechanisms should not be handled here, following the Single Responsibility Principle.
 *       The EmailService or upper layers are responsible for error handling and logging.
 */
export class SendGridProvider implements EmailProvider {
	/**
	 * Initializes the SendGrid API client.
	 * @param sendgridApiKey - The SendGrid API key.
	 * @throws EmailServiceError if the API key is not provided.
	 */
	constructor(sendgridApiKey: string) {
		if (!sendgridApiKey) {
			throw new EmailServiceError('SendGrid API key is not configured.', MODULE_NAME);
		}
		sgMail.setApiKey(sendgridApiKey);
	}

	/**
	 * Sends an email using the SendGrid API.
	 * @param emailData - The email data to send.
	 * @throws EmailServiceError if the email fails to send.
	 */
	async sendEmail(emailData: EmailData): Promise<void> {
		this.validateEmailData(emailData);

		const msg: MailDataRequired = {
			to: emailData.to,
			from: emailData.from,
			subject: emailData.subject,
			html: emailData.html || '',
			replyTo: Array.isArray(emailData.replyTo)
				? emailData.replyTo.join(', ')
				: emailData.replyTo,
		};

		try {
			await sgMail.send(msg);
		} catch (error: unknown) {
			const message = getErrorMessage(error);
			// Logging is handled by upper layers (EmailService),
			// so we just wrap and rethrow the error here.
			throw new EmailServiceError(
				`Failed to send email via SendGrid. Error: ${message}`,
				MODULE_NAME,
				error,
			);
		}
	}

	/**
	 * Validates the EmailData object to ensure all required fields are present.
	 * @param emailData - The email data to validate.
	 * @throws EmailServiceError if validation fails.
	 */
	private validateEmailData(emailData: EmailData): void {
		const { to, from, subject } = emailData;
		if (!to || !from || !subject) {
			throw new EmailServiceError(
				'Email data is missing required fields (to, from, subject).',
				MODULE_NAME,
			);
		}
		// Additional validations could be added here if needed
	}
}
