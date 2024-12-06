// src/core/config/getEnvVariable.ts

/**
 * Helper function to get environment variables.
 * Throws an error if the variable is missing in production or Vercel.
 * @param key - Name of the environment variable.
 * @returns The value of the environment variable.
 * @throws If the environment variable is missing in production or Vercel.
 */
export const getEnvVariable = (key: string): string => {
	const ENVIRONMENT = process.env.NODE_ENV ?? 'development';
	const isVercel = process.env.VERCEL === '1';

	// Validate the key input
	if (!key || typeof key !== 'string') {
		const errorMessage = 'The environment variable key must be a non-empty string.';
		throw new Error(errorMessage);
	}

	// Retrieve the environment variable based on the environment
	const value =
		ENVIRONMENT === 'production' || isVercel
			? process.env[key]
			: import.meta.env[key];

	if (!value) {
		const errorMessage = `Environment variable ${key} is missing.`;

		if (ENVIRONMENT !== 'production' && !isVercel) {
			// In development, log a warning
			console.warn(errorMessage);
		} else {
			// In production or Vercel, throw an error
			throw new Error(errorMessage);
		}
	}

	return value;
};
