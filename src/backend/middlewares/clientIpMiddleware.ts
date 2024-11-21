// src/backend/middlewares/clientIpMiddleware.ts

import { Handler } from '@/core/types/handlers';
import { getClientIp } from '../utilities/getClientIp';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';

/**
 * Middleware to extract and set the client IP in context.
 *
 * @param handler - The next handler function to call.
 * @returns A new handler function with client IP set in context.
 */
export function clientIpMiddleware(handler: Handler): Handler {
	return async (context: ContactFormAPIContext) => {
		context.clientIp = getClientIp(context.request);

		// Removed logging to keep middleware focused on its primary task

		return handler(context);
	};
}
