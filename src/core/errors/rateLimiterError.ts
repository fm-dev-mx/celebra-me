// src/core/errors/rateLimiterError.ts
import { BaseError } from './baseError';
import { ErrorCodes } from './errorCodes';

/**
 * RateLimiterError class for handling rate limiter errors.
 */
export class RateLimiterError extends BaseError {
	public limit: number;
	public duration: string;

	/**
	 * Creates a new RateLimiterError instance.
	 * @param message - The error message.
	 * @param limit - The maximum allowed requests.
	 * @param duration - The time window for the rate limit.
	 * @param module - The module name where this error originated.
	 * @param originalError - The original error object, if any.
	 */
	constructor(message: string, limit: number, duration: string, module: string, originalError?: unknown) {
		super(message, 429, ErrorCodes.RATE_LIMIT_EXCEEDED, module, originalError);
		this.limit = limit;
		this.duration = duration;
	}
}
