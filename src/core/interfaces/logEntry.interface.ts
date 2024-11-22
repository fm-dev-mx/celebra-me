// src/core/interfaces/logEntry.interface.ts

/**
 * Interface representing a log entry.
 */
export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	meta?: Record<string, unknown>;
}
