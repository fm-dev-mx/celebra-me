// src/core/errors/badRequestError.ts

import { BaseError } from './baseError';

/**
 * BadRequestError class for handling invalid requests.
 */
export class BadRequestError extends BaseError {
	constructor(message: string, module: string) {
		super(message, 400, 'BAD_REQUEST', module);
	}
}
