// src/core/errors/emailServiceError.ts
import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * EmailServiceError class for handling email sending errors.
 */
export class EmailServiceError extends BaseError {
	/**
	 * Creates a new EmailServiceError instance.
	 * @param message - The error message.
	 * @param module - The module name where this error originated.
	 * @param originalError - The original error object, if any.
	 */
	constructor(message: string, module: string, originalError?: unknown) {
		super(message, 500, ErrorCodes.EMAIL_SERVICE_ERROR, module, originalError);
	}
}
