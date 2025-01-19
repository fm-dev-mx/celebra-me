// src/infrastructure/clients/redisClientFactory.ts

import { Redis } from '@upstash/redis';
import config from '@/core/config';
import { logError } from '@/backend/services/logger';
import { ConfigurationError } from '@/core/errors/configurationError';
import { ClientFactory } from './clientFactory';

export class RedisClientFactory extends ClientFactory<Redis> {
	protected get MODULE_NAME(): string {
		return 'RedisClientFactory';
	}

	protected async initializeClient(): Promise<Redis> {
		const { url, token } = config.redisConfig;

		if (!url || !token) {
			const errorMessage = 'Missing Redis configuration (URL or TOKEN)';
			logError({
				message: errorMessage,
				meta: { event: 'RedisClientInitialization', error: 'Missing URL or TOKEN' },
				module: this.MODULE_NAME,
			});
			throw new ConfigurationError(errorMessage, this.MODULE_NAME);
		}

		try {
			// No additional logging here; handled by ClientFactory retries.
			const client = new Redis({ url, token });
			return client;
		} catch (error) {
			throw new ConfigurationError('RedisClient Initialization failed', this.MODULE_NAME, error);
		}
	}
}

export default RedisClientFactory;
