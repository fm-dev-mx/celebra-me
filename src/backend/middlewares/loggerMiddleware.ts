// src/backend/middlewares/loggerMiddleware.ts

import { Handler } from '@/core/types/handlers';
import logger from '../utilities/logger';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';

/**
 * Logger middleware.
 *
 * Logs the HTTP method, URL, and client IP (if available) for incoming requests.
 *
 * @param handler - The next handler function to call after logging the request details.
 * @returns A new handler function with logging applied.
 */
export function loggerMiddleware(handler: Handler): Handler {
	return async (context: ContactFormAPIContext): Promise<Response> => {
		// Extract necessary details from the context
		const { request, clientIp } = context;
		const method = request.method;
		const url = request.url;

		// Log the request details
		logger.info(`Request: ${method} ${url} | Client IP: ${clientIp || 'Unknown'}`);

		// Call the next handler in the chain
		return handler(context);
	};
}
