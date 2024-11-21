// src/backend/middlewares/errorHandlerMiddleware.ts

import { Handler } from '@/core/types/handlers';
import { ApiErrorResponse, RateLimitExceededError } from '@/core/interfaces/apiResponse.interface';
import { createErrorResponse, jsonResponse } from '@/core/utilities/apiResponseUtils';

/**
 * Middleware to handle errors thrown by other middleware or handlers.
 *
 * @param handler - The next handler function to invoke.
 * @returns A handler function that catches and handles errors.
 */
export function errorHandlerMiddleware(handler: Handler): Handler {
	return async (context): Promise<Response> => {
		try {
			// Attempt to execute the handler
			return await handler(context);
		} catch (error) {
			// Verify if the error is an ApiErrorResponse
			if (
				typeof error === 'object' &&
				error !== null &&
				(error as ApiErrorResponse).success === false &&
				typeof (error as ApiErrorResponse).statusCode === 'number'
			) {
				const apiError = error as ApiErrorResponse;

				// Log the error based on its status code
				if (apiError.statusCode === 429) {
					const rateLimitError = error as RateLimitExceededError;
					console.warn(`Rate limit exceeded for IP: ${context.clientIp}. Limit: ${rateLimitError.limit}, Duration: ${rateLimitError.duration}`);
				} else {
					console.error('API Error:', apiError);
				}

				// Retornar la respuesta de error estandarizada
				return jsonResponse(apiError, apiError.statusCode);
			}

			// Log unexpected errors as "Unhandled error"
			console.error('Unhandled error:', error);

			// For unexpected errors, return a generic 500 response
			const responseBody = createErrorResponse(500, 'Internal server error');
			return jsonResponse(responseBody, 500);
		}
	};
}
