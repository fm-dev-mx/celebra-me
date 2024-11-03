// src/utilities/logger.ts

import { createLogger, format, transports } from 'winston';
import TransportStream from 'winston-transport';
import config from '@/core/config';
import redis from '@/utilities/redisClient';

/**
 * Custom Winston transport to send logs to Redis.
 */
class RedisTransportStream extends TransportStream {
	private redisClient = redis;

	/**
	 * Initializes the Redis transport.
	 * @param opts - Transport options.
	 */
	constructor(opts: TransportStream.TransportStreamOptions) {
		super(opts);
	}

	/**
	 * Logs the information to Redis.
	 * @param info - Log information.
	 * @param callback - Callback function.
	 */
	log(info: any, callback: () => void): void {
		setImmediate(() => {
			this.emit('logged', info);
		});

		// Convert the log to JSON and push it to the 'app-logs' list in Redis
		this.redisClient
			.rpush('app-logs', JSON.stringify(info))
			.catch((err) => {
				console.error('Failed to write log to Redis:', err);
			});

		callback();
	}
}

/**
 * Winston logger configuration
 * Logs to the console and Redis in production.
 */
const logger = createLogger({
	level: config.ENVIRONMENT === 'production' ? 'info' : 'debug',
	format: format.combine(
		format.timestamp(),
		format.errors({ stack: true }),
		format.splat(),
		format.json()
	),
	transports: [
		// Console transport for both development and production
		new transports.Console({
			format: format.combine(
				config.ENVIRONMENT !== 'production' ? format.colorize() : format.uncolorize(),
				format.simple()
			),
		}),
		// Redis transport only in production
		...(config.ENVIRONMENT === 'production'
			? [new RedisTransportStream({})]
			: []),
	],
});

export default logger;

