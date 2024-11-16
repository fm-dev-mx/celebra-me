// src/backend/middlewares/rateLimiterMiddleware.ts

import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import { isRateLimited, getRateLimiter } from '@/backend/utilities/rateLimiterUtils';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import logger from '@/backend/utilities/logger';
import { jsonResponse } from '@/core/config/constants';
import { Handler } from '@/core/types/handlers';
import { getClientIp } from '../utilities/getClientIp';
import { ApiResponse } from '@/core/interfaces/apiResponse.interface';

/**
 * Rate limiter middleware factory.
 * Creates a middleware function for rate limiting.
 *
 * @param config - Configuration for the rate limiter.
 * @returns A middleware function that enforces rate limiting.
 *
 * @example
 * export const POST: Handler = rateLimiterMiddleware(rateLimiterConfig)(async (context) => {
 *   // Handler code
 * });
 */
export function rateLimiterMiddleware(config: RateLimiterConfig) {
	return (handler: Handler): Handler => {
		return async (context: ContactFormAPIContext) => {

			const { request } = context;

			context.clientIp = getClientIp(request) || 'Unknown IP';

			if (context.clientIp === 'Unknown IP') {
				logger.warn('Client IP not detected; proceeding without rate limiting.');
				return handler(context);
			}

			try {
				const rateLimiter = await getRateLimiter(config);
				const limited = await isRateLimited(rateLimiter, context.clientIp);

				if (limited) {
					return jsonResponse({ error: 'Too Many Requests' }, 429);
				}

				return await handler(context);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error(`Error in rate limiter middleware for IP: ${context.clientIp}`, { error: errorMessage });
				// Allow the request to proceed if rate limiting fails
				return await handler(context);
			}
		};
	};
}
