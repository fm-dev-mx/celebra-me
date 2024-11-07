// src/backend/middleware/rateLimiterMiddleware.ts

import { rateLimiterManager, isRateLimited, type RateLimiterConfig } from '@/backend/utilities/rateLimiterUtils';
import { getClientIp } from '@/backend/utilities/getClientIp';
import type { Request, Response, NextFunction } from 'express';

/**
 * Rate limiter middleware factory.
 * Creates an Express middleware function for rate limiting.
 *
 * @param config - Configuration for the rate limiter.
 * @returns {Function} - The Express middleware function.
 *
 * @example
 * const rateLimiterConfig = {
 *   limit: 100,
 *   duration: '1 h' as Duration,
 *   prefix: 'rl_global',
 * };
 *
 * app.use(createRateLimiterMiddleware(rateLimiterConfig));
 */
export function createRateLimiterMiddleware(config: RateLimiterConfig) {
	const rateLimiter = rateLimiterManager.getRateLimiter(config);

	return async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
		const clientIp = getClientIp(req);

		if (!clientIp) {
			// Proceed without rate limiting if IP is not available
			next();
			return;
		}

		const limited = await isRateLimited(await rateLimiter, clientIp);
		if (limited) {
			res.status(429).send('Too Many Requests');
		} else {
			next();
		}
	};
}
