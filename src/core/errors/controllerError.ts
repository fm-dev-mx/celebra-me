// src/core/errors/controllerError.ts
import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * ControllerError class for handling controller-related errors.
 * Extending BaseError for consistency.
 */
export class ControllerError extends BaseError {
	/**
	 * Creates a new ControllerError instance.
	 * @param message - The error message.
	 * @param module - The module name where this error originated.
	 * @param originalError - The original error object, if any.
	 */
	constructor(message: string, module: string, originalError?: unknown) {
		// Consider 500 as a default status code or change according to the scenario
		super(message, 500, ErrorCodes.CONTROLLER_ERROR, module, originalError);
	}
}
