// src/core/utilities/apiResponseUtils.ts

import { ApiErrorResponse, ApiSuccessResponse, RateLimitExceededError } from '@/core/interfaces/apiResponse.interface';

/**
 * Creates a standardized error response object.
 *
 * @param statusCode - The HTTP status code.
 * @param message - The error message to return.
 * @param errors - Optional additional error details.
 * @param code - Optional custom error code for identifying error types.
 * @param limit - Optional rate limit value.
 * @param duration - Optional rate limit duration.
 * @returns An ApiErrorResponse or RateLimitExceededError object.
 */
export function createErrorResponse(
	statusCode: number,
	message: string,
	errors?: Record<string, string>,
	code?: string,
	limit?: number,
	duration?: string
): ApiErrorResponse | RateLimitExceededError {
	if (statusCode === 429 && limit !== undefined && duration !== undefined) {
		return {
			success: false,
			statusCode,
			message,
			errors,
			code,
			limit,
			duration,
		};
	}

	return {
		success: false,
		statusCode,
		message,
		errors,
		code,
	};
}

/**
 * Creates a standardized success response object.
 *
 * @param statusCode - The HTTP status code.
 * @param message - A success message.
 * @param data - Optional data to include in the response.
 * @returns An ApiSuccessResponse object.
 */
export function createSuccessResponse<T>(
	statusCode: number,
	message: string,
	data?: T
): ApiSuccessResponse<T> {
	return {
		success: true,
		statusCode,
		message,
		data,
	};
}

/**
 * Helper function to create a JSON Response.
 *
 * @param data - The data to include in the response body.
 * @param status - The HTTP status code (default is 200).
 * @returns A Response object with JSON content type.
 */
export function jsonResponse<T>(data: T, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
