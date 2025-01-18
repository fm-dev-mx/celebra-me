// src/backend/services/notificationManager.ts

import { EmailNotificationManager } from '@/backend/utilities/emailNotificationManager';
import config from '@/core/config';
import { SendGridProvider } from '@/backend/services/sendGridProvider';
import { EmailService } from '@/backend/services/emailService';

let notificationManager: EmailNotificationManager | null = null;

/**
 * Factory function to return a singleton instance of EmailNotificationManager.
 * Ensures that email notifications are managed centrally.
 */
export function getNotificationManager(): EmailNotificationManager {
	if (!notificationManager) {
		const { sendgridApiKey } = config.alertEmailConfig;
		const emailProvider = new SendGridProvider(sendgridApiKey);
		const emailService = new EmailService(emailProvider);

		notificationManager = new EmailNotificationManager(emailService, {
			scheduledFrequency: config.logging.scheduledFrequency,
			maxEmailsPerMinute: config.logging.maxEmailsPerMinute,
			deduplicateCritical: config.logging.deduplicateCritical,
		});
	}
	return notificationManager;
}
