// src/core/interfaces/logEntry.interface.ts

import type { RequestMeta } from './requestMeta.interface';
import type { RawData } from './rawData.interface';
import type { RateLimiterMeta } from './rateLimiter.interface';
import { LogLevel } from './loggerInput.interface';
import { EmailData } from './emailData.interface';

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

	/** Email notification flag (e.g., urgentNotification / notifyByEmail) */
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
 * Generic log entry, allowing specialized meta objects (e.g., ErrorLogMeta).
 */
export interface LogEntry<M = BaseLogMeta> {
	/** The Winston log level */
	level: LogLevel;

	/** The main text message describing the event or action */
	message: string;

	/** The system or module from which this log originates */
	module: string;

	/** Additional data providing context for the log */
	meta?: M; // [Changed: generic to allow specific meta types if needed]

	/**
	 * Timestamp of the log entry.
	 * Must be an ISO 8601 string (e.g., '2025-01-16T12:34:56.000Z').
	 */
	timestamp: string; // [Changed: unified to string for consistency]
}

// Specialized log entries extend the generic with exact meta:
export interface ErrorLogEntry extends LogEntry<ErrorLogMeta> {
	level: LogLevel.ERROR;
}

export interface WarnLogEntry extends LogEntry<BaseLogMeta> {
	level: LogLevel.WARN;
}

export interface InfoLogEntry extends LogEntry<BaseLogMeta> {
	level: LogLevel.INFO | LogLevel.DEBUG;
}
