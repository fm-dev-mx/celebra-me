// src/core/interfaces/apiResponse.interface.ts

/**
 * Interface representing validation errors for form fields.
 * Allows multiple error messages per field.
 */
export interface ValidationErrors {
	[field: string]: string[];
}

/**
 * Interface representing a successful API response.
 */
export interface ApiSuccessResponse {
	success: true;
	message: string;
}

/**
 * Interface representing an error API response.
 */
export interface ApiErrorResponse {
	success: false;
	message: string;
	errors?: ValidationErrors;
}

/**
 * Union type representing either a success or error API response.
 */
export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
