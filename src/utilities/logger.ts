// src/utilities/logger.ts

import { createLogger, format, transports } from 'winston';
import path from 'path';

/**
 * Configure Winston logger to write logs to console.
 * This is suitable for serverless environments where writing to filesystem is not supported.
 */
const logger = createLogger({
	level: process.env.NODE_ENV === 'production' ? 'warn' : 'info', // Set log level based on environment
	format: format.combine(
		format.timestamp(),
		format.json(),
		format.prettyPrint()
	),
	transports: [
		new transports.File({
			filename: path.join(process.cwd(), 'logs', 'error.log'),
			level: 'error', // Only log errors in production
		}),
		new transports.File({
			filename: path.join(process.cwd(), 'logs', 'combined.log'),
		}),
	],
});

// Log in console in development
if (process.env.NODE_ENV !== 'production') {
	logger.add(
		new transports.Console({
			format: format.combine(
				format.colorize(),
				format.simple()
			),
		}),
	);
}

export default logger;
