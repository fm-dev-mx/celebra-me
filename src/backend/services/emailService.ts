// src/backend/services/emailService.ts
import { EmailProvider } from '@/core/interfaces/emailProvider.interface';
import { EmailData } from '@/core/interfaces/emailData.interface';
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';
import { EmailServiceError } from '@/core/errors/emailServiceError';
// IMPORTANT: Do NOT import logger here to prevent circular dependencies.

export class EmailService {
	constructor(
		private emailProvider: EmailProvider,
		private maxRetries = 3,
		private initialDelayMs = 1000
	) { }

	async sendEmail(data: EmailData): Promise<void> {
		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				await this.emailProvider.sendEmail(data);
				return; // If successful, just return.
			} catch (error) {
				if (attempt === this.maxRetries) {
					throw new EmailServiceError(
						`Failed to send email after ${this.maxRetries} attempts.`,
						'EmailService'
					);
				}
				const delayMs = getExponentialBackoffDelay(attempt, this.initialDelayMs);
				await delay(delayMs);
			}
		}
	}
}
