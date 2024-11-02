// src/services/emailService.ts

import sgMail, { type MailDataRequired } from '@sendgrid/mail';
import Config from '@/core/config';
import logger from '@/utilities/logger';

/**
 * Initialize SendGrid API client with the API key from the Config.
 */
sgMail.setApiKey(Config.EMAIL_CONFIG.sendgridApiKey);

/**
 * Interface for the email data.
 */
interface EmailData {
	name: string;
	email: string;
	mobile: string;
	message: string;
}

/**
 * Sends an email using the specified form data via SendGrid.
 */
export async function sendEmail(data: EmailData): Promise<void> {
	const { name, email, mobile = 'N/A', message } = data;

	// Validate email data before sending
	if (!name || !email || !message) {
		throw new Error('Name, email, and message are required to send an email.');
	}

	// Mail options containing email metadata and message
	const msg: MailDataRequired = {
		to: Config.EMAIL_CONFIG.recipient,
		from: Config.EMAIL_CONFIG.sender,
		replyTo: email,
		subject: `Nuevo mensaje de ${name} vía Celebra-me`,
		text: `Nombre: ${name}\nEmail: ${email}\nTeléfono: ${mobile}\nMensaje: ${message}`,
		html: `<p><strong>Nombre:</strong> ${name}</p>
               <p><strong>Email:</strong> ${email}</p>
          	   <p><strong>Teléfono:</strong> ${mobile}</p>
           	   <p><strong>Mensaje:</strong> ${message}</p>`,
	};

	try {
		// Send the email using SendGrid
		await sgMail.send(msg);
		logger.info('Email sent successfully via SendGrid');
	} catch (error: unknown) {
		let errorMessage = 'Unknown error';
		if (error instanceof Error) {
			errorMessage = error.message;
			logger.error('Failed to send email via SendGrid:', {
				error: errorMessage,
				stack: error.stack,
			});
		} else {
			logger.error('Failed to send email via SendGrid:', { error });
		}
		// Rethrow the original error to preserve stack trace
		throw error;
	}
}

