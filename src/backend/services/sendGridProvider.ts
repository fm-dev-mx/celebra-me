// src/backend/services/sendGridProvider.ts

import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { EmailProvider } from '@/core/interfaces/emailProvider.interface';
import { EmailData } from '@/core/interfaces/emailData.interface';
import Config from '@/core/config';
import logger from '@/backend/utilities/logger';

/**
 * SendGridProvider class that implements the EmailProvider interface.
 * Handles all SendGrid-specific logic for sending emails.
 *
 * **Setup Instructions:**
 * - Ensure `SENDGRID_API_KEY`, `RECIPIENT_EMAIL`, and `SENDER_EMAIL` are set in your environment variables.
 */
export class SendGridProvider implements EmailProvider {
	/**
	 * Initializes the SendGrid API client.
	 */
	constructor() {
		const { sendgridApiKey } = Config.emailConfig;
		if (!sendgridApiKey) {
			throw new Error('SendGrid API key is not configured.');
		}
		sgMail.setApiKey(sendgridApiKey);
	}

	/**
	 * Sends an email using SendGrid.
	 * @param data - The email data to send.
	 * @throws Will throw an error if the email fails to send.
	 */
	async sendEmail(emailData: EmailData): Promise<void> {

		// Prepare the email message
		const msg: MailDataRequired = {
			to: emailData.to,
			from: emailData.from,
			subject: emailData.subject,
			html: emailData.html || '',
			replyTo: Array.isArray(emailData.replyTo) ? emailData.replyTo.join(', ') : emailData.replyTo,
		};


		try {
			await sgMail.send(msg);
			logger.info('Email sent successfully via SendGrid');
		} catch (error: unknown) {
			let errorMessage = 'Unknown error';
			if (error instanceof Error) {
				errorMessage = error.message;
				logger.error('Failed to send email via SendGrid', {
					error: errorMessage,
					stack: error.stack,
				});
			} else {
				errorMessage = String(error);
				logger.error('Failed to send email via SendGrid', { error: errorMessage });
			}
			// Map SendGrid-specific errors to application-level errors
			throw new Error('Failed to send email. Please try again later.88');
		}
	}
}
