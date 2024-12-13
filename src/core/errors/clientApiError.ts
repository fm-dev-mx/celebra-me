// src/core/errors/clientApiError.ts (Frontend Only)
import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * ClientApiError class for handling client-side API errors.
 */
export class ClientApiError extends BaseError {
	constructor(message: string, module: string, originalError?: unknown) {
		// Default to 500 or use actual status from response if known
		super(message, 500, ErrorCodes.UNKNOWN_ERROR, module, originalError);
	}
}
