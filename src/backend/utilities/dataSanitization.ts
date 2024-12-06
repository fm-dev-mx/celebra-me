// src/backend/utilities/dataSanitization.ts

import { ApiErrorResponse } from "@/core/interfaces/apiResponse.interface";

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * @param unsafe - The string to escape.
 * @returns The escaped string.
 */
export function escapeHtml(unsafe: string): string {
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
 * Utility function to mask email addresses to protect user privacy.
 * Example: john.doe@example.com => j***e@example.com
 * @param email - The email address to mask.
 * @returns The masked email address.
 */
export function maskEmailAddress(email: string): string {
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
 */
export function maskIpAddress(ipAddress: string): string {
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
 * Masks a generic sensitive value, showing only partial content.
 * For strings longer than 2 chars: first char, masked middle, last char.
 * For shorter strings: fully masked.
 * For non-string values: masked with "***".
 * @param value - The value to mask.
 * @returns The partially masked value.
 */
function maskValue(value: unknown): string {
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
 */
export function sanitizeObject(data: any): any {
	const sensitiveFields = [
		'password',
		'token',
		'secret',
		'apiKey',
		'authorization',
		'creditCard',
		'ssn',
		'accessToken',
		'refreshToken',
		'pin',
		'credential',
		'session',
		'email',
		'phone',
		'mobile',
		'address',
		'name',
	];

	const seen = new WeakSet();

	function sanitize(data: any): any {
		if (typeof data !== 'object' || data === null) {
			return data;
		}

		if (seen.has(data)) {
			return '[Circular]';
		}
		seen.add(data);

		if (Array.isArray(data)) {
			return data.map(item => sanitize(item));
		}

		return Object.keys(data).reduce((acc, key) => {
			const value = data[key];
			const isSensitive = sensitiveFields.some(field => field.toLowerCase() === key.toLowerCase());

			if (isSensitive) {
				// Special handling for known data types if needed
				if (key.toLowerCase() === 'email' && typeof value === 'string') {
					acc[key] = maskEmailAddress(value);
				} else if ((key.toLowerCase() === 'ip' || key.toLowerCase().includes('ip')) && typeof value === 'string') {
					acc[key] = maskIpAddress(value);
				} else {
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
 * Sanitizes error information for logging and notifications.
 *
 * @param error - The error object.
 * @returns A sanitized version of the error.
 */
export function sanitizeError(error: unknown): Partial<ApiErrorResponse> {
	if (error instanceof Error) {
		return {
			message: error.message,
			code: (error as any).code,
		};
	}
	return { message: 'An unknown error occurred' };
}
