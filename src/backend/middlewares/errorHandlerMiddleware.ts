// src/backend/middlewares/errorHandlerMiddleware.ts

import { Handler } from '@/core/types/api/handlers.type';
import { ApiErrorResponse } from '@/core/interfaces/api/apiResponse.interface';
import { jsonResponse } from '@utilities/apiResponseUtils';
import { logError, logWarn } from '@/backend/services/logger';
import { RequestMeta } from '@interfaces/logging/requestMeta.interface';
import { BaseError } from '@/core/errors/baseError';
import { ValidationError } from '@/core/errors/validationError';
import { RateLimiterError } from '@/core/errors/rateLimiterError';
import { ContactFormAPIContext } from '@interfaces/api/contactFormAPIContext.interface';
import config from '@/core/config';
import { maskIpAddress } from '@/backend/utilities/dataSanitization'; // Removed sanitizeError
import { getErrorMessage } from '@utilities/errorUtils';

const MODULE_NAME = 'ErrorHandlerMiddleware';
const isProduction = config.environment === 'production';

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
			// Map the error to an API response
			const apiError = mapErrorToApiResponse(error);

			// Handle the error (logging, notifications)
			logApiError(apiError, context, error);

			// Return the standardized error response
			return jsonResponse(apiError, apiError.statusCode);
		}
	};
}

/**
 * Maps an error to a standardized API response.
 */
const mapErrorToApiResponse = (error: unknown): ApiErrorResponse => {
	if (error instanceof BaseError) {
		return {
			success: false,
			event: error.name,
			statusCode: error.statusCode,
			message: error.message,
			code: error.code,
			...(error instanceof ValidationError && { errors: error.errors }),
			...(error instanceof RateLimiterError && {
				limit: error.limit,
				duration: error.duration,
			}),
			...(!isProduction && { debug: { message: error.message, stack: error.stack } }),
		};
	}

	// Fallback to a generic error response for unhandled errors
	return {
		success: false,
		event: 'UNKNOWN_ERROR_EVENT',
		statusCode: 500,
		message: 'Internal server error',
		code: 'UNKNOWN_ERROR_CODE',
		...(!isProduction && { debug: { message: getErrorMessage(error) } }),
	};
};

/**
 * Logs API errors with contextual information.
 */
const logApiError = (
	apiError: ApiErrorResponse,
	context: ContactFormAPIContext,
	error: unknown,
): void => {
	const clientIp = maskIpAddress(context.clientIp || '');

	const isCritical = apiError.statusCode >= 500 || error instanceof RateLimiterError;

	// Build the RequestMeta object
	const requestMeta: RequestMeta = {
		requestId: context.request.headers.get('x-request-id') || 'unknown',
		url: context.request.url,
		method: context.request.method,
		clientIp,
	};

	// Determine if immediate notification is needed
	const immediateNotification = isCritical;

	if (isCritical) {
		logError({
			message: apiError.message,
			module: MODULE_NAME,
			meta: {
				event: apiError.event,
				error: getErrorMessage(error),
				code: apiError.code, // Assign error code
				request: requestMeta, // Use separated RequestMeta
				immediateNotification, // Use immediateNotification
			},
		});
	} else {
		logWarn({
			message: apiError.message,
			module: MODULE_NAME,
			meta: {
				event: apiError.code || 'UNKNOWN_ERROR_CODE',
				request: requestMeta, // Use separated RequestMeta
				immediateNotification, // Use immediateNotification
				...(context.user && { userId: context.user.id }),
			},
		});
	}
};
