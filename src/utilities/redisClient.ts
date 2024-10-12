// src/utilities/redisClient.ts
import { Redis } from '@upstash/redis';
import logger from '@/utilities/logger';
import { REDIS_CONFIG } from '@/config';  // Configuración centralizada con las variables

// Inicializa el cliente de Redis
if (!REDIS_CONFIG.url || !REDIS_CONFIG.token) {
	logger.error('Missing environment variables REDIS_URL or REDIS_TOKEN');
	throw new Error('Missing environment variables REDIS_URL or REDIS_TOKEN');
}

const redis = new Redis({
	url: REDIS_CONFIG.url,
	token: REDIS_CONFIG.token,
});

export default redis;
