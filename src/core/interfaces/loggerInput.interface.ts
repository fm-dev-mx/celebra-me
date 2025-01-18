// src/core/interfaces/loggerInput.interface.ts

import { BaseLogMeta, ErrorLogMeta } from './logEntry.interface';

export enum LogLevel {
	INFO = 'info',
	DEBUG = 'debug',
	WARN = 'warn',
	ERROR = 'error',
}

/**
 * Represents the minimal input data needed to create a log entry
 * before augmenting with system fields like `timestamp`.
 */
export interface BaseLoggerInput<M = BaseLogMeta> {
	/** The main text message describing the event or action */
	message: string;

	/** The system or module from which this log originates */
	module: string;

	/** Additional data providing context for the log */
	meta?: M;
}

export interface ErrorLoggerInput extends BaseLoggerInput<ErrorLogMeta> {
	level: LogLevel.ERROR;
}

export interface WarnLoggerInput extends BaseLoggerInput {
	level: LogLevel.WARN;
}

export interface InfoLoggerInput extends BaseLoggerInput {
	level: LogLevel.INFO | LogLevel.DEBUG;
}

/** Union type for all accepted logger inputs */
export type LoggerInput =
	| ErrorLoggerInput
	| WarnLoggerInput
	| InfoLoggerInput;
