// src/services/emailService.ts
import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

// Retrieve environment variables
const {
	ZOHO_USER,
	ZOHO_PASS,
	RECIPIENT_EMAIL,
	SMTP_HOST,
	SMTP_PORT,
	SMTP_SECURE,
} = import.meta.env;

/**
 * Validate the required environment variables before proceeding.
 * Throws an error if any of the variables are missing.
 */
if (
	!ZOHO_USER ||
	!ZOHO_PASS ||
	!RECIPIENT_EMAIL ||
	!SMTP_HOST ||
	!SMTP_PORT ||
	typeof SMTP_SECURE === 'undefined'
) {
	throw new Error(
		'One or more environment variables are missing: ZOHO_USER, ZOHO_PASS, RECIPIENT_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_SECURE'
	);
}

/**
 * Create a reusable transporter object using the SMTP transport.
 * This transporter is used to send emails via the specified SMTP service.
 */
const transporter = nodemailer.createTransport({
	host: SMTP_HOST,
	port: parseInt(SMTP_PORT, 10),
	secure: SMTP_SECURE === 'true',
	auth: {
		user: ZOHO_USER,
		pass: ZOHO_PASS,
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
	const mailOptions: SendMailOptions = {
		from: ZOHO_USER, // Sender email (Zoho account)
		replyTo: email, // The reply-to email is the one provided in the form
		to: RECIPIENT_EMAIL, // Recipient email (typically your email)
		subject: `New message from ${name} via Celebra-me`, // Subject of the email
		text: `Name: ${name}\nEmail: ${email}\nPhone: ${mobile}\nMessage: ${message}`, // Email body content
	};

	try {
		// Send the email using Nodemailer transporter
		await transporter.sendMail(mailOptions);
		console.log('Email sent successfully');
	} catch (error: unknown) {
		// Log the error for debugging purposes without exposing sensitive details
		if (error instanceof Error) {
			console.error('Failed to send email:', error.message);
		} else {
			console.error('An unknown error occurred while sending email.');
		}
		// Throw a generic error to avoid exposing sensitive information
		throw new Error('Failed to send email.');
	}
}
