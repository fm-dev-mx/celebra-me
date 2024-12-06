// src/core/errors/rateLimitExceededError.ts

import { BaseError } from './baseError';

/**
 * RateLimitExceededError class for handling rate limit errors.
 */
export class RateLimitExceededError extends BaseError {
	public limit: number;
	public duration: string;

	constructor(message: string, limit: number, duration: string, module: string) {
		super(message, 429, 'RATE_LIMIT_EXCEEDED', module);
		this.limit = limit;
		this.duration = duration;
	}
}
