// src/backend/utilities/rateLimiterUtils.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import RedisClientFactory from '@/infrastructure/redisClient';
import logger from '@/backend/utilities/logger';
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';

/**
 * RateLimiterFactory class implementing the Factory Pattern.
 * Manages the creation and retrieval of Ratelimit instances based on configurations.
 */
class RateLimiterFactory {
	private redisClient: Redis | null = null;
	private rateLimiterCache = new Map<string, Ratelimit>();
	private readonly MODULE_NAME = 'RateLimiterFactory';
	private readonly MAX_RETRIES = 3;

	/**
	 * Initializes the Redis client if not already initialized.
	 */
	private async initializeRedis(): Promise<void> {
		if (!this.redisClient) {
			try {
				this.redisClient = await RedisClientFactory.getClient();
				logger.info({
					message: 'Redis client initialized successfully in RateLimiterFactory.',
					meta: { event: 'RedisInitialization' },
					module: this.MODULE_NAME,
				});
			} catch (error) {
				logger.error({
					message: 'Failed to initialize Redis client in RateLimiterFactory.',
					meta: {
						error: error instanceof Error ? error.message : String(error),
						event: 'RedisInitialization',
					},
					module: this.MODULE_NAME,
				});
				throw error;
			}
		}
	}

	/**
	 * Generates a unique cache key based on the rate limiter configuration.
	 * @param config - The rate limiter configuration.
	 * @returns A string representing the cache key.
	 */
	private generateCacheKey(config: RateLimiterConfig): string {
		return `${config.prefix}:${config.limit}:${config.duration}`;
	}

	/**
	 * Retrieves an existing Ratelimit instance or creates a new one based on the configuration.
	 * Implements retry logic with exponential backoff in case of failures.
	 * @param config - The rate limiter configuration.
	 * @returns A Promise resolving to a Ratelimit instance.
	 */
	public async getRateLimiter(config: RateLimiterConfig): Promise<Ratelimit> {
		// Validate configuration
		if (config.limit <= 0 || !config.duration || !config.prefix) {
			const errorMessage = 'Invalid RateLimiter configuration.';
			logger.error({
				message: errorMessage,
				meta: { config },
				module: this.MODULE_NAME,
			});
			throw new Error(errorMessage);
		}

		const cacheKey = this.generateCacheKey(config);

		// Return cached RateLimiter if exists
		if (this.rateLimiterCache.has(cacheKey)) {
			logger.debug({
				message: `Using cached RateLimiter for config: ${cacheKey}`,
				meta: { config },
				module: this.MODULE_NAME,
			});
			return this.rateLimiterCache.get(cacheKey)!;
		}

		// Initialize Redis client
		await this.initializeRedis();

		// Attempt to create RateLimiter with retry logic
		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				const rateLimiter = new Ratelimit({
					redis: this.redisClient!,
					limiter: Ratelimit.slidingWindow(config.limit, config.duration),
					prefix: config.prefix,
				});

				this.rateLimiterCache.set(cacheKey, rateLimiter);
				logger.info({
					message: `RateLimiter created successfully for config: ${cacheKey}`,
					meta: { config },
					module: this.MODULE_NAME,
				});

				return rateLimiter;
			} catch (error) {
				logger.error({
					message: `Error creating RateLimiter (Attempt ${attempt}/${this.MAX_RETRIES}) for config: ${cacheKey}`,
					meta: {
						error: error instanceof Error ? error.message : String(error),
						config,
						attempt,
					},
					module: this.MODULE_NAME,
				});

				if (attempt === this.MAX_RETRIES) {
					logger.error({
						level: 'critical',
						message: `Failed to create RateLimiter after ${this.MAX_RETRIES} attempts for config: ${cacheKey}`,
						meta: { config, attempts: attempt },
						module: this.MODULE_NAME,
					});
					throw error instanceof Error ? error : new Error(String(error));
				}

				// Exponential backoff with jitter
				const backoff = getExponentialBackoffDelay(attempt, 1000);
				await delay(backoff);
			}
		}

		// This point should not be reachable
		throw new Error('Unexpected error in RateLimiterFactory.getRateLimiter.');
	}

	/**
	 * Determines whether a client has exceeded the rate limit.
	 *
	 * @param config - Configuration for the rate limiter.
	 * @param key - The unique identifier for the client (e.g., IP address).
	 * @param context - Additional context for logging (e.g., route, method).
	 * @returns True if the client is rate limited, otherwise false.
	 */
	public async isRateLimited(config: RateLimiterConfig, key: string, context?: object): Promise<boolean> {
		if (!key) {
			logger.warn({
				message: 'Rate limiting check called without a valid key.',
				meta: {
					event: 'RateLimiterCheck',
					...context,
				},
				module: this.MODULE_NAME,
			});
			return true;
		}

		try {
			const rateLimiter = await this.getRateLimiter(config);
			const { success } = await rateLimiter.limit(key);

			if (!success) {
				logger.warn({
					message: `Rate limit exceeded for key: ${key}`,
					meta: {
						key,
						event: 'RateLimiterExceeded',
						...context,
					},
					module: this.MODULE_NAME,
				});
			} else {
				logger.debug({
					message: `Rate limit check passed for key: ${key}`,
					meta: {
						key,
						event: 'RateLimiterCheckPassed',
						...context,
					},
					module: this.MODULE_NAME,
				});
			}

			return !success;
		} catch (error) {
			logger.error({
				message: 'Error during rate limit check.',
				meta: {
					key,
					error: error instanceof Error ? error.message : String(error),
					event: 'RateLimiterError',
					...context,
				},
				module: this.MODULE_NAME,
			});
			// Fail closed: Treat as rate limited to maintain safety
			return true;
		}
	}
}

// Export a singleton instance of the RateLimiterFactory
const rateLimiterFactory = new RateLimiterFactory();
export default rateLimiterFactory;
