// src/core/errors/dataSanitizationError.ts

import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * DataSanitizationError class for handling data sanitization failures.
 */
export class DataSanitizationError extends BaseError {
	/**
	 * Creates a new DataSanitizationError instance.
	 * @param message - The error message.
	 * @param module - The module name where this error originated.
	 * @param originalError - The original error object, if any.
	 */
	constructor(message: string, module: string, originalError?: unknown) {
		super(message, 400, ErrorCodes.DATA_SANITIZATION_ERROR, module, originalError);
	}
}
