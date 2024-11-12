// src/backend/middlewares/errorHandlerMiddleware.ts

import { APIContext, APIRoute } from 'astro';
import logger from '@/backend/utilities/logger';
import { jsonResponse } from '@/core/config/constants';

/**
 * Error handling middleware.
 *
 * Catches unhandled errors in requests, logs them, and sends standardized error responses.
 *
 * @param handler - The next handler function to call.
 * @returns A new handler function with error handling applied.
 *
 * @example
 * export const POST: APIRoute = errorHandlerMiddleware(async (context) => {
 *   // Handler code
 * });
 */
export function errorHandlerMiddleware(handler: APIRoute): APIRoute {
	return async (context: APIContext) => {
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
