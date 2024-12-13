// src/core/errors/initializationError.ts
import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * InitializationError class for handling client initialization failures.
 */
export class InitializationError extends BaseError {
	/**
	 * Creates a new InitializationError instance.
	 * @param message - The error message.
	 * @param module - The module name where this error originated.
	 * @param originalError - The original error object, if any.
	 */
	constructor(message: string, module: string, originalError?: unknown) {
		super(
			message,
			500,
			ErrorCodes.INITIALIZATION_ERROR, // Add this to your ErrorCodes enum
			module,
			originalError
		);
	}
}
