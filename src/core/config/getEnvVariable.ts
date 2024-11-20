/**
 * Helper function to retrieve environment variables.
 * Throws an error if a variable is missing.
 * @param key - The name of the environment variable.
 * @returns The value of the environment variable.
 */

export const getEnvVariable = (key: string): string => {
	const ENVIRONMENT = process.env.NODE_ENV || 'development';
	const isVercel = process.env.VERCEL === '1';

	const value =
		ENVIRONMENT === 'production' || isVercel
			? process.env[key]
			: import.meta.env[key];

	if (!value) {
		const errorMessage = `Environment variable ${key} is missing.`;
		if (ENVIRONMENT !== 'production' && !isVercel) {
			console.warn(errorMessage);
		} else {
			throw new Error(errorMessage);
		}
	}
	return value!;
};
