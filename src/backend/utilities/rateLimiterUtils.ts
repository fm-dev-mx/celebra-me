// src/backend/utilities/rateLimiterUtils.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import RedisClient from '@/infrastructure/redisClient';
import logger from '@/backend/utilities/logger';

const rateLimiterCache = new Map<string, Ratelimit>();
let redisClient: Redis | null = null;

/**
 * Initializes Redis client if not already initialized.
 */
async function getRedisClient(): Promise<Redis> {
	if (!redisClient) {
		redisClient = await RedisClient.getInstance();
	}
	return redisClient;
}

/**
 * Creates or retrieves a cached rate limiter instance based on the provided config.
 * @param config - RateLimiterConfig object.
 * @returns {Promise<Ratelimit>} - The cached or new Ratelimit instance.
 */
export async function getRateLimiter(config: RateLimiterConfig): Promise<Ratelimit> {
	// Validate input parameters
	if (config.limit <= 0) {
		throw new Error('Rate limiter limit must be a positive number.');
	}
	if (!config.duration) {
		throw new Error('Rate limiter duration must be specified.');
	}
	if (!config.prefix) {
		throw new Error('Rate limiter prefix must be specified.');
	}

	const cacheKey = `${config.prefix}:${config.limit}:${config.duration}`;

	// Return cached RateLimiter if it exists
	if (rateLimiterCache.has(cacheKey)) {
		return rateLimiterCache.get(cacheKey)!;
	}

	// Create a new RateLimiter instance and cache it
	const rateLimiter = new Ratelimit({
		redis: await getRedisClient(),
		limiter: Ratelimit.slidingWindow(config.limit, config.duration),
		prefix: config.prefix,
	});

	rateLimiterCache.set(cacheKey, rateLimiter);
	logger.debug(`Created new RateLimiter with config: ${cacheKey}`);
	return rateLimiter;
}

/**
 * Checks if a client has exceeded the rate limit.
 * @param rateLimiter - The rate limiter instance.
 * @param key - The unique key to identify the client (e.g., IP address).
 * @returns {Promise<boolean>} - A boolean indicating if the client is rate limited.
 */
export async function isRateLimited(rateLimiter: Ratelimit, key: string): Promise<boolean> {
	if (!key) {
		logger.warn('Rate limiting failed: key is undefined or empty.');
		return false; // Allow the request if the key is invalid
	}

	try {
		const { success, limit, remaining, reset } = await rateLimiter.limit(key);

		const resetDate = reset > 0 ? new Date(reset * 1000).toISOString() : 'Unknown';
		if (!success) {
			logger.warn(
				`Rate limit exceeded for key: ${key}. Limit: ${limit}, Remaining: ${remaining}, Reset: ${resetDate}`
			);
			return true;
		}
		return false;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const errorStack = error instanceof Error ? error.stack : undefined;
		logger.error(`Rate limiting failed for key: ${key}. Error: ${errorMessage}`, {
			stack: errorStack,
		});
		// Allow access by default to prevent blocking legitimate requests if Redis is unavailable
		return false;
	}
}
