// src/backend/utilities/emailContentBuilder.ts

import { LogEntry } from '@/core/interfaces/logEntry.interface';
import { escapeHtml } from './dataSanitization';
import { ContactFormData } from '@/core/interfaces/contactFormData.interface';

/**
 * Builds the HTML content for critical error notification emails.
 * @param info - The log information.
 * @returns HTML string with the email content.
 */
export function buildErrorNotificationEmailContent(info: LogEntry): string {
	const sanitizedMessage = escapeHtml(info.message);
	const sanitizedMeta = info.meta ? escapeHtml(JSON.stringify(info.meta, null, 2)) : '';
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
}

/**
 * Builds the HTML content for contact form emails.
 * @param data - Contact form data.
 * @returns HTML string with the email content.
 */
export function buildContactFormEmailContent(data: ContactFormData): string {
	const { name, email, mobile = 'N/A', message } = data;
	return `
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(mobile)}</p>
    <p><strong>Message:</strong> ${escapeHtml(message)}</p>
  `;
}


