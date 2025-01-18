// src/backend/services/logger.ts

import { createLogger, format, transports, Logger } from 'winston';
import DatadogWinston from 'datadog-winston';
import config from '@/core/config';
import { sanitizeObject } from '@/backend/utilities/dataSanitization';
import { getNotificationManager } from '@/backend/services/notificationManager';
import { LogEntry } from '@/core/interfaces/logEntry.interface';
import { ErrorLoggerInput, WarnLoggerInput, InfoLoggerInput, LogLevel } from '@/core/interfaces/loggerInput.interface';
import { getErrorMessage } from '@/core/utilities/errorUtils';

// Module identifier for logging
const MODULE_NAME = 'Logger';

// Initialize notification manager
const notificationManager = getNotificationManager();
const isProduction = config.isProduction;

/**
 * Winston custom format for sanitizing sensitive data.
 * It iterates over 'message' and 'meta' fields, removing
 * or masking sensitive information as needed.
 */
const sanitizeSensitiveData = format((info) => {
	['message', 'meta'].forEach((key) => {
		if (info[key] && typeof info[key] === 'object') {
			info[key] = sanitizeObject(info[key]);
		}
	});
	return info;
});

/**
 * Custom format to detect 'meta.immediateNotification === true' and send immediate notifications
 * without overriding the native logger.log() method.
 */
const criticalNotificationFormat = format((info: any) => {
	if (info.meta?.immediateNotification) {
		// Trigger immediate notification if no throttle issues
		sendImmediateNotification(info).catch((error) => {
			// Handle errors silently to avoid infinite loops
		});
	}
	return info;
});

/**
 * Configure the transports for Winston. This includes:
 * - Console transport for all logs.
 * - File transports for development (one for errors, one for combined logs).
 * - Datadog transport for production if API key is set.
 */
function configureTransports() {
	const transportList = [];

	// Console transport (always on)
	transportList.push(new transports.Console());

	// File transports in non-production
	if (!isProduction) {
		transportList.push(
			new transports.File({ filename: 'logs/error.log', level: LogLevel.ERROR }),
			new transports.File({ filename: 'logs/combined.log' })
		);
	}

	// Datadog transport in production
	if (isProduction && config.datadogConfig.apiKey) {
		transportList.push(
			new DatadogWinston({
				apiKey: config.datadogConfig.apiKey,
				hostname: config.datadogConfig.hostname,
				service: config.datadogConfig.serviceName,
				ddsource: 'nodejs',
				ddtags: `env:${config.environment}`,
			})
		);
	}

	return transportList;
}

/**
 * Configure the formatting pipeline:
 * 1. Include error stack traces if present.
 * 2. Splat format to allow string interpolation.
 * 3. Timestamp each log entry.
 * 4. Sanitize any sensitive data (sanitizeSensitiveData()).
 * 5. Check for immediate notifications (criticalNotificationFormat()).
 * 6. Choose between JSON (production) or a colored/pretty format (development).
 */
function configureFormat() {
	const baseFormats = [
		format.errors({ stack: true }),
		format.splat(),
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		sanitizeSensitiveData(),
		criticalNotificationFormat(),
	];

	if (isProduction) {
		return format.combine(...baseFormats, format.json());
	}

	return format.combine(
		...baseFormats,
		format.colorize(),
		format.printf(({ timestamp, level, message, ...meta }) => {
			let log = `[${timestamp}] ${level}: ${message}`;
			const metaKeys = Object.keys(meta);
			if (metaKeys.length > 0) {
				// Pretty-print meta for easier development readability
				log += ` ${JSON.stringify(meta, null, 2)}`;
			}
			return log;
		})
	);
}

/**
 * Create the Winston logger instance with the given transports and format.
 * Note: logLevel must be one of Winston’s default levels: debug, info, warn, error.
 */
const logger: Logger = createLogger({
	level: config.logging.logLevel || LogLevel.INFO, // Default to 'info' if not set
	format: configureFormat(),
	transports: configureTransports(),
	exitOnError: false, // Do not exit on handled exceptions
});

/**
 * Wrapper function to ensure type safety for 'info' logs.
 * Usage: logInfo({ message, module, meta? })
 */
export function logInfo(logData: InfoLoggerInput): void {
	logger.log(LogLevel.INFO, logData.message, {
		module: logData.module,
		meta: logData.meta,
	});
}

/**
 * Wrapper function to ensure type safety for 'error' logs.
 */
export function logError(logData: ErrorLoggerInput): void {
	logger.log(LogLevel.ERROR, logData.message, {
		module: logData.module,
		meta: logData.meta,
	});
}

/**
 * Wrapper function to ensure type safety for 'warn' logs.
 */
export function logWarn(logData: WarnLoggerInput): void {
	logger.log(LogLevel.WARN, logData.message, {
		module: logData.module,
		meta: logData.meta,
	});
}

/**
 * Sends an immediate notification for logs that carry 'immediateNotification === true'.
 * Throttles notifications to avoid spamming.
 *
 * @param logInfo - The log entry triggering the notification
 */
async function sendImmediateNotification(logInfo: LogEntry): Promise<void> {
	try {
		await notificationManager.sendImmediateNotification({
			level: logInfo.level,
			message: logInfo.message || 'UndefinedMessage',
			module: logInfo.module || 'UnknownModule',
			meta: logInfo.meta || { event: 'UndefinedEvent' },
			timestamp: logInfo.timestamp || new Date().toISOString(),
		});
	} catch (notifyError) {
		// If notification fails, log the failure without triggering another notification to avoid loops
		logError({
			message: 'Failed to send immediate notification.',
			module: logInfo.module,
			level: LogLevel.ERROR,
			meta: {
				event: logInfo.meta?.event || 'notification_failure',
				error: getErrorMessage(notifyError),
				immediateNotification: false,
			},
		});
	}
}

export default logger;
