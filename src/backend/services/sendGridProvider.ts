// src/backend/services/sendGridProvider.ts

import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { EmailProvider } from '@/core/interfaces/emailProvider.interface';
import { EmailData } from '@/core/interfaces/emailData.interface';

/**
 * SendGridProvider class that implements the EmailProvider interface.
 * Handles all SendGrid-specific logic for sending emails.
 */
export class SendGridProvider implements EmailProvider {
	/**
	 * Initializes the SendGrid API client.
	 */
	constructor(sendgridApiKey: string) {
		if (!sendgridApiKey) {
			throw new Error('SendGrid API key is not configured.');
		}
		sgMail.setApiKey(sendgridApiKey);
		// Removed logger dependency to avoid circular reference
	}

	/**
	 * Sends an email using SendGrid.
	 * @param emailData - The email data to send.
	 * @throws Will throw an error if the email fails to send.
	 */
	async sendEmail(emailData: EmailData): Promise<void> {
		const msg: MailDataRequired = {
			to: emailData.to,
			from: emailData.from,
			subject: emailData.subject,
			html: emailData.html || '',
			replyTo: Array.isArray(emailData.replyTo)
				? emailData.replyTo.join(', ')
				: emailData.replyTo,
		};

		await sgMail.send(msg);
		// Logging and retries are handled by EmailService, not here.
	}
}
