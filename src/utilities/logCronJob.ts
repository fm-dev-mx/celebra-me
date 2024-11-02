// src/utilities/logCronJob.ts

import sgMail, { type MailDataRequired } from '@sendgrid/mail';
import config from '@/core/config';
import redis from '@/utilities/redisClient';
import logger from '@/utilities/logger';

/**
 * Sends the accumulated logs to administrators via email.
 * This function is intended to be run as a cron job.
 */
export async function sendLogs(): Promise<void> {
	sgMail.setApiKey(config.EMAIL_CONFIG.sendgridApiKey);
	try {
		// Retrieve all log entries from Redis
		const logEntries: string[] = await redis.lrange('app-logs', 0, -1);

		if (logEntries.length === 0) {
			logger.info('No logs available to send.');
			return;
		}

		// Combine all logs into a single string
		const logContent = logEntries
			.map((entry) => JSON.parse(entry))
			.map((log) => JSON.stringify(log))
			.join('\n');

		// Prepare the email message with the logs attached
		const msg: MailDataRequired = {
			to: config.ADMIN_EMAIL, // Administrator's email
			from: config.EMAIL_CONFIG.sender, // Verified sender email in SendGrid
			subject: `Log Files - ${new Date().toLocaleString()}`,
			text: 'Attached are the accumulated logs up to this date.',
			attachments: [
				{
					content: Buffer.from(logContent).toString('base64'),
					filename: `logs-${new Date().toISOString()}.txt`,
					type: 'text/plain',
					disposition: 'attachment',
				},
			],
		};

		// Send the email with the log attachments
		await sgMail.send(msg);
		logger.info('Logs successfully sent to the administrator.');

		// Clear the logs from Redis after sending
		await redis.del('app-logs');
		logger.info('Logs cleared from Redis after sending.');
	} catch (error: unknown) {
		if (error instanceof Error) {
			logger.error('Error while sending logs:', {
				error: error.message,
				stack: error.stack,
			});
		} else {
			logger.error('Unknown error while sending logs:', { error });
		}
	}
}

export default sendLogs;

