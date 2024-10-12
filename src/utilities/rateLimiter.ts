// src/utilities/rateLimiter.ts

import { Ratelimit } from '@upstash/ratelimit';
import type { Duration } from '@upstash/ratelimit';
import redis from '@/utilities/redisClient';
import logger from '@/utilities/logger';

/**
 * Factory function to create a rate limiter instance.
 * @param limit - Number of allowed requests.
 * @param duration - Duration in which the requests are counted (e.g., '15 m').
 * @param prefix - Prefix for Redis keys.
 * @returns {Ratelimit} - A new rate limiter instance.
 */
export function createRateLimiter(limit: number, duration: Duration, prefix: string): Ratelimit {
	return new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(limit, duration),
		prefix,
	});
}

/**
 * Checks if a key has exceeded the rate limit using the provided rate limiter.
 * @param rateLimiter - The rate limiter instance.
 * @param key - The unique key to identify the client (e.g., IP address).
 * @returns {Promise<boolean>} - Returns true if rate limited, false otherwise.
 */
export async function isRateLimited(rateLimiter: Ratelimit, key: string): Promise<boolean> {
	try {
		const { success } = await rateLimiter.limit(key);
		if (!success) {
			logger.warn(`Rate limit exceeded for key: ${key}.`);
			return true;
		}
		return false;
	} catch (error: unknown) {
		if (error instanceof Error) {
			logger.error(`Rate limiting failed for key: ${key}. Error: ${error.message}`);
		} else {
			logger.error(`Rate limiting failed for key: ${key}. Unknown error.`);
		}
		// Block access by default to prevent abuse if Redis is unavailable
		return true;
	}
}
