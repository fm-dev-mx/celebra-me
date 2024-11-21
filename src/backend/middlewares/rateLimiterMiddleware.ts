// src/backend/middlewares/rateLimiterMiddleware.ts

import { isRateLimited, getRateLimiter } from '@/backend/utilities/rateLimiterUtils';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import { Handler } from '@/core/types/handlers';
import { ApiErrorResponse } from '@/core/interfaces/apiResponse.interface';

/**
 * Rate limiter middleware factory.
 * Creates a middleware function for rate limiting.
 *
 * @param config - Configuration for the rate limiter.
 * @returns A middleware function that enforces rate limiting.
 */
export function rateLimiterMiddleware(config: RateLimiterConfig) {
	return (handler: Handler): Handler => {
		return async (context) => {
			const clientIp = context.clientIp;

			if (!clientIp) {
				throw {
					success: false,
					statusCode: 400,
					message: 'Unable to determine client IP',
				} as ApiErrorResponse;
			}

			const rateLimiter = await getRateLimiter(config);
			const limited = await isRateLimited(rateLimiter, clientIp);

			if (limited) {
				throw {
					success: false,
					statusCode: 429,
					message: 'Too many requests. Please try again later.',
				} as ApiErrorResponse;
			}

			return handler(context);
		};
	};
}
