// src/backend/services/emailService.ts

import { EmailProvider } from '@/core/interfaces/emailProvider.interface';
import { EmailData } from '@/core/interfaces/emailData.interface';
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';
import { EmailServiceError } from '@/core/errors/emailServiceError';
// IMPORTANT: Do NOT import logger here to prevent circular dependencies.

const MODULE_NAME = 'EmailService';

export interface EmailServiceOptions {
	maxRetries?: number;
	initialDelayMs?: number;
	backoffStrategy?: (attempt: number, initialDelayMs: number) => number;
}

export class EmailService {
	private defaultOptions: EmailServiceOptions = {
		maxRetries: 3,
		initialDelayMs: 1000,
		backoffStrategy: getExponentialBackoffDelay,
	};

	constructor(
		private emailProvider: EmailProvider,
		private options: EmailServiceOptions = {}
	) { }

	/**
	 * Sends an email with retry and backoff logic.
	 * @param data Email data to be sent.
	 * @param options Optional overrides for retry and delay settings.
	 * @throws EmailServiceError after exhausting retries.
	 */
	async sendEmail(data: EmailData, options: EmailServiceOptions = {}): Promise<void> {
		const { maxRetries, initialDelayMs, backoffStrategy } = {
			...this.defaultOptions,
			...this.options,
			...options,
		};

		for (let attempt = 1; attempt <= maxRetries!; attempt++) {
			try {
				await this.emailProvider.sendEmail(data);
				return; // Email sent successfully
			} catch (error) {
				if (attempt === maxRetries) {
					// Final attempt failed, throw custom error with context.
					throw new EmailServiceError(
						`Failed to send email after ${maxRetries} attempts.`,
						MODULE_NAME,
						error
					);
				}

				// Calculate delay using the provided backoff strategy.
				const delayMs = backoffStrategy!(attempt, initialDelayMs!);
				await delay(delayMs);
			}
		}
	}
}
