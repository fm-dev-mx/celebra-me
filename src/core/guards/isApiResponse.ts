// src/core/guards/isApiResponse.ts

/**
 * Type Guards for custom types in the project.
 * These functions help ensure runtime type checking where needed.
 */

import { ApiErrorResponse, ApiSuccessResponse } from '../interfaces/apiResponse.interface';

/**
 * Checks if the given object is of type ApiErrorResponse.
 *
 * @param response - The object to check.
 * @returns true if the object is an ApiErrorResponse, false otherwise.
 */
export function isApiErrorResponse(response: any): response is ApiErrorResponse {
	return response?.success === false && typeof response?.message === 'string';
}

/**
 * Checks if the given object is of type ApiSuccessResponse.
 *
 * @param response - The object to check.
 * @returns true if the object is an ApiSuccessResponse, false otherwise.
 */
export function isApiSuccessResponse(response: any): response is ApiSuccessResponse {
	return response?.success === true && typeof response?.message === 'string';
}

// Add more type guards as needed in the future.
// For example:
// export function isAnotherCustomType(obj: any): obj is AnotherCustomType { ... }
