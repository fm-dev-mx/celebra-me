// src/backend/middlewares/loggerMiddleware.ts

import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import { getClientIp } from '../utilities/getClientIp';
import logger from '../utilities/logger';

/**
 * Logger middleware.
 *
 * Logs the details of incoming requests such as method, URL, and client IP. This middleware is useful for tracking and monitoring API usage.
 *
 * @param handler - The next handler function to call after logging the request details.
 * @returns A new handler function with logging applied.
 *
 * @example
 * export const POST: APIRoute = loggerMiddleware(async (context) => {
 *   // Handler code
 * });
 */
export function loggerMiddleware(handler: (context: ContactFormAPIContext) => Promise<Response> | Response) {
	return async (context: ContactFormAPIContext) => {
		const { request } = context;
		const method = request.method;
		const url = request.url;
		const clientIp = getClientIp(request) || 'Unknown IP';

		logger.info(`Incoming request: ${method} ${url} from ${clientIp}`);

		// Assign client IP directly to context
		context.clientIp = clientIp;

		return handler(context);
	};
}
