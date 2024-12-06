// src/backend/middlewares/loggerMiddleware.ts

import { Handler } from '@/core/types/handlers';
import logger from '@/backend/utilities/logger';
import { LogEntry } from '@/core/interfaces/logEntry.interface';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import { maskIpAddress } from '@/backend/utilities/dataSanitization';

const MODULE_NAME = 'LoggerMiddleware';

/**
 * Logger middleware.
 *
 * Logs the HTTP method, URL, and masked client IP for incoming requests.
 *
 * @param handler - The next handler function to call after logging the request details.
 * @returns A new handler function with logging applied.
 */
export function loggerMiddleware(handler: Handler): Handler {
	return async (context: ContactFormAPIContext): Promise<Response> => {
		try {
			// Extract necessary details from the context
			const { request, clientIp } = context;
			const method = request.method;
			const url = request.url;

			// Mask the client IP address
			const maskedClientIp = maskIpAddress(clientIp || '');

			// Prepare the log entry
			const logEntry: LogEntry = {
				timestamp: new Date().toISOString(),
				level: 'info',
				message: `Request: ${method} ${url} | Client IP: ${maskedClientIp}`,
				meta: {
					event: 'IncomingRequest',
					method,
					url,
					clientIp: maskedClientIp,
				},
				module: MODULE_NAME,
			};

			// Log the request details
			logger.info(logEntry);
		} catch (error: unknown) {
			// Log the error and proceed
			logger.error({
				message: 'Error in loggerMiddleware',
				meta: {
					error: error instanceof Error ? error.message : String(error),
					event: 'LoggerMiddlewareError',
				},
				module: MODULE_NAME,
			});
		}

		// Call the next handler in the chain
		return handler(context);
	};
}
