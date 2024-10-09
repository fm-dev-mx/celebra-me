// src/services/email-service.ts
import nodemailer from 'nodemailer';

// Retrieve environment variables
const { ZOHO_USER, ZOHO_PASS, RECIPIENT_EMAIL } = import.meta.env;

/**
 * Validate the required environment variables before proceeding.
 * Throws an error if any of the variables are missing.
 */
if (!ZOHO_USER || !ZOHO_PASS || !RECIPIENT_EMAIL) {
	throw new Error('One or more environment variables (ZOHO_USER, ZOHO_PASS, RECIPIENT_EMAIL) are missing');
}

/**
 * Create a reusable transporter object using the default SMTP transport.
 * This transporter is used to send emails via Zoho's SMTP service.
 */
const transporter = nodemailer.createTransport({
	host: 'smtp.zoho.com', // Zoho SMTP server
	port: 465, // SSL port
	secure: true, // Use SSL for secure connection
	auth: {
		user: ZOHO_USER, // Zoho email from environment variables
		pass: ZOHO_PASS, // Zoho password from environment variables
	},
});

/**
 * Sends an email using the specified form data.
 * @param data - Object containing name, email, mobile, and message.
 * @returns {Promise<void>} - Promise indicating success or failure of the email sending.
 */
export async function sendEmail(data: {
	name: string;
	email: string;
	mobile: string;
	message: string;
}): Promise<void> {
	const { name, email, mobile, message } = data;

	// Mail options containing email metadata and message
	const mailOptions = {
		from: ZOHO_USER, // Sender email (Zoho account)
		replyTo: email, // The reply-to email is the one provided in the form
		to: RECIPIENT_EMAIL, // Recipient email (typically your email)
		subject: `New message from ${name} via Celebra-me`, // Subject of the email
		text: `Name: ${name}\nEmail: ${email}\nMobile: ${mobile}\nMessage: ${message}`, // Email body content
	};

	try {
		// Send the email using Nodemailer transporter
		await transporter.sendMail(mailOptions);
		console.log('Email sent successfully');
	} catch (error: any) {
		// Log the error for debugging purposes
		console.error('Failed to send email:', error);
		throw new Error('Error al enviar el correo electrónico');
	}
}
