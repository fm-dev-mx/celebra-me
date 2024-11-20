// src/backend/middlewares/errorHandlerMiddleware.ts

import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import logger from '@/backend/utilities/logger';
import { jsonResponse } from '@/core/config/constants';
import { Handler } from '@/core/types/handlers';
import { ApiErrorResponse } from '@/core/interfaces/apiResponse.interface';
import { isApiErrorResponse } from '@/core/guards/isApiResponse';

/**
 * Error handling middleware.
 *
 * Catches unhandled errors in requests, logs them, and sends standardized error responses.
 *
 * @param handler - The next handler function to call.
 * @returns A new handler function with error handling applied.
 */
export function errorHandlerMiddleware(handler: Handler): Handler {
	return async (context: ContactFormAPIContext) => {
		try {
			return await handler(context);
		} catch (error) {
			// Default error response
			let statusCode = 500;
			let errorMessage = 'An internal server error occurred. Please try again later.';
			let errorDetails: string | undefined;

			// Check if the error is of type ApiErrorResponse
			if (isApiErrorResponse(error)) {
				const apiError = error as ApiErrorResponse;
				statusCode = apiError.statusCode || 400;
				errorMessage = apiError.message;
			} else if (error instanceof Error) {
				// For other Error instances, log the stack trace
				errorDetails = error.stack;
			}

			// Log the error uniformly
			logger.error('Unhandled error occurred', {
				error: error instanceof Error ? error.message : String(error),
				stack: errorDetails,
			});

			// Send a standardized error response
			return jsonResponse({ success: false, message: errorMessage }, statusCode);
		}
	};
}
