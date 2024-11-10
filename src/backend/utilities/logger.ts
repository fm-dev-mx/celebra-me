// src/backend/utilities/logger.ts

import { createLogger, format, transports, type Logger } from 'winston';
import TransportStream from 'winston-transport';
import config from '@/core/config';

/**
 * LoggerManager class to encapsulate logger creation and configuration.
 */
class LoggerManager {
	private static instance: Logger;

	/**
	 * Retrieves the singleton instance of the logger.
	 * @returns {Logger} The Winston logger instance.
	 */
	public static getLogger(): Logger {
		if (!LoggerManager.instance) {
			LoggerManager.instance = LoggerManager.createLogger();
		}
		return LoggerManager.instance;
	}

	/**
	 * Creates and configures the Winston logger.
	 * @returns {Logger} The configured Winston logger.
	 */
	private static createLogger(): Logger {
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

const logger = LoggerManager.getLogger();
export default logger;
