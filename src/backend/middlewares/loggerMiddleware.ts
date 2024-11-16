// src/backend/middlewares/loggerMiddleware.ts

import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import logger from '../utilities/logger';
import { Handler } from '@/core/types/handlers';

/**
 * Logger middleware.
 *
 * Logs the details of incoming requests such as method, URL, and client IP. This middleware is useful for tracking and monitoring API usage.
 *
 * @param handler - The next handler function to call after logging the request details.
 * @returns A new handler function with logging applied.
 *
 * @example
 * export const POST: Handler = loggerMiddleware(async (context) => {
 *   // Handler code
 * });
 */
export function loggerMiddleware(handler: Handler): Handler {
	return async (context: ContactFormAPIContext) => {
		const { request } = context;
		const method = request.method;
		const url = request.url;

		logger.info(`Incoming request: ${method} ${url} from ${context.clientIp}`);


		return handler(context);
	};
}
