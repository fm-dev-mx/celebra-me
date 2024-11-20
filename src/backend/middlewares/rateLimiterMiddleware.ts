// src/backend/middlewares/rateLimiterMiddleware.ts

import { isRateLimited, getRateLimiter } from '@/backend/utilities/rateLimiterUtils';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import logger from '@/backend/utilities/logger';
import { jsonResponse } from '@/core/config/constants';
import { Handler } from '@/core/types/handlers';
import { getClientIp } from '../utilities/getClientIp';

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
			context.clientIp = getClientIp(context.request) || 'Unknown IP';

			if (context.clientIp === 'Unknown IP') {
				logger.warn('Client IP not detected; denying request.');
				return jsonResponse({ success: false, message: 'Unable to determine client IP' }, 400);
			}

			try {
				const rateLimiter = await getRateLimiter(config);
				const limited = await isRateLimited(rateLimiter, context.clientIp);

				if (limited) {
					return jsonResponse({ success: false, message: 'Has enviado demasiados mensajes. Intenta más tarde.' }, 429);
				}

				return await handler(context);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error(`Error in rate limiter middleware for IP: ${context.clientIp}`, { error: errorMessage });
				// Fail securely: deny the request if rate limiting fails
				return jsonResponse({ success: false, message: 'Service Unavailable' }, 503);
			}
		};
	};
}
