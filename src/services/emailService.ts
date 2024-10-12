// src/services/emailService.ts

import sgMail from '@sendgrid/mail';
import Config from '@/config/configSingleton';
import logger from '@/utilities/logger';

/**
 * Initialize SendGrid API client with the API key from the Singleton Config.
 */
sgMail.setApiKey(Config.EMAIL_CONFIG.sendgridApiKey);

/**
 * Sends an email using the specified form data via SendGrid.
 */
export async function sendEmail(data: {
	name: string;
	email: string;
	mobile: string;
	message: string;
}): Promise<void> {
	const { name, email, mobile, message } = data;

	// Mail options containing email metadata and message
	const msg = {
		to: Config.EMAIL_CONFIG.recipient, // Recipient email from the Singleton
		from: Config.EMAIL_CONFIG.sender, // Verified sender email from the Singleton
		replyTo: email, // The reply-to email is the one provided in the form
		subject: `Nuevo mensaje de ${name} vía Celebra-me`,
		text: `Nombre: ${name}\nEmail: ${email}\nTeléfono: ${mobile}\nMensaje: ${message}`,
	};

	try {
		// Send the email using SendGrid
		await sgMail.send(msg);
		logger.info('Email sent successfully via SendGrid');
	} catch (error: unknown) {
		if (error instanceof Error) {
			logger.error('Failed to send email via SendGrid:', error.message);
			throw new Error(`Error al enviar el correo electrónico: ${error.message}`);
		} else {
			logger.error('An unknown error occurred while sending email via SendGrid.');
			throw new Error('Error desconocido al enviar el correo electrónico.');
		}
	}
}
