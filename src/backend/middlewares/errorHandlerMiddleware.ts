// src/backend/middlewares/errorHandlerMiddleware.ts

import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import logger from '@/backend/utilities/logger';
import { jsonResponse } from '@/core/config/constants';
import { Handler } from '@/core/types/handlers';

/**
 * Error handling middleware.
 *
 * Catches unhandled errors in requests, logs them, and sends standardized error responses.
 *
 * @param handler - The next handler function to call.
 * @returns A new handler function with error handling applied.
 *
 * @example
 * export const POST: Handler = errorHandlerMiddleware(async (context) => {
 *   // Handler code
 * });
 */
export function errorHandlerMiddleware(handler: Handler): Handler {
	return async (context: ContactFormAPIContext) => {
		try {
			return await handler(context);
		} catch (error: unknown) {
			let errorMessage = 'Unknown error';
			let errorStack: string | undefined;

			if (error instanceof Error) {
				errorMessage = error.message;
				errorStack = error.stack;
			} else if (typeof error === 'string') {
				errorMessage = error;
			}

			// Log the error uniformly
			logger.error('Unhandled error occurred', {
				error: errorMessage,
				stack: errorStack,
			});

			// Send a generic error response without exposing sensitive details
			return jsonResponse(
				{ error: 'An internal server error occurred. Please try again later.' },
				500
			);
		}
	};
}
