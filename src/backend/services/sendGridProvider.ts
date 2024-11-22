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
	private readonly maxRetries: number;
	private readonly initialDelayMs: number;

	/**
	 * Initializes the SendGrid API client.
	 * @param maxRetries - Maximum number of retry attempts.
	 * @param initialDelayMs - Initial delay in milliseconds for retries.
	 */
	constructor(maxRetries = 3, initialDelayMs = 1000) {
		const { sendgridApiKey } = Config.emailConfig;
		if (!sendgridApiKey) {
			throw new Error('SendGrid API key is not configured.');
		}
		sgMail.setApiKey(sendgridApiKey);
		this.maxRetries = maxRetries;
		this.initialDelayMs = initialDelayMs;
	}

	/**
	 * Sends an email using SendGrid with retry logic.
	 * @param emailData - The email data to send.
	 * @throws Will throw an error if the email fails to send after retries.
	 */
	async sendEmail(emailData: EmailData): Promise<void> {
		const msg: MailDataRequired = {
			to: emailData.to,
			from: emailData.from,
			subject: emailData.subject,
			html: emailData.html || '',
			replyTo: Array.isArray(emailData.replyTo) ? emailData.replyTo.join(', ') : emailData.replyTo,
		};

		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				await sgMail.send(msg);
				logger.info('Email sent successfully via SendGrid', {
					to: emailData.to,
					subject: emailData.subject,
					event: 'EmailSent',
				});
				return; // Exit if email sent successfully
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.error(`Failed to send email via SendGrid (Attempt ${attempt}/${this.maxRetries})`, {
					error: errorMessage,
					stack: error instanceof Error ? error.stack : undefined,
					to: emailData.to,
					subject: emailData.subject,
					event: 'EmailSendError',
				});

				if (attempt === this.maxRetries) {
					throw new Error('Failed to send email after multiple attempts. Please try again later.');
				}

				// Exponential backoff with jitter
				const delay = this.getExponentialBackoffDelay(attempt);
				await this.delay(delay);
			}
		}
	}

	/**
	 * Calculates exponential backoff delay with jitter.
	 * @param attempt - Current retry attempt.
	 * @returns Delay in milliseconds.
	 */
	private getExponentialBackoffDelay(attempt: number): number {
		const backoff = this.initialDelayMs * 2 ** (attempt - 1);
		const jitter = Math.random() * backoff * 0.1; // 10% jitter
		return backoff + jitter;
	}

	/**
	 * Delays execution for a specified duration.
	 * @param ms - Milliseconds to delay.
	 * @returns Promise that resolves after the delay.
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
