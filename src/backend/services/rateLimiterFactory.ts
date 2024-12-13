// src/backend/services/rateLimiterFactory.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RateLimiterConfig } from '@/core/interfaces/rateLimiter.interface';
import RedisClientFactory from '@/infrastructure/clients/redisClientFactory';
import logger from '@/backend/services/logger';
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';
import { extractErrorDetails, getErrorMessage } from '@/core/utilities/errorUtils';
import { ConfigurationError } from '@/core/errors/configurationError';
import { RateLimiterError } from '@/core/errors/rateLimiterError';
import { UnexpectedError } from '@/core/errors/unexpectedError';

class RateLimiterFactory {
	private static readonly MODULE_NAME = 'RateLimiterFactory';
	private static readonly MAX_RETRIES = 3;

	private redisClient: Redis | null = null;
	private rateLimiterCache = new Map<string, Ratelimit>();

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

	private generateCacheKey(config: RateLimiterConfig): string {
		return `${config.prefix}:${config.limit}:${config.duration}`;
	}

	public async getRateLimiter(config: RateLimiterConfig): Promise<Ratelimit> {
		if (!config.prefix || config.limit <= 0 || !config.duration) {
			const errorMessage = 'Invalid RateLimiter configuration.';
			logger.error({
				message: errorMessage,
				meta: { config },
				module: RateLimiterFactory.MODULE_NAME,
			});
			throw new ConfigurationError(errorMessage, RateLimiterFactory.MODULE_NAME);
		}

		const cacheKey = this.generateCacheKey(config);
		const cachedLimiter = this.rateLimiterCache.get(cacheKey);
		if (cachedLimiter) {
			// Using debug here as it's non-critical info.
			logger.debug({
				message: `Using cached RateLimiter`,
				meta: { config: cacheKey },
				module: RateLimiterFactory.MODULE_NAME,
			});
			return cachedLimiter;
		}

		await this.initializeRedis();

		for (let attempt = 1; attempt <= RateLimiterFactory.MAX_RETRIES; attempt++) {
			try {
				const rateLimiter = new Ratelimit({
					redis: this.redisClient!,
					limiter: Ratelimit.slidingWindow(config.limit, config.duration),
					prefix: config.prefix,
				});

				this.rateLimiterCache.set(cacheKey, rateLimiter);
				logger.info({
					message: `RateLimiter created successfully`,
					meta: { config: cacheKey },
					module: RateLimiterFactory.MODULE_NAME,
				});
				return rateLimiter;

			} catch (error) {
				const { message } = extractErrorDetails(error);
				if (attempt < RateLimiterFactory.MAX_RETRIES) {
					logger.warn({
						message: `Error creating RateLimiter (attempt ${attempt}/${RateLimiterFactory.MAX_RETRIES})`,
						meta: { error: message, config: cacheKey },
						module: RateLimiterFactory.MODULE_NAME,
					});
					const backoff = getExponentialBackoffDelay(attempt, 1000);
					await delay(backoff);
				} else {
					logger.error({
						message: `Failed to create RateLimiter after ${RateLimiterFactory.MAX_RETRIES} attempts`,
						meta: { config: cacheKey, error: message },
						module: RateLimiterFactory.MODULE_NAME,
					});
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

		throw new UnexpectedError(
			'Unexpected error in getRateLimiter.',
			RateLimiterFactory.MODULE_NAME
		);
	}

	public async isRateLimited(config: RateLimiterConfig, key: string, context?: object): Promise<boolean> {
		if (!key) {
			logger.warn({
				message: 'Rate limit check called without a valid key.',
				meta: { event: 'RateLimiterCheck', ...context },
				module: RateLimiterFactory.MODULE_NAME,
			});
			return true;
		}

		try {
			const rateLimiter = await this.getRateLimiter(config);
			const { success } = await rateLimiter.limit(key);

			if (!success) {
				logger.warn({
					message: `Rate limit exceeded`,
					meta: { key, event: 'RateLimiterExceeded', ...context },
					module: RateLimiterFactory.MODULE_NAME,
				});
			} else {
				logger.debug({
					message: `Rate limit check passed`,
					meta: { key, event: 'RateLimiterCheckPassed', ...context },
					module: RateLimiterFactory.MODULE_NAME,
				});
			}

			return !success;
		} catch (error) {
			const message = getErrorMessage(error);
			logger.error({
				message: 'Error during rate limit check.',
				meta: { key, error: message, event: 'RateLimiterError', ...context },
				module: RateLimiterFactory.MODULE_NAME,
			});
			return true;
		}
	}
}

const rateLimiterFactory = new RateLimiterFactory();
export default rateLimiterFactory;
