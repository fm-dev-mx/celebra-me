// src/backend/utilities/emailNotificationManager.ts

import { LogEntry } from '@interfaces/logging/logEntry.interface';
import { EmailService } from '@/backend/services/emailService';
import { buildLogEmailContent } from './emailContentBuilder';
import config from '@/core/config';
import { logError, logInfo, logWarn } from '@/backend/services/logger';
import { getErrorMessage } from '@utilities/errorUtils';
import { EmailData } from '@interfaces/email/emailData.interface';

const MODULE_NAME = 'EmailNotificationManager';

/**
 * Configuration options for the EmailNotificationManager.
 */
export interface NotificationManagerOptions {
	/**
	 * Frequency for sending scheduled summary emails.
	 */
	scheduledFrequency: 'daily' | 'weekly' | 'monthly';
	/**
	 * Maximum number of emails that can be sent per minute to prevent spamming.
	 */
	maxEmailsPerMinute?: number;
	/**
	 * Whether to deduplicate critical notifications to avoid sending multiple emails for the same event.
	 */
	deduplicateCritical?: boolean;
}

/**
 * Manages email notifications for critical alerts (via meta.immediateNotification) and log summaries.
 */
export class EmailNotificationManager {
	private options: NotificationManagerOptions;
	private sentCriticalEvents = new Set<string>();
	private emailCount = 0;
	private rateLimitInterval: NodeJS.Timeout;

	constructor(
		private emailService: EmailService,
		options: Partial<NotificationManagerOptions>,
	) {
		// Set default options. "critical" is handled via meta.immediateNotification.
		this.options = {
			scheduledFrequency: options.scheduledFrequency || 'daily',
			maxEmailsPerMinute: options.maxEmailsPerMinute || 10,
			deduplicateCritical: options.deduplicateCritical !== false, // Default to true
		};

		// Set up rate limiter to reset email count every minute
		this.rateLimitInterval = setInterval(() => {
			this.emailCount = 0;
		}, 60000); // Reset email count every minute
	}

	/**
	 * Sends an immediate notification email for critical alerts or configured levels.
	 * Utilizes the meta.immediateNotification flag to determine if a notification should be sent.
	 *
	 * @param logEntry - The log entry triggering the immediate notification.
	 */
	async sendImmediateNotification(logEntry: LogEntry): Promise<void> {
		// Validate log entry structure
		if (!logEntry.timestamp || !logEntry.module || !logEntry.message) {
			logError({
				message: 'Invalid log entry provided for immediate notification.',
				module: MODULE_NAME,
				meta: {
					event: 'invalid_log_entry',
					error: 'Missing required log entry properties',
				},
			});
			return;
		}

		// Deduplicate critical notifications to avoid sending multiple emails for the same event
		const eventHash = `${logEntry.timestamp}-${logEntry.module}-${logEntry.message}`;
		if (this.options.deduplicateCritical && this.sentCriticalEvents.has(eventHash)) {
			logWarn({
				message: `Skipped duplicate critical notification. Hash: ${eventHash}`,
				module: MODULE_NAME,
				meta: {
					event: 'duplicate_critical_notification',
					immediateNotification: false,
				},
			});
			return;
		}

		// Register unique event if deduplication is enabled
		if (this.options.deduplicateCritical) {
			this.sentCriticalEvents.add(eventHash);
		}

		// Respect email rate limit
		if (this.emailCount >= this.options.maxEmailsPerMinute!) {
			this.logRateLimitWarning();
			return;
		}

		this.emailCount++;

		// Build email data
		const emailData = this.buildEmailData(logEntry, true);

		// Attempt to send email
		try {
			await this.emailService.sendEmail(emailData);
			logInfo({
				message: 'Critical alert email sent successfully.',
				module: MODULE_NAME,
				meta: {
					event: 'immediate_notification_sent',
					immediateNotification: false,
					emailData: {
						to: emailData.to,
						from: emailData.from,
						subject: emailData.subject,
					},
				},
			});
		} catch (error) {
			this.logEmailError(
				error,
				Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
				emailData.from,
				emailData.subject,
				'immediate_notification_error',
			);
		}
	}

	/**
	 * Sends a scheduled summary email aggregating provided logs.
	 *
	 * @param logEntries - Array of log entries to include in the summary.
	 */
	async sendScheduledSummary(logEntries: LogEntry[]): Promise<void> {
		if (logEntries.length === 0) return;

		const uniqueLogs = this.deduplicateLogs(logEntries);
		const emailData = this.buildEmailData(uniqueLogs, false);

		try {
			await this.emailService.sendEmail(emailData);
			logInfo({
				message: 'Scheduled log summary sent successfully.',
				module: MODULE_NAME,
				meta: {
					event: 'scheduled_summary_sent',
					immediateNotification: false,
					emailData: {
						to: emailData.to,
						from: emailData.from,
						subject: emailData.subject,
					},
				},
			});
		} catch (error) {
			this.logEmailError(
				error,
				Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
				emailData.from,
				emailData.subject,
				'scheduled_summary_error',
			);
		}
	}

	/**
	 * Deduplicates log entries based on a unique hash of timestamp, module, and message.
	 * This ensures that logs with identical content are not processed multiple times.
	 *
	 * @param logEntries - Array of log entries to deduplicate.
	 * @returns An array of unique log entries.
	 */
	private deduplicateLogs(logEntries: LogEntry[]): LogEntry[] {
		const uniqueLogsMap = new Map<string, LogEntry>();
		for (const log of logEntries) {
			const hash = `${log.timestamp}-${log.module}-${log.message}`;
			if (!uniqueLogsMap.has(hash)) {
				uniqueLogsMap.set(hash, log);
			}
		}
		return Array.from(uniqueLogsMap.values());
	}

	/**
	 * Builds the email data structure for critical alerts or log summaries.
	 * The email includes recipient, sender, subject, and HTML content.
	 *
	 * @param logData - A single log entry or an array of log entries.
	 * @param isImmediate - Indicates if the email is for an immediate notification.
	 * @returns An object containing email details ready to be sent.
	 */
	private buildEmailData(logData: LogEntry | LogEntry[], isImmediate: boolean): EmailData {
		const logsArray = Array.isArray(logData) ? logData : [logData];
		const htmlContent = buildLogEmailContent(logsArray, {
			immediate: isImmediate,
		});
		const subject = isImmediate
			? `Critical Alert: ${(logData as LogEntry).message}`
			: `Log Report - ${new Date().toISOString()}`;

		return {
			to: config.alertEmailConfig.recipient,
			from: config.alertEmailConfig.sender,
			replyTo: config.alertEmailConfig.sender, // Typically, reply-to is the sender or a designated address
			subject,
			html: htmlContent,
		};
	}

	/**
	 * Logs a warning when the email rate limit is reached.
	 */
	private logRateLimitWarning(): void {
		logWarn({
			message: 'Email rate limit reached.',
			module: MODULE_NAME,
			meta: {
				event: 'email_rate_limit',
				immediateNotification: true,
				rateLimit: {
					rateLimiterKey: 'emailRateLimiter',
					rateLimiterConfig: {
						limit: this.options.maxEmailsPerMinute!,
						duration: '1m',
						prefix: 'email',
					},
					rateLimiterStatus: {
						exceeded: true,
						currentCount: this.emailCount,
						remaining: 0,
					},
				},
			},
		});
	}

	/**
	 * Logs errors related to email sending.
	 *
	 * @param error - The error that occurred while sending the email.
	 * @param recipient - The email recipient.
	 * @param event - The specific event identifier for the error.
	 */
	private logEmailError(
		error: unknown,
		recipient: string,
		sender: string,
		subject: string,
		event: string,
	): void {
		logError({
			message: 'Failed to send email notification.3',
			module: MODULE_NAME,
			meta: {
				event,
				error: getErrorMessage(error),
				immediateNotification: false,
				emailData: {
					to: recipient,
					from: sender,
					subject: subject,
				},
			},
		});
	}

	/**
	 * Clears intervals to prevent memory leaks.
	 * Should be called when the manager is no longer needed.
	 */
	clearIntervals(): void {
		clearInterval(this.rateLimitInterval);
	}
}
