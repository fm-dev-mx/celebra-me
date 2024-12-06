// src/infrastructure/redisClient.ts

import { Redis } from '@upstash/redis';
import config from '@/core/config';
import logger from '@/backend/utilities/logger';
import { ClientFactory } from '@/infrastructure/clientFactory'
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';

export class RedisClientFactory extends ClientFactory<Redis> {
	protected static readonly MODULE_NAME = 'RedisClientFactory';

	protected static async initializeClient(): Promise<Redis> {
		const { url, token } = config.redisConfig;

		// Validate configuration
		if (!url || !token) {
			const errorMessage = 'Missing Redis configuration: REDIS_URL or REDIS_TOKEN';
			logger.error({
				message: errorMessage,
				meta: { event: 'RedisClientInitialization', missingConfig: { url } },
				module: this.MODULE_NAME,
			});
			throw new Error(errorMessage);
		}

		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				const client = new Redis({ url, token });

				logger.info({
					message: 'Redis client initialized successfully.',
					meta: { event: 'RedisClientInitialization' },
					module: this.MODULE_NAME,
				});

				return client;
			} catch (error) {
				logger.error({
					message: `Error initializing Redis client (Attempt ${attempt}/${this.MAX_RETRIES}): ${error instanceof Error ? error.message : String(error)}`,
					meta: {
						event: 'RedisClientInitialization',
						stack: error instanceof Error ? error.stack : undefined,
					},
					module: this.MODULE_NAME,
				});

				if (attempt === this.MAX_RETRIES) {
					logger.log({
						level: 'critical',
						message: 'Failed to initialize Redis client after multiple attempts.',
						meta: {
							event: 'RedisClientInitialization',
							attempts: attempt,
							error: error instanceof Error ? error.message : String(error),
						},
						module: this.MODULE_NAME,
					});
					// Do not throw to prevent application crash; return null or handle accordingly
					return Promise.reject(new Error('RedisClient Initialization failed'));
				}

				// Exponential backoff with jitter
				const backoff = getExponentialBackoffDelay(attempt, 1000);
				await delay(backoff);
			}
		}

		return Promise.reject(new Error('RedisClient Initialization failed'));
	}
}

export default RedisClientFactory;
