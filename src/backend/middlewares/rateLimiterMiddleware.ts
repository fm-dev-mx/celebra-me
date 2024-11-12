// src/backend/middlewares/rateLimiterMiddleware.ts

import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';


import { isRateLimited, getRateLimiter } from '@/backend/utilities/rateLimiterUtils';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import { getClientIp } from '@/backend/utilities/getClientIp';
import { APIContext, APIRoute } from 'astro';
import logger from '@/backend/utilities/logger';
import { jsonResponse } from '@/core/config/constants';

/**
 * Rate limiter middleware factory.
 * Creates a middleware function for rate limiting.

 * @param config - Configuration for the rate limiter.
 * @returns A middleware function that enforces rate limiting.
 *
 * @example
 * export const POST: APIRoute = rateLimiterMiddleware(rateLimiterConfig)(async (context) => {
 *   // Handler code
 * });
 */

export function rateLimiterMiddleware(config: RateLimiterConfig) {
	return (handler: (context: ContactFormAPIContext) => Promise<Response> | Response) => {
		return async (context: ContactFormAPIContext) => {
			let clientIp = context.clientIp;
			if (!clientIp) {
				clientIp = getClientIp(context.request) || 'Unknown IP';
				context.clientIp = clientIp;
			}

			if (!clientIp) {
				logger.warn('Client IP not detected; proceeding without rate limiting.');
				return handler(context);
			}

			try {
				const rateLimiter = await getRateLimiter(config);
				const limited = await isRateLimited(rateLimiter, clientIp);

				if (limited) {
					logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
					return jsonResponse({ error: 'Too Many Requests' }, 429);
				}

				return await handler(context);
			} catch (error) {
				logger.error(`Error in rate limiter middleware for IP: ${clientIp}`, { error });
				// Allow the request to proceed if rate limiting fails
				return await handler(context);
			}

			return handler(context);
		};
	};
}
