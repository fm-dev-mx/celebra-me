// src/core/errors/configurationError.ts
import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * ConfigurationError class for handling missing or invalid configuration errors.
 */
export class ConfigurationError extends BaseError {
	constructor(message: string, module: string, originalError?: unknown) {
		super(
			message,
			500,
			ErrorCodes.CONFIGURATION_ERROR, // Add this to your enum
			module,
			originalError
		);
	}
}
