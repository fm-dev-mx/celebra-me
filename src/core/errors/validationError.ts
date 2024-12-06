// src/core/errors/validationError.ts

import { BaseError } from './baseError';
import { ValidationErrors } from '@/core/interfaces/apiResponse.interface';

/**
 * ValidationError class for handling validation errors.
 */
export class ValidationError extends BaseError {
	public errors?: ValidationErrors;

	constructor(message: string, module: string, errors?: ValidationErrors) {
		super(message, 400, 'VALIDATION_ERROR', module);
		this.errors = errors;
	}
}
