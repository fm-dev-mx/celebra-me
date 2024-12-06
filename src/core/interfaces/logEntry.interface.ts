// src/core/interfaces/logEntry.interface.ts

/**
 * Log levels used in the application.
 */
export type LogLevel = 'info' | 'debug' | 'warn' | 'error' | 'critical';

/**
 * Interface representing additional metadata for logs.
 */
export interface LogMeta {
	event?: string;
	errorCode?: string;
	userId?: string;
	requestId?: string;
	[key: string]: unknown;
}

/**
 * Interface representing a log entry.
 */
export interface LogEntry {
	timestamp?: string;
	level: LogLevel;
	message: string;
	meta?: LogMeta;
	module: string;
}

/**
 * Interface representing the input provided to logger methods.
 */
export interface LoggerInput {
	message: string;
	meta?: LogMeta;
	module: string;
}
