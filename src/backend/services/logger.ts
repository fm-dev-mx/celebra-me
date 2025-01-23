// src/backend/services/logger.ts

import { createLogger, format, transports, Logger } from 'winston';
import { Loggly } from 'winston-loggly-bulk'; // Loggly integration
import config from '@/core/config';
import { sanitizeObject } from '@/backend/utilities/dataSanitization';
import { getNotificationManager } from '@/backend/services/notificationManager';
import {
	LogLevel,
	LogData,
	ErrorLogMeta,
	BaseLogMeta,
	BatchLogMeta,
	LogEntry,
} from '@interfaces/logging/logEntry.interface';
import { getErrorMessage } from '@utilities/errorUtils';

// Initialize notification manager
const notificationManager = getNotificationManager();
const isProduction = config.isProduction;

/**
 * Winston custom format to sanitize sensitive data in 'message' or 'meta' fields.
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
 * Format to detect 'meta.immediateNotification === true' and trigger
 * an immediate notification without overriding the native logger.log().
 */
const criticalNotificationFormat = format((info: any) => {
	if (info.meta?.immediateNotification) {
		sendImmediateNotification(info).catch(() => {
			// Silently ignore to avoid infinite loops
		});
	}
	return info;
});

/**
 * Defines the logger transports based on environment configuration.
 * This function handles different destinations (console, files, Loggly).
 */
function configureTransports() {
	const transportList = [];

	// Console transport: Includes colors for local development
	transportList.push(
		new transports.Console({
			format: format.combine(
				format.colorize(), // Enable colors for console output
				format.printf(({ timestamp, level, message, meta }) => {
					let log = `[${timestamp}] ${level}: ${message}`;
					if (meta && typeof meta === 'object') {
						const metaKeys = Object.keys(meta);
						if (metaKeys.length > 0) {
							log += ` ${JSON.stringify(meta, null, 2)}`;
						}
					}
					return log;
				}),
			),
		}),
	);

	// Loggly transport: Sends JSON logs to Loggly for centralized storage
	if (config.logglyConfig?.token && config.logglyConfig?.subdomain) {
		console.log('Loggly transport enabled ++++++++++++++++++++++++++++++');
		transportList.push(
			new Loggly({
				token: config.logglyConfig.token,
				subdomain: config.logglyConfig.subdomain,
				tags: ['celebra-me', config.environment],
				json: true, // Use pure JSON format
			}),
		);
	}

	return transportList;
}

/**
 * Configures the logger's format pipeline:
 * - Includes stack traces for errors (format.errors).
 * - Enriches log metadata with context (environment, app name, etc.).
 * - Sanitizes sensitive fields in logs.
 * - Detects and triggers immediate notifications if required.
 * - Uses JSON format for production, and colored/pretty format for development.
 */
function configureFormat() {
	const baseFormats = [
		format((info) => {
			if (info.level === LogLevel.ERROR && info.stack) {
				info.message += `\nStack: ${info.stack}`;
			}
			return info;
		})(),
		format.splat(),
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		sanitizeSensitiveData(),
		criticalNotificationFormat(),
	];

	// JSON format for production environments
	if (isProduction) {
		return format.combine(...baseFormats, format.json());
	}

	// Pretty format for local development
	return format.combine(
		...baseFormats,
		format.printf(({ timestamp, level, message, meta }) => {
			let log = `[${timestamp}] ${level}: ${message}`;
			if (meta && typeof meta === 'object') {
				const metaKeys = Object.keys(meta);
				if (metaKeys.length > 0) {
					// Pretty-print meta for easier development readability
					log += ` ${JSON.stringify(meta, null, 2)}`;
				}
			}
			return log;
		}),
	);
}

/**
 * Create the Winston logger instance with specified transports and formats.
 */
const loggerInstance: Logger = createLogger({
	level: config.logging.logLevel || LogLevel.INFO,
	format: configureFormat(),
	transports: configureTransports(),
	exitOnError: false, // Do not exit on handled exceptions
});

/**
 * Generic log function that accepts any LogData (without timestamp).
 * Winston automatically appends the timestamp.
 */
export function log(data: LogData): void {
	loggerInstance.log(data.level, data.message, {
		module: data.module,
		meta: data.meta,
	});
}

/**
 * Wrapper for info-level logs
 */
export function logInfo(data: Omit<LogData<BaseLogMeta>, 'level'>): void {
	log({ ...data, level: LogLevel.INFO });
}

/**
 * Wrapper for error-level logs
 */
export function logError(data: Omit<LogData<ErrorLogMeta>, 'level'>): void {
	log({ ...data, level: LogLevel.ERROR });
}

/**
 * Wrapper for warn-level logs
 */
export function logWarn(data: Omit<LogData<BaseLogMeta>, 'level'>): void {
	log({ ...data, level: LogLevel.WARN });
}

/**
 * Wrapper for batch logs (used for bulk processing logs).
 */
export function logBatch(data: LogData<BatchLogMeta>): void {
	log({ ...data, level: LogLevel.INFO });
}

/**
 * Sends an immediate notification for logs with 'immediateNotification === true'.
 * Prevents spamming by throttling notifications.
 *
 * @param notificationData - The log entry triggering the notification
 */
async function sendImmediateNotification(notificationData: LogEntry): Promise<void> {
	try {
		await notificationManager.sendImmediateNotification({
			level: notificationData.level,
			message: notificationData.message || 'UndefinedMessage',
			module: notificationData.module || 'UnknownModule',
			meta: notificationData.meta || { event: 'UndefinedEvent' },
			timestamp: notificationData.timestamp || new Date().toISOString(),
		});
	} catch (notifyError) {
		// Log the failure without re-triggering an alert
		logError({
			message: 'Failed to send immediate notification.',
			module: notificationData.module,
			meta: {
				event: notificationData.meta?.event || 'notification_failure',
				error: getErrorMessage(notifyError),
				immediateNotification: false,
			},
		});
	}
}

export default loggerInstance;
