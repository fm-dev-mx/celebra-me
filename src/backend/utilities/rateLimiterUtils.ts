// src/backend/utilities/rateLimiterUtils.ts

import { Ratelimit } from '@upstash/ratelimit';
import type { Duration } from '@upstash/ratelimit';
import RedisClient from '@/infrastructure/redisClient';
import logger from '@/backend/utilities/logger';
import { Redis } from '@upstash/redis';

export interface RateLimiterConfig {
	limit: number;
	duration: Duration;
	prefix: string;
}

/**
 * RateLimiterManager class to manage rate limiter instances.
 * Implements a singleton pattern.
 */
class RateLimiterManager {
	private static instance: RateLimiterManager;
	private rateLimiterCache = new Map<string, Ratelimit>();
	private redisClient: Promise<Redis>;

	/**
	 * Private constructor to prevent direct instantiation.
	 */
	private constructor() {
		// Initialize Redis client synchronously
		this.redisClient = RedisClient.getInstance();
	}

	/**
	 * Retrieves the singleton instance of the RateLimiterManager.
	 * @returns {RateLimiterManager} The RateLimiterManager instance.
	 */
	public static getInstance(): RateLimiterManager {
		if (!RateLimiterManager.instance) {
			RateLimiterManager.instance = new RateLimiterManager();
		}
		return RateLimiterManager.instance;
	}

	/**
	 * Generates a unique cache key based on the rate limiter configuration.
	 * @param config - RateLimiter configuration.
	 * @returns {string} - A unique string key.
	 */
	private generateCacheKey(config: RateLimiterConfig): string {
		return `${config.prefix}:${config.limit}:${config.duration}`;
	}

	/**
	 * Creates or retrieves a cached rate limiter instance based on the provided config.
	 * @param config - RateLimiterConfig object.
	 * @returns {Ratelimit} - The cached or new Ratelimit instance.
	 */
	public async getRateLimiter(config: RateLimiterConfig): Promise<Ratelimit> {
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

		const cacheKey = this.generateCacheKey(config);

		// Return cached RateLimiter if it exists
		if (this.rateLimiterCache.has(cacheKey)) {
			return this.rateLimiterCache.get(cacheKey)!;
		}

		// Create a new RateLimiter instance and cache it
		const newRateLimiter = new Ratelimit({
			redis: await this.redisClient,
			limiter: Ratelimit.slidingWindow(config.limit, config.duration),
			prefix: config.prefix,
		});

		this.rateLimiterCache.set(cacheKey, newRateLimiter);
		(await logger).debug(`Created new RateLimiter with config: ${cacheKey}`);
		return newRateLimiter;
	}

	/**
	 * Clears the rate limiter cache. Useful for testing.
	 */
	public async clearCache(): Promise<void> {
		this.rateLimiterCache.clear();
		(await logger).debug('Cleared RateLimiter cache.');
	}
}

/**
 * Checks if a client has exceeded the rate limit.
 * @param rateLimiter - The rate limiter instance.
 * @param key - The unique key to identify the client (e.g., IP address).
 * @returns {Promise<boolean>} - A boolean indicating if the client is rate limited.
 */
export async function isRateLimited(rateLimiter: Ratelimit, key: string): Promise<boolean> {
	if (!key) {
		(await logger).warn('Rate limiting failed: key is undefined or empty.');
		return false; // Allow the request if the key is invalid
	}

	try {
		const { success, limit, remaining, reset } = await rateLimiter.limit(key);

		const resetDate = reset > 0 ? new Date(reset * 1000).toISOString() : 'Unknown';
		if (!success) {
			(await logger).warn(
				`Rate limit exceeded for key: ${key}. Limit: ${limit}, Remaining: ${remaining}, Reset: ${resetDate}`
			);
			return true;
		}
		return false;
	} catch (error) {
		(await logger).error(`Rate limiting failed for key: ${key}. Error: ${error instanceof Error ? error.message : error}`);
		// Allow access by default to prevent blocking legitimate requests if Redis is unavailable
		return false;
	}
}

/**
 * Exports an instance of RateLimiterManager for use in other modules.
 */
export const rateLimiterManager = RateLimiterManager.getInstance();
