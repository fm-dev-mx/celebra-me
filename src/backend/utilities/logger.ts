// src/backend/utilities/logger.ts

import { createLogger, format, transports, type Logger } from 'winston';
import TransportStream from 'winston-transport';
import config from '@/core/config';
import RedisClient from '@/infrastructure/redisClient';
import type { Redis } from '@upstash/redis';

/**
 * Abstraction for custom log transports.
 */
interface LogTransport {
	getTransport(): Promise<TransportStream>;
}

/**
 * Custom Winston transport to send logs to Redis.
 */
class RedisTransport implements LogTransport {
	private redisClient: Promise<Redis>;

	constructor() {
		// Initialize Redis client synchronously
		this.redisClient = RedisClient.getInstance();
	}

	public async getTransport(): Promise<TransportStream> {
		const redisClient = await RedisClient.getInstance();

		return new TransportStream({
			log: async (info, callback) => {
				try {
					await redisClient.rpush('app-logs', JSON.stringify(info));
					callback();
				} catch (err) {
					console.error('Failed to write log to Redis:', err);
					callback();
				}
			},
		});
	}
}

/**
 * LoggerManager class to encapsulate logger creation and configuration.
 */
class LoggerManager {
	private static instance: Logger;

	/**
	 * Retrieves the singleton instance of the logger.
	 * @returns {Logger} The Winston logger instance.
	 */
	public static async getLogger(): Promise<Logger> {
		if (!LoggerManager.instance) {
			LoggerManager.instance = await LoggerManager.createLogger();
		}
		return LoggerManager.instance;
	}

	/**
	 * Creates and configures the Winston logger.
	 * @returns {Logger} The configured Winston logger.
	 */
	private static async createLogger(): Promise<Logger> {
		const logLevel = process.env.LOG_LEVEL || (config.environment === 'production' ? 'info' : 'debug');

		const loggerTransports: TransportStream[] = [
			// Console transport
			new transports.Console({
				level: logLevel,
				format: format.combine(
					config.environment !== 'production' ? format.colorize() : format.uncolorize(),
					format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
					format.printf(({ timestamp, level, message, ...meta }) => {
						const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
						return `[${timestamp}] ${level}: ${message} ${metaString}`;
					})
				),
			}),
		];

		// Add Redis transport in production
		if (config.environment === 'production') {
			const redisTransport = new RedisTransport();
			const redisTransportInstance = await redisTransport.getTransport();
			loggerTransports.push(redisTransportInstance);
		}

		const logger = createLogger({
			level: logLevel,
			format: format.combine(
				format.errors({ stack: true }),
				format.splat(),
				format.json()
			),
			transports: loggerTransports,
			exitOnError: false, // Prevent logger errors from crashing the application
		});

		return logger;
	}
}

export default LoggerManager.getLogger();

/**
 * Usage Example:
 *
 * import logger from '@/backend/utilities/logger';
 *
 * logger.info('Application started.');
 * logger.error('An error occurred.', new Error('Sample error'));
 *
 * // Configuring log level dynamically:
 * // Set the LOG_LEVEL environment variable to 'debug', 'info', 'warn', or 'error'.
 */
