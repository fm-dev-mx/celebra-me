// src/core/interfaces/apiResponse.interface.ts

/**
 * Interface representing validation errors for form fields.
 */
export interface ValidationErrors {
	[field: string]: string;
}

/**
 * Interface representing a successful API response.
 */
export interface ApiSuccessResponse<T = unknown> {
	success: true;
	statusCode: number;
	message: string;
	data?: T; // Optional data field for success responses
}

/**
 * Interface representing an error API response.
 */
export interface ApiErrorResponse {
	success: false;
	event: string;
	statusCode: number;
	message: string;
	code?: string;
	errors?: ValidationErrors;
	limit?: number;
	duration?: string;
	// In development mode, include error details
	error?: string;
}

/**
 * Union type representing either a success or error API response.
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
