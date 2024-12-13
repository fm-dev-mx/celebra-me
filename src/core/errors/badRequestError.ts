// src/core/errors/badRequestError.ts
import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * BadRequestError class for handling invalid requests.
 */
export class BadRequestError extends BaseError {
	/**
	 * Creates a new BadRequestError instance.
	 * @param message - The error message.
	 * @param module - The module name where this error originated.
	 * @param originalError - The original error object, if any.
	 */
	constructor(message: string, module: string, originalError?: unknown) {
		super(message, 400, ErrorCodes.BAD_REQUEST_ERROR, module, originalError);
	}
}
