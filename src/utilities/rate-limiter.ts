// src/utilities/rate-limiter.ts
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';

/**
 * Retrieve and validate Redis environment variables.
 */
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = import.meta.env;

if (!REDIS_HOST || !REDIS_PORT || !REDIS_PASSWORD) {
	throw new Error('Faltan variables de entorno para Redis (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD)');
}

/**
 * Initialize Redis client with error handling and reconnection strategy.
 */
const redisClient = new Redis({
	host: REDIS_HOST,
	port: Number(REDIS_PORT),
	password: REDIS_PASSWORD,
	connectTimeout: 10 * 1000, // 10 seconds for connection attempts
	retryStrategy: (times) => {
		console.log(`Attempting to reconnect to Redis. Attempt number: ${times}`);
		const delay = Math.min(times * 50, 2000); // exponential backoff for connection attempts
		return delay;
	},
});

/**
 * Log any errors related to Redis connection.
 */
redisClient.on('error', (err) => {
	console.error('Redis connection error:', err);
});

/**
 * Keep the Redis connection alive by sending a ping every 60 seconds.
 * This prevents Redis from closing the connection due to inactivity.
 */
setInterval(() => {
	redisClient.ping().catch((err) => {
		console.error('Redis ping error:', err);
	});
}, 60 * 1000);

/**
 * Factory function to create a rate limiter instance with custom options.
 * @param options - Configuration options for the rate limiter.
 * @returns {RateLimiterRedis} - A new instance of RateLimiterRedis.
 */
function createRateLimiter(options: {
	points: number;
	duration: number;
	keyPrefix: string;
}): RateLimiterRedis {
	return new RateLimiterRedis({
		storeClient: redisClient,
		...options,
	});
}

/**
 * Checks if a key has exceeded the rate limit and logs remaining attempts.
 * @param key - The unique key to identify the client (e.g., IP address, user ID).
 * @param rateLimiter - An instance of RateLimiterRedis.
 * @returns {Promise<{ isRateLimited: boolean; remainingPoints: number }>} - Rate limiting status.
 */
export async function isRateLimited(
	key: string,
	rateLimiter: RateLimiterRedis
): Promise<{ isRateLimited: boolean; remainingPoints: number }> {
	try {
		// Consume a point for the given IP / key and retrieve the rate limiter result
		const rateLimiterRes: RateLimiterRes = await rateLimiter.consume(key);

		// Log the remaining points for debugging or monitoring
		console.log(`Remaining points for key ${key}: ${rateLimiterRes.remainingPoints}`);

		// Return information about rate limiting status
		return {
			isRateLimited: false, // IP / key is not rate limited
			remainingPoints: rateLimiterRes.remainingPoints,
		};
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			console.warn(`Rate limit exceeded for key: ${key}. Points remaining: 0`);
			return {
				isRateLimited: true,
				remainingPoints: 0,
			};
		} else {
			console.error('Rate limiter error:', error);
			// Decide how to handle Redis errors; here we allow the request
			return {
				isRateLimited: false,
				remainingPoints: 0,
			};
		}
	}
}

export { createRateLimiter };
