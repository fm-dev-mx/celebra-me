// src/backend/middlewares/loggerMiddleware.ts

import { Handler } from '@/core/types/handlers';
import logger from '../utilities/logger';

/**
 * Logger middleware.
 *
 * Logs the details of incoming requests such as method and URL.
 *
 * @param handler - The next handler function to call after logging the request details.
 * @returns A new handler function with logging applied.
 */
export function loggerMiddleware(handler: Handler): Handler {
	return async (context) => {
		const { request } = context;
		const method = request.method;
		const url = request.url;

		// Log the request details
		logger.info(`Incoming request: ${method} ${url} from ${context.clientIp || 'Unknown IP'}`);

		return handler(context);
	};
}
