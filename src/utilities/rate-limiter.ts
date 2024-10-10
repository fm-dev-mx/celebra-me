// src/utilities/rate-limiter.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Initialize Upstash Redis client with environment variables.
 */
const redis = new Redis({
	url: import.meta.env.REDIS_URL,    // Your Upstash Redis URL
	token: import.meta.env.REDIS_TOKEN // Your Upstash Redis token
});

/**
 * Create a rate limiter instance.
 * Example: Limit to 5 requests per 15 minutes per unique key.
 */
const rateLimiter = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 requests per 15 minutes
	prefix: 'emailRateLimiter' // Prefix for Redis keys
});

/**
 * Checks if a key has exceeded the rate limit.
 * @param key - The unique key to identify the client (e.g., IP address).
 * @returns {Promise<boolean>} - Returns true if rate limited, false otherwise.
 */
export async function isRateLimited(key: string): Promise<boolean> {
	const { success } = await rateLimiter.limit(key);
	if (!success) {
		console.warn(`Rate limit exceeded for key: ${key}.`);
		return true;
	}
	return false;
}
