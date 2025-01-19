// src/core/utilities/errorUtils.ts

/**
 * Safely extracts the error message from an unknown object.
 * @param error - The error object or value.
 * @returns A string representing the error message, or a default message for non-Error values.
 */
export const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error; // Return the string directly if the input is a string
	}
	return 'An unexpected error occurred'; // Default message for non-Error, non-string inputs
};

/**
 * Extracts detailed information about an error, including its message and stack trace.
 * @param error - The error object or value.
 * @returns An object containing the error message and stack trace, if available.
 */
export const extractErrorDetails = (error: unknown): { message: string; stack?: string } => {
	return {
		message: getErrorMessage(error),
		stack: error instanceof Error ? error.stack : undefined, // Include stack trace only for Error instances
	};
};
