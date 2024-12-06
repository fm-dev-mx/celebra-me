// src/core/errors/repositoryError.ts

import { BaseError } from './baseError';

/**
 * RepositoryError class for handling errors in data repositories.
 */
export class RepositoryError extends BaseError {
	public originalError?: unknown;

	constructor(message: string, module: string, originalError?: unknown) {
		super(message, 500, 'REPOSITORY_ERROR', module);
		this.originalError = originalError;
	}
}
