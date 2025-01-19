// src/backend/services/logger.ts

import { createLogger, format, transports, Logger } from 'winston';
import DatadogWinston from 'datadog-winston';
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
} from '@/core/interfaces/logEntry.interface';
import { getErrorMessage } from '@/core/utilities/errorUtils';

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
 * Define the logger transports based on environment configuration.
 */
function configureTransports() {
	const transportList = [];

	// Console transport (always active)
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
 * Configure the logger's format pipeline:
 *  - Include stack traces (format.errors).
 *  - Splat for printf interpolation.
 *  - Timestamps for each log entry.
 *  - Sanitize data to remove sensitive fields.
 *  - Detect immediate notifications.
 *  - JSON in production, colored/pretty in development.
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
 * Create the Winston logger instance.
 */
const loggerInstance: Logger = createLogger({
	level: config.logging.logLevel || LogLevel.INFO,
	format: configureFormat(),
	transports: configureTransports(),
	exitOnError: false, // Do not exit on handled exceptions
});

/**
 * Generic log function that accepts any LogData (without timestamp).
 * Winston will add the timestamp internally.
 */
export function log(data: LogData): void {
	loggerInstance.log(data.level, data.message, {
		module: data.module,
		meta: data.meta,
	});
}

/**
 * Wrapper for info-level logs
 * (without the need to specify the log level).
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

export function logBatch(data: LogData<BatchLogMeta>): void {
	log({ ...data, level: LogLevel.INFO || LogLevel.WARN });
}

/**
 * Sends an immediate notification for logs that carry 'immediateNotification === true'.
 * Throttles notifications to avoid spamming.
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
		// If notification fails, log the failure without re-triggering
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
