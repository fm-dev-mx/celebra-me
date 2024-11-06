// src/infrastructure/redisClient.ts

import { Redis } from '@upstash/redis';
import config from '@/core/config';
import logger from '@/backend/utilities/logger';

/**
 * RedisClient class implementing the Singleton pattern.
 * Manages a single instance of the Redis client for use throughout the application.
 */
class RedisClient {
	private static instance: Redis | null = null;

	/**
	 * Private constructor to prevent direct instantiation.
	 */
	private constructor() {
		// Private to prevent direct instantiation
	}

	/**
	 * Retrieves the singleton instance of the Redis client.
	 * @returns {Redis} The Redis client instance.
	 */
	public static async getInstance(): Promise<Redis> {
		if (!RedisClient.instance) {
			RedisClient.instance = await RedisClient.initializeClient();
		}
		return RedisClient.instance;
	}

	/**
	 * Initializes the Redis client with configurations.
	 * Includes error handling for missing configurations
	 * and a simple retry mechanism for connection issues.
	 * @returns {Redis} The initialized Redis client.
	 */
	private static async initializeClient(): Promise<Redis> {

		const { url, token } = config.redisConfig;
		const maxRetries = 3;
		let attempt = 0;

		if (!url || !token) {
			const errorMessage = 'Missing Redis configuration: REDIS_URL or REDIS_TOKEN';
			logger.error(errorMessage);
			throw new Error(errorMessage);
		}

		while (attempt < maxRetries) {
			try {
				const redis = new Redis({ url, token });
				logger.info('Redis client initialized successfully.');
				return redis;
			} catch (error) {
				attempt++;
				logger.error(`Error initializing Redis client (Attempt ${attempt}/${maxRetries}):`, error);
				if (attempt >= maxRetries) {
					throw error;
				}
				await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
			}
		}

		// Should not reach here
		throw new Error('Failed to initialize Redis client after multiple attempts.');
	}
}

export default RedisClient;
