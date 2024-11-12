// src/backend/utilities/logger.ts

import { createLogger, format, transports, type Logger } from 'winston';
import config from '@/core/config';

const logLevel = process.env.LOG_LEVEL || (config.environment === 'production' ? 'info' : 'debug');

const logger: Logger = createLogger({
	level: logLevel,
	format: format.combine(
		config.environment !== 'production' ? format.colorize() : format.uncolorize(),
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		format.printf(({ timestamp, level, message, ...meta }) => {
			const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
			return `[${timestamp}] ${level}: ${message} ${metaString}`;
		})
	),
	transports: [
		new transports.Console(),
	],
	exitOnError: false, // Prevent logger errors from crashing the application
});

export default logger;
