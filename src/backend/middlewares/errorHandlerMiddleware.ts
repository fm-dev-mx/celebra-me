// src/backend/middlewares/errorHandlerMiddleware.ts

import { Handler } from '@/core/types/handlers';
import { ApiErrorResponse } from '@/core/interfaces/apiResponse.interface';
import { jsonResponse } from '@/core/utilities/apiResponseUtils';
import logger from '@/backend/utilities/logger';
import { BaseError } from '@/core/errors/baseError';
import { ValidationError } from '@/core/errors/validationError';
import { RateLimitExceededError } from '@/core/errors/rateLimitExceededError';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import config from '@/core/config';
import { maskIpAddress, sanitizeError } from '@/backend/utilities/dataSanitization';

const MODULE_NAME = 'ErrorHandlerMiddleware';
const isProduction: boolean = config.environment === 'production';

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
		} catch (error: unknown) {
			// Map the error to an API response
			const apiError = mapErrorToApiResponse(error);

			// Handle the error (logging, notifications)
			await handleApiError(apiError, context, error);

			// Return the standardized error response
			return jsonResponse(apiError, apiError.statusCode);
		}
	};
}

/**
 * Maps an error object to an ApiErrorResponse.
 *
 * @param error - The error object.
 * @returns The corresponding ApiErrorResponse.
 */
function mapErrorToApiResponse(error: unknown): ApiErrorResponse {
	if (error instanceof BaseError) {
		return {
			success: false,
			statusCode: error.statusCode,
			message: error.message,
			code: error.code,
			...(error instanceof ValidationError && { errors: error.errors }),
			...(error instanceof RateLimitExceededError && {
				limit: error.limit,
				duration: error.duration,
			}),
			...(!isProduction && { error: error.message }),
		};
	} else {
		// For unknown errors
		return {
			success: false,
			statusCode: 500,
			message: 'Internal server error',
			code: 'INTERNAL_SERVER_ERROR',
			...(!isProduction && {
				error: error instanceof Error ? error.message : String(error),
			}),
		};
	}
}

/**
 * Handles the registration and notifications for API errors.
 *
 * @param apiError - The API error response.
 * @param context - The request context.
 * @param error - The original error object.
 */
async function handleApiError(
	apiError: ApiErrorResponse,
	context: ContactFormAPIContext,
	error: unknown
): Promise<void> {
	logError(apiError, context, error);

}

/**
 * Logs errors based on their severity.
 *
 * @param apiError - The API error response.
 * @param context - The request context.
 * @param error - The original error object.
 */
function logError(
	apiError: ApiErrorResponse,
	context: ContactFormAPIContext,
	error: unknown
): void {
	const logLevel = apiError.statusCode >= 500 ? 'error' : 'warn';

	logger.log({
		level: logLevel,
		message: apiError.message,
		meta: {
			event: apiError.code,
			error: sanitizeError(error),
			request: {
				method: context.request.method,
				url: context.request.url,
				clientIp: maskIpAddress(context.clientIp || ''),
			},
		},
		module: MODULE_NAME,
	});
}

