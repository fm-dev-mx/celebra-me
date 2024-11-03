// src/backend/middleware/rateLimiter.ts

import { Ratelimit } from '@upstash/ratelimit';
import type { Duration } from '@upstash/ratelimit';
import redis from '@/infrastructure/redisClient';
import logger from '@/backend/utilities/logger';

interface RateLimiterConfig {
	limit: number;
	duration: Duration;
	prefix: string;
}

// Cache for rate limiter instances to avoid multiple instances for the same config
const rateLimiterCache: Map<string, Ratelimit> = new Map();

/**
 * Generates a unique key for caching based on the rate limiter config.
 * @param config - RateLimiter configuration.
 * @returns A unique string key.
 */
const generateCacheKey = (config: RateLimiterConfig): string => {
	return `${config.prefix}:${config.limit}:${config.duration}`;
};

/**
 * Creates or retrieves a cached rate limiter instance based on the provided config.
 * Renamed from `createRateLimiter` to `getRateLimiter` for clarity.
 * @param limit - Max number of allowed requests.
 * @param duration - Time window for requests (e.g., '15 m').
 * @param prefix - Redis key prefix for this rate limiter.
 * @returns The cached or new Ratelimit instance.
 */
export function getRateLimiter(limit: number, duration: Duration, prefix: string): Ratelimit {
	// Validate input parameters
	if (limit <= 0) {
		throw new Error('Rate limiter limit must be a positive number.');
	}
	if (!duration) {
		throw new Error('Rate limiter duration must be specified.');
	}
	if (!prefix) {
		throw new Error('Rate limiter prefix must be specified.');
	}

	const config: RateLimiterConfig = { limit, duration, prefix };
	const cacheKey = generateCacheKey(config);

	// Return cached RateLimiter if it exists
	if (rateLimiterCache.has(cacheKey)) {
		return rateLimiterCache.get(cacheKey)!;
	}

	// Create a new RateLimiter instance and cache it
	const newRateLimiter = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(limit, duration),
		prefix,
	});

	rateLimiterCache.set(cacheKey, newRateLimiter);
	logger.debug(`Created new RateLimiter with config: ${cacheKey}`);
	return newRateLimiter;
}

/**
 * Checks if a client has exceeded the rate limit.
 * @param rateLimiter - The rate limiter instance.
 * @param key - The unique key to identify the client (e.g., IP address).
 * @returns A boolean indicating if the client is rate limited.
 */
export async function isRateLimited(rateLimiter: Ratelimit, key: string): Promise<boolean> {
	if (!key) {
		logger.warn('Rate limiting failed: key is undefined or empty.');
		return true;
	}

	try {
		const { success, limit, remaining, reset } = await rateLimiter.limit(key);

		// El reset ya está en milisegundos, no es necesario multiplicar por 1000
		const resetDate = reset > 0 ? new Date(reset).toISOString() : 'Unknown';
		if (!success) {
			logger.warn(
				`Rate limit exceeded for key: ${key}. Limit: ${limit}, Remaining: ${remaining}, Reset: ${resetDate}`
			);
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

/**
 * Clears the rate limiter cache, useful for testing.
 */
export function clearRateLimiterCache(): void {
	rateLimiterCache.clear();
	logger.debug('Cleared RateLimiter cache.');
}
