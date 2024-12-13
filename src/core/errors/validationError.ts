// src/core/errors/validationError.ts
import { BaseError } from './baseError';
import { ValidationErrors } from '@/core/interfaces/apiResponse.interface';
import { ErrorCodes } from './errorCodes';

/**
 * ValidationError class for handling validation errors.
 */
export class ValidationError extends BaseError {
	public errors?: ValidationErrors;

	/**
	 * Creates a new ValidationError instance.
	 * @param message - The error message.
	 * @param module - The module name where this error originated.
	 * @param errors - Detailed validation errors.
	 * @param originalError - The original error object, if any.
	 */
	constructor(message: string, module: string, errors?: ValidationErrors, originalError?: unknown) {
		super(message, 400, ErrorCodes.VALIDATION_ERROR, module, originalError);
		this.errors = errors;
	}
}
