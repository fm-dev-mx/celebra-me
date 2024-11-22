// src/core/config/getEnvVariable.ts

import logger from '@/backend/utilities/logger';

/**
 * Helper function to get environment variables.
 * Throws an error if the variable is missing in production or Vercel.
 * @param key - Name of the environment variable.
 * @returns The value of the environment variable.
 */
export const getEnvVariable = (key: string): string => {
	const ENVIRONMENT = process.env.NODE_ENV ?? 'development';
	const isVercel = process.env.VERCEL === '1';

	const value = process.env[key] =
		ENVIRONMENT === 'production' || isVercel
			? process.env[key]
			: import.meta.env[key];

	if (!value) {
		const errorMessage = `Environment variable ${key} is missing.`;
		if (ENVIRONMENT !== 'production' && !isVercel) {
			// Use logger and warn in development
			logger.warn(errorMessage, { event: 'MissingEnvVariable', variable: key });
		} else {
			// Use logger and throw an error in production or Vercel
			logger.error(errorMessage, { event: 'MissingEnvVariable', variable: key });
			throw new Error(errorMessage);
		}
	}

	return value;
};
