// src/core/utilities/errorUtils.ts

/**
 * Extracts the error message from an unknown object.
 * @param error - The error object.
 * @returns The error message as a string.
 */
export const getErrorMessage = (error: unknown): string => {
	return error instanceof Error ? error.message : String(error);
};

/**
 * Extracts the error details from an unknown object.
 * @param error - The error object.
 * @returns An object with the message and stack trace of the error.
 */
export const extractErrorDetails = (error: unknown) => {
	return {
		message: getErrorMessage(error),
		stack: error instanceof Error ? error.stack : undefined,
	};
};

