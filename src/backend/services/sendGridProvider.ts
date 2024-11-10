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
		const { sendgridApiKey, recipient, sender } = Config.emailConfig;
		if (!sendgridApiKey) {
			throw new Error('SendGrid API key is not configured.');
		}
		if (!recipient) {
			throw new Error('Recipient email is not configured.');
		}
		if (!sender) {
			throw new Error('Sender email is not configured.');
		}
		sgMail.setApiKey(sendgridApiKey);
	}

	/**
	 * Sends an email using SendGrid.
	 * @param data - The email data to send.
	 * @throws Will throw an error if the email fails to send.
	 */
	async sendEmail(data: EmailData): Promise<void> {
		const { name, email, mobile = 'N/A', message } = data;

		// Prepare the email message
		const msg: MailDataRequired = {
			to: Config.emailConfig.recipient,
			from: Config.emailConfig.sender,
			replyTo: email,
			subject: `Nuevo mensaje de ${name} vía Celebra-me`,
			text: `Nombre: ${name}\nEmail: ${email}\nTeléfono: ${mobile}\nMensaje: ${message}`,
			html: `<p><strong>Nombre:</strong> ${name}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Teléfono:</strong> ${mobile}</p>
                   <p><strong>Mensaje:</strong> ${message}</p>`,
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
				logger.error('Failed to send email via SendGrid', { error });
			}
			// Map SendGrid-specific errors to application-level errors
			throw new Error('Failed to send email. Please try again later.');
		}
	}
}
