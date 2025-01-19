// src/backend/services/rateLimiterFactory.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import RedisClientFactory from '@/infrastructure/clients/redisClientFactory';
import { logError, logInfo, logWarn } from '@/backend/services/logger';
import {
	LogLevel,
	ErrorLoggerInput,
	InfoLoggerInput,
	WarnLoggerInput,
} from '@/core/interfaces/loggerInput.interface';
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';
import {
	extractErrorDetails,
	getErrorMessage,
} from '@/core/utilities/errorUtils';
import { ConfigurationError } from '@/core/errors/configurationError';
import { RateLimiterError } from '@/core/errors/rateLimiterError';
import { UnexpectedError } from '@/core/errors/unexpectedError';

/**
 * Factory class to create and manage rate limiters using Upstash/Redis.
 */
class RateLimiterFactory {
	private static readonly MODULE_NAME = 'RateLimiterFactory';
	private static readonly MAX_RETRIES = 3;

	private redisClient: Redis | null = null;
	private rateLimiterCache = new Map<string, Ratelimit>();

	/**
	 * Initializes a Redis client if not already present.
	 * Throws a ConfigurationError if Redis client creation fails.
	 */
	private async initializeRedis(): Promise<void> {
		if (!this.redisClient) {
			try {
				const redisClientFactory = new RedisClientFactory();
				this.redisClient = await redisClientFactory.getClient();
			} catch (error) {
				throw new ConfigurationError(
					'Failed to initialize Redis client.',
					RateLimiterFactory.MODULE_NAME,
					error
				);
			}
		}
	}

	/**
	 * Generates a unique cache key based on the RateLimiterConfig.
	 *
	 * @param config - Configuration object for rate limiting (limit, duration, prefix)
	 * @returns A string used as the cache key
	 */
	private generateCacheKey(config: RateLimiterConfig): string {
		return `${config.prefix}:${config.limit}:${config.duration}`;
	}

	/**
	 * Retrieves a Ratelimit instance based on the provided config.
	 * If a cached instance is found, it returns that immediately.
	 * Otherwise, it creates a new instance, caches it, and returns it.
	 *
	 * @param config - Rate limiter configuration (limit, duration, prefix)
	 * @returns A Ratelimit object
	 * @throws ConfigurationError if the config is invalid
	 * @throws RateLimiterError if Ratelimit creation fails after retries
	 * @throws UnexpectedError for any other unhandled errors
	 */
	public async getRateLimiter(config: RateLimiterConfig): Promise<Ratelimit> {
		if (!config.prefix || config.limit <= 0 || !config.duration) {
			const errorMessage = 'Invalid RateLimiter configuration.';
			throw new ConfigurationError(
				errorMessage,
				RateLimiterFactory.MODULE_NAME
			);
		}

		const cacheKey = this.generateCacheKey(config);
		const cachedLimiter = this.rateLimiterCache.get(cacheKey);

		if (cachedLimiter) {
			const infoLog: InfoLoggerInput = {
				message: `Using cached RateLimiter: ${cacheKey}`,
				module: RateLimiterFactory.MODULE_NAME,
				level: LogLevel.INFO, // Set to INFO
				meta: {
					event: 'rateLimiter_cached',
					immediateNotification: false, // No immediate notification for cached usage
					rateLimit: {
						rateLimiterKey: cacheKey,
						rateLimiterConfig: config,
						rateLimiterStatus: {
							exceeded: false,
							remaining: config.limit,
						},
					},
				},
			}
			logInfo(infoLog);
			return cachedLimiter;
		}

		await this.initializeRedis();

		for (let attempt = 1; attempt <= RateLimiterFactory.MAX_RETRIES; attempt++) {
			try {
				const rateLimiter = new Ratelimit({
					redis: this.redisClient!,
					limiter: Ratelimit.slidingWindow(config.limit, config.duration),
					prefix: config.prefix,
				})

				this.rateLimiterCache.set(cacheKey, rateLimiter);

				const infoLog: InfoLoggerInput = {
					message: `RateLimiter created successfully: ${cacheKey}`,
					module: RateLimiterFactory.MODULE_NAME,
					level: LogLevel.INFO, // Set to INFO
					meta: {
						event: 'rateLimiter_created',
						immediateNotification: false, // No immediate notification for successful creation
						rateLimit: {
							rateLimiterKey: cacheKey,
							rateLimiterConfig: config,
							rateLimiterStatus: {
								exceeded: false,
								remaining: config.limit,
							},
						},
					},
				}
				logInfo(infoLog);

				return rateLimiter;
			} catch (error) {
				const { message } = extractErrorDetails(error);

				if (attempt < RateLimiterFactory.MAX_RETRIES) {
					// Apply an exponential backoff before retrying
					const backoff = getExponentialBackoffDelay(attempt, 1000);
					await delay(backoff);
				} else {
					// Log an error and throw a RateLimiterError if we've exhausted retries
					const errorLog: ErrorLoggerInput = {
						message: `Failed to create RateLimiter after ${RateLimiterFactory.MAX_RETRIES} attempts: ${cacheKey}`,
						module: RateLimiterFactory.MODULE_NAME,
						level: LogLevel.ERROR, // Set to ERROR
						meta: {
							event: 'rateLimiter_creation_failed',
							error: message,
							immediateNotification: true, // Immediate notification for critical failures
							rateLimit: {
								rateLimiterKey: cacheKey,
								rateLimiterConfig: config,
								// Optional: rateLimitStatus can be included if relevant
							},
						},
					};
					logError(errorLog);

					throw new RateLimiterError(
						`Failed to create RateLimiter after ${RateLimiterFactory.MAX_RETRIES} attempts`,
						config.limit,
						config.duration,
						RateLimiterFactory.MODULE_NAME,
						error
					);
				}
			}
		}

		// Log and throw an UnexpectedError if we somehow reach here
		const unexpectedErrorLog: ErrorLoggerInput = {
			message: 'Unexpected error in getRateLimiter.',
			module: RateLimiterFactory.MODULE_NAME,
			level: LogLevel.ERROR, // Set to ERROR
			meta: {
				event: 'rateLimiter_unexpected_error',
				error: 'Unexpected error in getRateLimiter.',
				immediateNotification: true, // Immediate notification for unexpected errors
				rateLimit: {
					rateLimiterKey: 'N/A',
					rateLimiterConfig: config,
				},
			},
		}
		logError(unexpectedErrorLog);

		throw new UnexpectedError(
			'Unexpected error in getRateLimiter.',
			RateLimiterFactory.MODULE_NAME
		)
	}

	/**
	 * Checks whether the given key is rate-limited under the specified config.
	 * Returns true if rate-limited, or if an invalid key is provided.
	 *
	 * @param config - Rate limiter configuration
	 * @param key - Unique key used to identify the client/action
	 * @param url - (Optional) URL for contextual logging
	 * @param method - (Optional) HTTP method for contextual logging
	 * @returns A boolean indicating if the action is rate-limited
	 */
	public async isRateLimited(
		config: RateLimiterConfig,
		key: string,
		url: string,
		method: string
	): Promise<boolean> {
		// If no key is provided, consider it rate-limited and log a warning
		if (!key) {
			const warnLog: WarnLoggerInput = {
				message: 'Rate limit check called without a valid key.',
				module: RateLimiterFactory.MODULE_NAME,
				level: LogLevel.WARN, // Set to WARN
				meta: {
					event: 'RateLimiterCheck_invalid_key',
					request: {
						method: method || 'N/A',
						url: url || 'N/A',
						clientIp: 'N/A', // Provide client IP if available
					},
					immediateNotification: false, // No immediate notification for warnings
				},
			};
			logWarn(warnLog);
			return true;
		}

		const cacheKey = this.generateCacheKey(config);
		try {
			const rateLimiter = await this.getRateLimiter(config);
			const { success } = await rateLimiter.limit(key);

			// If success is false, it means we're rate-limited
			return !success;
		} catch (error) {
			// Log any errors that occur during rate limit check
			const message = getErrorMessage(error);
			const errorLog: ErrorLoggerInput = {
				message: `Error during rate limit check. Key: ${key}`,
				module: RateLimiterFactory.MODULE_NAME,
				level: LogLevel.ERROR, // Set to ERROR
				meta: {
					event: 'RateLimiterError',
					error: message,
					immediateNotification: true, // Immediate notification for critical errors
					request: {
						method: method || 'N/A',
						url: url || 'N/A',
						clientIp: key || 'N/A', // Assuming 'key' represents 'clientIp'
					},
					rateLimit: {
						rateLimiterKey: cacheKey || 'N/A',
						rateLimiterConfig: config,
						// Optional: rateLimitStatus can be included if relevant
					},
				},
			};
			logError(errorLog);

			// If an error occurs, treat it as rate-limited to be safe
			return true;
		}
	}
}

const rateLimiterFactory = new RateLimiterFactory();
export default rateLimiterFactory;
