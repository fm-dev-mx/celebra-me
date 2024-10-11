// src/utilities/rateLimiter.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Validate the required environment variables before proceeding.
 * Throws an error if any of the variables are missing.
 */
const { REDIS_URL, REDIS_TOKEN } = import.meta.env;

if (!REDIS_URL || !REDIS_TOKEN) {
	throw new Error('Missing environment variables REDIS_URL or REDIS_TOKEN');
}

/**
 * Initialize Upstash Redis client with environment variables.
 */
const redis = new Redis({
	url: REDIS_URL,    // Your Upstash Redis URL
	token: REDIS_TOKEN // Your Upstash Redis token
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
	try {
		const { success } = await rateLimiter.limit(key);
		if (!success) {
			console.warn(`Rate limit exceeded for key: ${key}. Please try again later.`);
			return true;
		}
		return false;
	}
	catch (error: unknown) {
		// Log the error for debugging purposes
		if (error instanceof Error) {
			console.error(`Rate limiting failed for key: ${key}. Error: ${error.message}`);
		} else {
			console.error(`Rate limiting failed for key: ${key}. Unknown error: ${error}`);
		}
		// Block access by default to prevent abuse if Redis is unavailable
		return true;
	}
}
