// src/backend/jobs/logCronJob.ts

import config from '@/core/config';
import RedisClientFactory from '@/infrastructure/redisClient';
import logger from '@/backend/utilities/logger';
import { LogEntry } from '@/core/interfaces/logEntry.interface';
import { EmailService } from '@/backend/services/emailService';
import { SendGridProvider } from '@/backend/services/sendGridProvider';
import { EmailData } from '@/core/interfaces/emailData.interface';
import { escapeHtml } from '@/backend/utilities/dataSanitization';

const MODULE_NAME = 'LogCronJob';

// Extract email configuration
const { sendgridApiKey, recipient, sender } = config.alertEmailConfig;
// Initialize email instances once
const emailProvider = new SendGridProvider(sendgridApiKey);
const emailService = new EmailService(emailProvider);

/**
 * Sends the accumulated logs to administrators via email.
 * Intended to be run as a cron job.
 */
export async function sendLogs(): Promise<void> {
	try {
		// Obtain the Redis client instance
		const redis = await RedisClientFactory.getClient();

		// Retrieve all log entries from Redis
		const logEntriesRaw: string[] = await redis.lrange('app-logs', 0, -1);

		if (logEntriesRaw.length === 0) {
			logger.info({
				message: 'No logs available to send.',
				meta: { event: 'SendLogs' },
				module: MODULE_NAME,
			});
			return;
		}

		// Parse log entries into objects with proper typing
		const parsedLogs: LogEntry[] = parseLogEntries(logEntriesRaw);

		if (parsedLogs.length === 0) {
			logger.warn({
				message: 'All log entries failed to parse.',
				meta: { event: 'SendLogs' },
				module: MODULE_NAME,
			});
			return;
		}

		// Build email content with actionable insights for periodic logs
		const emailContent = buildEmailContent(parsedLogs);

		// Prepare the email message
		const emailData: EmailData = {
			to: recipient,
			from: sender,
			subject: `Log Report - ${new Date().toLocaleString()}`,
			html: emailContent,
		};

		// Send the email using EmailService (which handles retry logic)
		await emailService.sendEmail(emailData);

		logger.info({
			message: 'Logs successfully sent to the administrator.',
			meta: { event: 'SendLogs' },
			module: MODULE_NAME,
		});

		// Clear the logs from Redis after sending
		await redis.del('app-logs');

		logger.info({
			message: 'Logs cleared from Redis after sending.',
			meta: { event: 'SendLogs' },
			module: MODULE_NAME,
		});

	} catch (error: unknown) {
		logger.error({
			message: 'Error while sending logs.',
			meta: {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				event: 'SendLogs',
			},
			module: MODULE_NAME,
		});
	}
}

/**
 * Parses raw log entries from Redis into LogEntry objects.
 * Logs any parsing errors encountered.
 * @param logEntriesRaw - Array of raw log entry strings.
 * @returns Array of successfully parsed LogEntry objects.
 */
function parseLogEntries(logEntriesRaw: string[]): LogEntry[] {
	return logEntriesRaw
		.map((entry) => {
			try {
				return JSON.parse(entry) as LogEntry;
			} catch (error) {
				logger.error({
					message: 'Failed to parse log entry.',
					meta: {
						rawEntry: entry,
						event: 'ParseLogEntry',
						error: error instanceof Error ? error.message : String(error),
					},
					module: MODULE_NAME,
				});
				return null;
			}
		})
		.filter((log): log is LogEntry => log !== null);
}

/**
 * Builds the email content with actionable insights from the parsed logs.
 * @param parsedLogs - Array of parsed log entries.
 * @returns A string containing the HTML content for the email.
 */
function buildEmailContent(parsedLogs: LogEntry[]): string {
	// Group logs by severity level
	const logsByLevel = parsedLogs.reduce<Record<string, LogEntry[]>>((acc, log) => {
		acc[log.level] = acc[log.level] || [];
		acc[log.level].push(log);
		return acc;
	}, {});

	// Define the order of log levels for display
	const logLevels = ['critical', 'error', 'warn', 'info', 'debug'];

	// Build email content with actionable insights
	let emailContent = `<h1>Accumulated Logs Report</h1>`;
	for (const level of logLevels) {
		const logs = logsByLevel[level];
		if (logs && logs.length > 0) {
			emailContent += `<h2>${escapeHtml(level.toUpperCase())} Logs (${logs.length})</h2><ul>`;
			for (const log of logs) {
				try {
					const sanitizedMessage = escapeHtml(String(log.message));
					const sanitizedMeta = log.meta ? escapeHtml(JSON.stringify(log.meta, null, 2)) : '';
					const sanitizedModule = escapeHtml(log.module || 'N/A');
					emailContent += `<li>
              <strong>Timestamp:</strong> ${escapeHtml(log.timestamp || 'N/A')}<br>
              <strong>Message:</strong> ${sanitizedMessage}<br>
              <strong>Module:</strong> ${sanitizedModule}<br>
              <strong>Suggested Action:</strong> ${escapeHtml(getSuggestedAction(log))}<br>
              <strong>Details:</strong> <pre>${sanitizedMeta}</pre>
            </li>`;
				} catch (error: unknown) {
					logger.error({
						message: 'Error while building email content for a log entry.',
						meta: {
							error: error instanceof Error ? error.message : String(error),
							event: 'BuildEmailContent',
						},
						module: MODULE_NAME,
					});
					continue; // Skip this log entry and continue with others
				}
			}
			emailContent += `</ul>`;
		}
	}
	return emailContent;
}

/**
 * Provides a suggested action based on the log entry.
 * @param log - The log entry.
 * @returns A string with suggested action.
 */
function getSuggestedAction(log: LogEntry): string {
	switch (log.level) {
		case 'critical':
			return 'Immediate attention required. Please investigate the issue as soon as possible.';
		case 'error':
			return 'Check the error and resolve it promptly.';
		case 'warn':
			return 'Monitor the situation and consider taking action if it persists.';
		case 'info':
			return 'No action needed.';
		case 'debug':
			return 'For your information.';
		default:
			return 'No action suggested.';
	}
}

export default sendLogs;
