// src/utilities/redisClient.ts
import { Redis } from '@upstash/redis';
import logger from '@/utilities/logger';
import Config from '@/config/configSingleton';  // Configuración centralizada con las variables

// Inicializa el cliente de Redis
if (!Config.REDIS_CONFIG.url || !Config.REDIS_CONFIG.token) {
	logger.error('Missing environment variables REDIS_URL or REDIS_TOKEN');
	throw new Error('Missing environment variables REDIS_URL or REDIS_TOKEN');
}

const redis = new Redis({
	url: Config.REDIS_CONFIG.url,
	token: Config.REDIS_CONFIG.token,
});

export default redis;
