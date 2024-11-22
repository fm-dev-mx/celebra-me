// src/backend/jobs/logCronJob.ts

import sgMail, { type MailDataRequired } from '@sendgrid/mail';
import config from '@/core/config';
import RedisClient from '@/infrastructure/redisClient';
import logger from '@/backend/utilities/logger';
import { LogEntry } from '@/core/interfaces/logEntry.interface';

import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Inicializar DOMPurify una vez utilizando JSDOM
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Sends the accumulated logs to administrators via email.
 * This function is intended to be run as a cron job.
 */
export async function sendLogs(): Promise<void> {
	sgMail.setApiKey(config.emailConfig.sendgridApiKey);

	try {
		// Obtain the Redis client instance
		const redis = await RedisClient.getInstance();

		// Retrieve all log entries from Redis
		const logEntriesRaw: string[] = await redis.lrange('app-logs', 0, -1);

		if (logEntriesRaw.length === 0) {
			logger.info('No logs available to send.');
			return;
		}

		// Parse log entries into objects with proper typing
		const parsedLogs: LogEntry[] = logEntriesRaw.map((entry) => JSON.parse(entry));

		// Build email content with actionable insights
		const emailContent = buildEmailContent(parsedLogs);

		// Prepare the email message with the logs in the body
		const msg: MailDataRequired = {
			to: config.emailConfig.recipient, // Administrator's email
			from: config.emailConfig.sender, // Verified sender email in SendGrid
			subject: `Log Report - ${new Date().toLocaleString()}`,
			html: emailContent,
		};

		// Implement retry mechanism for sending emails with exponential backoff
		const maxRetries = 3;
		let attempt = 0;
		let emailSent = false;

		while (attempt < maxRetries && !emailSent) {
			try {
				// Send the email with the log content
				await sgMail.send(msg);
				emailSent = true;
				logger.info('Logs successfully sent to the administrator.');
			} catch (error) {
				attempt++;
				logger.error(`Failed to send logs email (Attempt ${attempt}/${maxRetries}):`, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					event: 'SendLogsEmail',
				});
				if (attempt >= maxRetries) {
					throw new Error('Failed to send logs email after multiple attempts.');
				}
				// Wait before retrying (exponential backoff)
				const delay = Math.pow(2, attempt) * 1000; // 2^attempt * 1000ms
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		// Clear the logs from Redis after sending
		await redis.del('app-logs');
		logger.info('Logs cleared from Redis after sending.');
	} catch (error: unknown) {
		logger.error('Error while sending logs:', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			event: 'SendLogs',
		});
		// Optionally rethrow or handle the error further
	}
}

/**
 * Builds the email content with actionable insights from the parsed logs.
 * @param parsedLogs - Array of parsed log entries.
 * @returns A string containing the HTML content for the email.
 */
function buildEmailContent(parsedLogs: LogEntry[]): string {
	// Group logs by severity level
	const logsByLevel = parsedLogs.reduce((acc: Record<string, LogEntry[]>, log: LogEntry) => {
		acc[log.level] = acc[log.level] || [];
		acc[log.level].push(log);
		return acc;
	}, {});

	// Build email content with actionable insights
	let emailContent = `<h1>Accumulated Logs Report</h1>`;
	for (const level of ['error', 'warn', 'info', 'debug']) {
		if (logsByLevel[level] && logsByLevel[level].length > 0) {
			emailContent += `<h2>${level.toUpperCase()} Logs</h2><ul>`;
			for (const log of logsByLevel[level]) {
				// Sanitize log messages and details to prevent XSS
				const sanitizedMessage = purify.sanitize(log.message);
				const sanitizedMeta = log.meta ? purify.sanitize(JSON.stringify(log.meta)) : '';
				emailContent += `<li><strong>Timestamp:</strong> ${log.timestamp} - <strong>Message:</strong> ${sanitizedMessage}`;
				if (sanitizedMeta) {
					emailContent += ` - <strong>Details:</strong> ${sanitizedMeta}`;
				}
				emailContent += `</li>`;
			}
			emailContent += `</ul>`;
		}
	}
	return emailContent;
}

export default sendLogs;
