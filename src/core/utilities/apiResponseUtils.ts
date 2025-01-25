// src/core/utilities/apiResponseUtils.ts

import { ApiSuccessResponse } from '@/core/interfaces/api/apiResponse.interface';

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
	data?: T,
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
