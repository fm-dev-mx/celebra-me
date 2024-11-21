// src/backend/middlewares/clientIpMiddleware.ts

import { Handler } from '@/core/types/handlers';
import { getClientIp } from '../utilities/getClientIp';

/**
 * Extends the base context with a clientIp property.
 */
interface ContextWithClientIp {
	request: Request;
	clientIp?: string;
	[key: string]: any; // Allow additional properties
}

/**
 * Middleware to extract and set the client IP address in the context.
 *
 * @param handler - The next handler function to invoke.
 * @returns A handler function that adds the clientIp to the context before proceeding.
 */
export function clientIpMiddleware(handler: Handler): Handler {
	return async (context: ContextWithClientIp): Promise<Response> => {
		try {
			// Extract client IP using the utility function
			const clientIp = getClientIp(context.request);

			if (!clientIp) {
				// Handle cases where IP extraction fails
				throw new Error('Unable to determine client IP address.');
			}

			// Set the extracted IP in the context
			context.clientIp = clientIp;
		} catch (error) {
			// Log the error and proceed
			console.error('Error extracting client IP:', error);
			// Optionally handle the error or rethrow it
		}

		// Proceed to the next handler in the middleware chain
		return handler(context);
	};
}
