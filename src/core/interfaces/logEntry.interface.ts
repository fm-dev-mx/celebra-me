// src/core/interfaces/logEntry.interface.ts

import type { RequestMeta } from './requestMeta.interface';
import type { RawData } from './rawData.interface';
import type { RateLimiterMeta } from './rateLimiter.interface';
import type { EmailData } from './emailData.interface';

/**
 * Standard Winston log levels
 */
export enum LogLevel {
	INFO = 'info',
	DEBUG = 'debug',
	WARN = 'warn',
	ERROR = 'error',
}

/**
 * Base metadata shared across all log types.
 */
export interface BaseLogMeta {
	/** Event type or category (e.g., 'user_login') */
	event: string;

	/** User ID, if applicable */
	userId?: string;

	/** Session ID, if applicable */
	sessionId?: string;

	/** Flag to trigger immediate notifications */
	immediateNotification?: boolean;

	/** HTTP request/response details */
	request?: RequestMeta;

	/** Raw data or payload */
	rawData?: RawData;

	/** Rate-limit details */
	rateLimit?: RateLimiterMeta;

	/** Email details */
	emailData?: EmailData;
}

/**
 * Extended meta interface for error-related logs.
 */
export interface ErrorLogMeta extends BaseLogMeta {
	/** Error message or stack trace */
	error: string;

	/** Error code */
	code?: string;
}

/**
 * Generic shape for log data (no timestamp), used as input to the logger.
 */
export interface LogData<M = BaseLogMeta> {
	/** The Winston log level */
	level: LogLevel;

	/** Main text message describing the event or action */
	message: string;

	/** The system or module from which this log originates */
	module: string;

	/** Additional context for the log (metadata) */
	meta?: M;
}

/**
 * Generic log entry, extending the base LogData with a timestamp
 * to represent how the log is ultimately recorded/stored.
 */
export interface LogEntry<M = BaseLogMeta> extends LogData<M> {
	/**
	 * Must be an ISO 8601 string (e.g., '2025-01-16T12:34:56.000Z').
	 */
	timestamp: string;
}
