// src/core/errors/clientIpError.ts

import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * ClientIpExtractionError class for handling failures in extracting client IP.
 */
export class ClientIpError extends BaseError {
	/**
	 * Creates a new ClientIpExtractionError instance.
	 * @param message - The error message.
	 * @param module - The module name where this error originated.
	 * @param originalError - The original error object, if any.
	 */
	constructor(message: string, module: string, originalError?: unknown) {
		super(message, 400, ErrorCodes.CLIENT_IP_ERROR, module, originalError);
	}
}
