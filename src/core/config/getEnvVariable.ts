// src/core/config/getEnvVariable.ts
import { ConfigurationError } from '@/core/errors/configurationError';

/**
 * Retrieves an environment variable value.
 * Throws a ConfigurationError if the variable is missing in production or Vercel.
*/
export const getEnvVariable = (key: string): string => {
	const MODULE_NAME = 'getEnvVariable';
	const ENVIRONMENT = process.env.NODE_ENV ?? 'development';
	const isVercel = process.env.VERCEL === '1';

	if (!key || typeof key !== 'string') {
		throw new ConfigurationError(
			'Invalid environment variable key. It must be a non-empty string.',
			MODULE_NAME
		);
	}

	const value =
		ENVIRONMENT === 'production' || isVercel
			? process.env[key]
			: import.meta.env[key];

	if (!value) {
		const errorMessage = `Required environment variable "${key}" is missing.`;

		if (ENVIRONMENT !== 'production' && !isVercel) {
			// In development, log a warning for easier troubleshooting
			console.warn(errorMessage);
		} else {
			// In production or Vercel, throw a configuration error
			throw new ConfigurationError(errorMessage, MODULE_NAME);
		}
	}

	return value;
};
