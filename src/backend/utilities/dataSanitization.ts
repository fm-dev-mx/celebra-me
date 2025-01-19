// src/backend/utilities/dataSanitization.ts

import { ApiErrorResponse } from "@/core/interfaces/apiResponse.interface";
import { DataSanitizationError } from "@/core/errors/dataSanitizationError";

const MODULE_NAME = 'DataSanitization';

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * @param unsafe - The string to escape.
 * @returns The escaped string.
 * @throws DataSanitizationError if the input is not a valid string.
 */
export function escapeHtml(unsafe: string): string {
	if (typeof unsafe !== 'string') {
		throw new DataSanitizationError('Invalid input type for escapeHtml; expected a string.', MODULE_NAME);
	}
	return unsafe.replace(/[&<>"']/g, (char) =>
	({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	}[char] ?? char)
	);
}

/**
 * Masks email addresses to protect user privacy.
 * Example: john.doe@example.com => j***e@example.com
 * @param email - The email address to mask.
 * @returns The masked email address.
 * @throws DataSanitizationError if the email format is invalid.
 */
export function maskEmailAddress(email: string): string {
	if (typeof email !== 'string') {
		throw new DataSanitizationError('Invalid input type for maskEmailAddress; expected a string.', MODULE_NAME);
	}

	const [localPart, domain] = email.split('@');
	if (!localPart || !domain) {
		return '***@***.***'; // Fallback for invalid emails
	}
	if (localPart.length <= 2) {
		return `***@${domain}`;
	}
	return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

/**
 * Masks the client IP address to protect user privacy.
 * @param ipAddress - The IP address to mask.
 * @returns The masked IP address.
 * @throws DataSanitizationError if the IP address format is invalid.
 */
export function maskIpAddress(ipAddress: string): string {
	if (typeof ipAddress !== 'string') {
		throw new DataSanitizationError('Invalid input type for maskIpAddress; expected a string.', MODULE_NAME);
	}

	// Supports both IPv4 and IPv6
	if (ipAddress.includes('.')) {
		// IPv4
		return ipAddress.replace(/\.\d+$/, '.***');
	} else if (ipAddress.includes(':')) {
		// IPv6
		return ipAddress.replace(/:[\da-fA-F]+$/, ':****');
	}
	return '***.***.***.***';
}

/**
 * Masks phone numbers to protect user privacy.
 * Example: 123-456-7890 => 123-***-7890
 * @param phoneNumber - The phone number to mask.
 * @returns The masked phone number.
 * @throws DataSanitizationError if the phone number format is invalid.
 */
export function maskPhoneNumber(phoneNumber: string): string {
	if (typeof phoneNumber !== 'string') {
		throw new DataSanitizationError('Invalid input type for maskPhoneNumber; expected a string.', MODULE_NAME);
	}

	// Simple regex to match phone numbers (this can be enhanced)
	const phoneRegex = /^(\d{3})[- ]?(\d{3})[- ]?(\d{4})$/;
	const match = phoneNumber.match(phoneRegex);

	if (!match) {
		return '***-***-****'; // Fallback for invalid phone numbers
	}

	const [_, areaCode, centralOffice, lineNumber] = match;
	return `${areaCode}-***-${lineNumber}`;
}

/**
 * Masks a generic sensitive value, showing only partial content.
 * For strings longer than 2 chars: first char, masked middle, last char.
 * For shorter strings: fully masked.
 * For non-string values: masked with "***".
 * @param value - The value to mask.
 * @returns The partially masked value.
 */
export function maskValue(value: unknown): string {
	if (typeof value !== 'string') {
		return '***';
	}

	const length = value.length;
	if (length <= 2) {
		return '*'.repeat(length);
	}
	return `${value[0]}${'*'.repeat(length - 2)}${value[length - 1]}`;
}

/**
 * Sanitizes an object by redacting sensitive fields.
 * Instead of a full redaction, it partially masks them.
 * @param data - The data to sanitize.
 * @returns The sanitized data.
 * @throws DataSanitizationError if the input is not an object.
 */
export function sanitizeObject<T extends Record<string, any>>(data: T): T {
	if (typeof data !== 'object' || data === null) {
		throw new DataSanitizationError('Invalid input type for sanitizeObject; expected an object.', MODULE_NAME);
	}

	const sensitiveFields = categorizeSensitiveFields();

	const seen = new WeakSet();

	function sanitize(obj: any): any {
		if (typeof obj !== 'object' || obj === null) {
			return obj;
		}

		if (seen.has(obj)) {
			return '[Circular]';
		}
		seen.add(obj);

		if (Array.isArray(obj)) {
			return obj.map(item => sanitize(item));
		}

		return Object.keys(obj).reduce((acc, key) => {
			const value = obj[key];
			const fieldCategory = sensitiveFields[key.toLowerCase()];

			if (fieldCategory) {
				switch (fieldCategory) {
					case 'email':
						acc[key] = maskEmailAddress(value);
						break;
					case 'ip':
						acc[key] = maskIpAddress(value);
						break;
					case 'phone':
						acc[key] = maskPhoneNumber(value);
						break;
					default:
						acc[key] = maskValue(value);
				}
			} else if (typeof value === 'object' && value !== null) {
				acc[key] = sanitize(value);
			} else {
				acc[key] = value;
			}
			return acc;
		}, {} as Record<string, unknown>);
	}

	return sanitize(data);
}

/**
 * Categorizes sensitive fields for better sanitization handling.
 * @returns An object mapping lowercased field names to their categories.
 */
function categorizeSensitiveFields(): Record<string, string> {
	return {
		'password': 'generic',
		'token': 'generic',
		'secret': 'generic',
		'apikey': 'generic',
		'authorization': 'generic',
		'creditcard': 'generic',
		'ssn': 'generic',
		'accesstoken': 'generic',
		'refreshtoken': 'generic',
		'pin': 'generic',
		'credential': 'generic',
		'session': 'generic',
		'email': 'email',
		'useremail': 'email',
		'to': 'email',
		'from': 'email',
		'cc': 'email',
		'bcc': 'email',
		'replyto': 'email',
		'phone': 'phone',
		'mobile': 'phone',
		'address': 'generic',
		'name': 'generic',
		'ip': 'ip',
	};
}

/**
 * Sanitizes error information for logging and notifications.
 *
 * @param error - The error object.
 * @returns A sanitized version of the error.
 */
export function sanitizeError(error: unknown): Partial<ApiErrorResponse> {
	if (error instanceof Error) {
		return {
			message: escapeHtml(error.message),
			event: error.name,
			code: (error as any).code,
		};
	}
	return { message: 'An unknown error occurred' };
}
