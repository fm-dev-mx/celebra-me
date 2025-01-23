// src/backend/jobs/logCronJob.ts

import RedisClientFactory from '@/infrastructure/clients/redisClientFactory';
import { logBatch, logError } from '@/backend/services/logger';
import { LogEntry } from '@interfaces/logging/logEntry.interface';
import { getNotificationManager } from '@/backend/services/notificationManager';
import { getErrorMessage } from '@utilities/errorUtils';
import { LogLevel } from '@interfaces/logging/logEntry.interface';

const MODULE_NAME = 'LogCronJob';
const EVENT_SEND_LOGS = 'send_logs';
const EVENT_PARSE_LOG_ENTRY = 'parse_log_entry';

const notificationManager = getNotificationManager();

/**
 * Sends logs stored in Redis through the NotificationManager as a scheduled summary.
 */
export async function sendLogs(): Promise<void> {
	try {
		const redisClient = new RedisClientFactory();
		const redis = await redisClient.getClient();

		const logEntriesRaw: string[] = await redis.lrange('app-logs', 0, -1);
		logBatch({
			level: LogLevel.INFO,
			message: 'Fetched raw log entries from Redis.',
			module: MODULE_NAME,
			meta: {
				event: EVENT_SEND_LOGS,
				count: logEntriesRaw.length,
				validCount: 0,
				failedCount: 0,
			},
		});

		if (logEntriesRaw.length === 0) {
			logBatch({
				level: LogLevel.INFO,
				message: 'No logs available to send.',
				module: MODULE_NAME,
				meta: {
					event: EVENT_SEND_LOGS,
					count: 0,
					validCount: 0,
					failedCount: 0,
				},
			});
			return;
		}

		const parsedLogs: LogEntry[] = parseLogEntries(logEntriesRaw);
		const failedCount = logEntriesRaw.length - parsedLogs.length;

		logBatch({
			level: LogLevel.INFO,
			message: 'Parsed log entries.',
			module: MODULE_NAME,
			meta: {
				event: EVENT_SEND_LOGS,
				count: logEntriesRaw.length,
				validCount: parsedLogs.length,
				failedCount,
			},
		});

		if (parsedLogs.length === 0) {
			logBatch({
				level: LogLevel.WARN,
				message: 'All log entries failed to parse.',
				module: MODULE_NAME,
				meta: {
					event: EVENT_SEND_LOGS,
					count: logEntriesRaw.length,
					validCount: 0,
					failedCount,
				},
			});
			return;
		}

		try {
			await notificationManager.sendScheduledSummary(parsedLogs);
			logBatch({
				level: LogLevel.INFO,
				message: 'Logs successfully sent (scheduled).',
				module: MODULE_NAME,
				meta: {
					event: EVENT_SEND_LOGS,
					count: logEntriesRaw.length,
					validCount: parsedLogs.length,
					failedCount,
				},
			});
		} catch (sendError) {
			logError({
				message: 'Failed to send scheduled summary.',
				module: MODULE_NAME,
				meta: {
					event: EVENT_SEND_LOGS,
					error: getErrorMessage(sendError),
				},
			});
		}

		await redis.del('app-logs');
		logBatch({
			level: LogLevel.INFO,
			message: 'Logs cleared from Redis.',
			module: MODULE_NAME,
			meta: {
				event: EVENT_SEND_LOGS,
				count: 0,
				validCount: 0,
				failedCount: 0,
			},
		});
	} catch (error: unknown) {
		logError({
			message: 'Error while sending logs.',
			module: MODULE_NAME,
			meta: {
				event: EVENT_SEND_LOGS,
				error: getErrorMessage(error),
			},
		});
	}
}

/**
 * Parses raw log entries into LogEntry objects.
 */
function parseLogEntries(logEntriesRaw: string[]): LogEntry[] {
	return logEntriesRaw
		.map((entry, index) => {
			try {
				return JSON.parse(entry) as LogEntry;
			} catch (error) {
				logError({
					message: 'Failed to parse log entry.',
					module: MODULE_NAME,
					meta: {
						event: EVENT_PARSE_LOG_ENTRY,
						index,
						error: getErrorMessage(error),
					},
				});
				return null;
			}
		})
		.filter((log): log is LogEntry => log !== null);
}

export default sendLogs;
