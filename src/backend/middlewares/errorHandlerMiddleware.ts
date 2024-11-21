// src/backend/middlewares/errorHandlerMiddleware.ts

import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import logger from '@/backend/utilities/logger';
import { jsonResponse } from '@/core/config/constants';
import { Handler } from '@/core/types/handlers';
import { isApiErrorResponse } from '@/core/guards/isApiResponse';

/**
 * Error handling middleware.
 *
 * Catches unhandled errors in requests and sends standardized error responses.
 *
 * @param handler - The next handler function to call.
 * @returns A new handler function with error handling applied.
 */
export function errorHandlerMiddleware(handler: Handler): Handler {
	return async (context: ContactFormAPIContext) => {
		try {
			return await handler(context);
		} catch (error) {
			let statusCode = 500;
			let errorMessage = 'An internal server error occurred. Please try again later.';
			let errors: any;

			if (isApiErrorResponse(error)) {
				// Custom application error
				statusCode = error.statusCode || 400;
				errorMessage = error.message;
				errors = error.errors;
			} else if (error instanceof Error) {
				// Unhandled error, log it
				logger.error('Unhandled error:', {
					message: error.message,
					stack: error.stack,
				});
			} else {
				// Unknown error type
				logger.error('Unknown error type', { error });
			}

			// Send standardized error response
			return jsonResponse({ success: false, message: errorMessage, errors }, statusCode);
		}
	};
}
