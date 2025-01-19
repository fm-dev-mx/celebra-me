// src/backend/utilities/emailContentBuilder.ts

import { LogEntry } from '@/core/interfaces/logEntry.interface';
import { escapeHtml } from './dataSanitization';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { EmailData } from '@/core/interfaces/emailData.interface';
import config from '@/core/config';
import { LogLevel } from '@/core/interfaces/loggerInput.interface';

/**
 * Builds the email content for log entries.
 * This function handles both immediate (critical) notifications and consolidated summaries.
 *
 * @param logEntries - Array of log entries to include in the email.
 * @param options - Configuration options for the email content builder.
 *                  - immediate: If true, builds content for immediate notifications.
 * @returns A string containing the HTML content for the email.
 */
export function buildLogEmailContent(
	logEntries: LogEntry[],
	options: { immediate?: boolean } = {}
): string {
	// If this is an immediate notification and there's exactly one log entry,
	// it's likely a critical notification scenario.
	if (options.immediate && logEntries.length === 1) {
		const info = logEntries[0];
		const sanitizedMessage = escapeHtml(info.message);
		const sanitizedMeta = info.meta
			? escapeHtml(JSON.stringify(info.meta, null, 2))
			: '';
		const sanitizedModule = escapeHtml(info.module || 'N/A');
		const timestamp = escapeHtml(info.timestamp || new Date().toISOString());
		const level = escapeHtml(info.level || 'N/A');

		return `
      <h1>Critical Error Notification</h1>
      <p><strong>Timestamp:</strong> ${timestamp}</p>
      <p><strong>Level:</strong> ${level}</p>
      <p><strong>Module:</strong> ${sanitizedModule}</p>
      <p><strong>Message:</strong> ${sanitizedMessage}</p>
      <p><strong>Details:</strong> <pre>${sanitizedMeta}</pre></p>
    `;
	} else {
		// Consolidated report for multiple logs.
		// We group logs by their Winston level.
		const logsByLevel = logEntries.reduce<Record<string, LogEntry[]>>(
			(acc, log) => {
				acc[log.level] = acc[log.level] || [];
				acc[log.level].push(log);
				return acc;
			},
			{}
		);
		let content = `<h1>Accumulated Logs Report</h1>`;

		for (const level of Object.values(LogLevel)) {
			const logs = logsByLevel[level];
			if (logs && logs.length > 0) {
				content += `<h2>${escapeHtml(level.toUpperCase())} Logs (${logs.length})</h2><ul>`;
				for (const log of logs) {
					const sanitizedMessage = escapeHtml(String(log.message));
					const sanitizedMeta = log.meta
						? escapeHtml(JSON.stringify(log.meta, null, 2))
						: '';
					const sanitizedModule = escapeHtml(log.module || 'N/A');
					const timestamp = escapeHtml(log.timestamp || new Date().toISOString());
					content += `<li>
              						<strong>Timestamp:</strong> ${timestamp}<br>
             						 <strong>Message:</strong> ${sanitizedMessage}<br>
									<strong>Module:</strong> ${sanitizedModule}<br>
              						<strong>Details:</strong> <pre>${sanitizedMeta}</pre>
            					</li>`;
				}
				content += `</ul>`;
			}
		}
		return content;
	}
}

/**
 * Builds the email content for contact form submissions.
 *
 * @param data - The contact form data submitted by the user.
 * @returns A string containing the HTML content for the contact form email.
 */
export function buildContactFormEmailContent(data: ContactFormData): string {
	const { name, email, mobile = 'N/A', message } = data;
	return `
    <h1>New Contact Form Submission</h1>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(mobile)}</p>
    <p><strong>Message:</strong> ${escapeHtml(message)}</p>
  `;
}

/**
 * Prepares the email data from the contact form submission.
 * Ensures input is sanitized before creating the email content.
 *
 * @param data - The validated contact form data.
 * @returns The email data ready to be sent.
 */
export function prepareEmailData(data: ContactFormData): EmailData {
	const { name, email, message } = data;
	const { recipient, sender } = config.contactFormEmailConfig;

	// Sanitize inputs
	const safeName = escapeHtml(name);
	const safeEmail = escapeHtml(email);
	const safeMessage = escapeHtml(message);
	const safeMobile = escapeHtml(data.mobile || 'N/A');

	// Construct sanitized data object
	const sanitizedData: ContactFormData = {
		name: safeName,
		email: safeEmail,
		mobile: safeMobile,
		message: safeMessage,
	};

	return {
		to: recipient,
		from: sender,
		replyTo: safeEmail,
		subject: `New Contact Form Submission from ${safeName}`,
		html: buildContactFormEmailContent(sanitizedData),
	};
}
