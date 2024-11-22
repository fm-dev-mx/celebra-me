// src/backend/middlewares/rateLimiterMiddleware.ts

import { isRateLimited, getRateLimiter } from '@/backend/utilities/rateLimiterUtils';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import { Handler } from '@/core/types/handlers';
import { createErrorResponse } from '@/core/utilities/apiResponseUtils';
import logger from '@/backend/utilities/logger';

/**
 * Rate limiter middleware factory.
 *
 * Creates a middleware function that enforces rate limiting based on the provided configuration.
 *
 * @param config - Configuration for the rate limiter.
 * @returns A middleware function that applies rate limiting logic.
 */
export function rateLimiterMiddleware(config: RateLimiterConfig) {
	return (handler: Handler): Handler => {
		return async (context): Promise<Response> => {
			const clientIp = context.clientIp;

			if (!clientIp) {
				// Log the error before throwing an error
				logger.error('Unable to determine client IP for rate limiting.', {
					event: 'RateLimiter',
					route: context.request.url, // Asumiendo que context tiene acceso a la URL
					method: context.request.method,
					timestamp: new Date().toISOString(),
				});

				// Throw an error to the client
				throw createErrorResponse(400, 'Unable to determine client IP');
			}

			try {
				// Initialize the rate limiter
				const rateLimiter = await getRateLimiter(config);

				// Check if the client IP is rate-limited
				if (await isRateLimited(rateLimiter, clientIp)) {
					throw createErrorResponse(
						429,
						'Has enviado demasiados mensajes. Intenta más tarde.',
						undefined,
						'RATE_LIMIT_EXCEEDED',
						config.limit,
						config.duration
					);
				}
			} catch (error) {
				// Re-throw expected errors (e.g., 429 Too Many Requests)
				if (
					typeof error === 'object' &&
					error !== null &&
					(error as any).statusCode === 429
				) {
					throw error; // Preserve the original rate limit error
				}

				// Log unexpected errors gracefully
				logger.error('Unexpected error in rateLimiterMiddleware:', {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					event: 'RateLimiter',
				});
				throw createErrorResponse(500, 'Internal server error during rate limiting');
			}

			// Proceed to the next handler if not rate-limited
			return handler(context);
		};
	};
}
