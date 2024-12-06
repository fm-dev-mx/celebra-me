// src/core/errors/emailServiceError.ts

import { BaseError } from './baseError';

/**
 * EmailServiceError class for handling email sending errors.
 */
export class EmailServiceError extends BaseError {
	constructor(message: string, module: string) {
		super(message, 500, 'EMAIL_SERVICE_ERROR', module);
	}
}
