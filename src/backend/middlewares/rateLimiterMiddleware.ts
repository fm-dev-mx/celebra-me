// src/backend/middlewares/rateLimiterMiddleware.ts

import rateLimiterFactory from '@/backend/services/rateLimiterFactory';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import { Handler, Middleware } from '@/core/types/handlers';
import { RateLimiterError } from '@/core/errors/rateLimiterError';
import { BadRequestError } from '@/core/errors/badRequestError';

const MODULE_NAME = 'RateLimiterMiddleware';

/**
 * Rate limiter middleware factory.
 *
 * Creates a middleware function that enforces rate limiting based on the provided configuration.
 *
 * @param config - Configuration for the rate limiter.
 * @returns A middleware function that applies rate limiting logic.
 */
export function rateLimiterMiddleware(config: RateLimiterConfig): Middleware {
	return (handler: Handler): Handler => {
		return async (context): Promise<Response> => {
			const clientIp = context.clientIp;

			if (!clientIp) {
				// Throw a bad request error with a specific message
				throw new BadRequestError('Client IP address is missing, unable to apply rate limiting.', MODULE_NAME);
			}

			try {
				// Check if the client is rate limited
				const isLimited = await rateLimiterFactory.isRateLimited(config, clientIp, {
					route: context.request.url,
					method: context.request.method,
				});

				if (isLimited) {
					// Throw a custom rate limit exceeded error
					throw new RateLimiterError(
						'You have sent too many requests. Please try again later.',
						config.limit,
						config.duration,
						MODULE_NAME
					);
				}
			} catch (error: unknown) {
				// Rethrow known errors, wrap unknown errors
				if (error instanceof RateLimiterError || error instanceof BadRequestError) {
					throw error;
				} else {
					throw new RateLimiterError('An error occurred while applying rate limiting.', config.limit, config.duration, MODULE_NAME);
				}
			}

			// Proceed to the next handler if not rate-limited
			return handler(context);
		};
	};
}
