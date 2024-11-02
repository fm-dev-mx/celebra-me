// src/utilities/redisClient.ts

import { Redis } from '@upstash/redis';
import logger from '@/utilities/logger';
import config from '@/core/interfaces/config';

// Initialize the Redis client
if (!config.REDIS_CONFIG.url || !config.REDIS_CONFIG.token) {
	const errorMessage = 'Missing environment variables REDIS_URL or REDIS_TOKEN';
	logger.error(errorMessage);
}

const redis = new Redis({
	url: config.REDIS_CONFIG.url,
	token: config.REDIS_CONFIG.token,
});

export default redis;
