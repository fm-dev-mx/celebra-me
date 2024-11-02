// src/config/index.ts

interface RedisConfig {
	url: string;
	token: string;
}

interface EmailConfig {
	sendgridApiKey: string;
	recipient: string;
	sender: string;
}

interface SupabaseConfig {
	url: string;
	anonKey: string;
}

interface Config {
	ENVIRONMENT: string;
	REDIS_CONFIG: RedisConfig;
	EMAIL_CONFIG: EmailConfig;
	SUPABASE_CONFIG: SupabaseConfig;
	ADMIN_EMAIL: string;
}

/**
 * The environment in which the application is running.
 */
const ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * Helper function to retrieve environment variables.
 * Throws an error if a variable is missing.
 * @param key - The name of the environment variable.
 * @returns The value of the environment variable.
 */
const getEnvVariable = (key: string): string => {
	const value =
		ENVIRONMENT === 'production'
			? process.env[key]
			: import.meta.env[key];

	if (!value) {
		const errorMessage = `Environment variable ${key} is missing.`;
		if (ENVIRONMENT !== 'production') {
			console.warn(errorMessage);
		} else {
			throw new Error(errorMessage);
		}
	}
	return value!;
};

/**
 * Configuration object containing required environment variables.
 */
const config: Config = {
	ENVIRONMENT,
	REDIS_CONFIG: {
		url: getEnvVariable('REDIS_URL'),
		token: getEnvVariable('REDIS_TOKEN'),
	},
	EMAIL_CONFIG: {
		sendgridApiKey: getEnvVariable('SENDGRID_API_KEY'),
		recipient: getEnvVariable('RECIPIENT_EMAIL'),
		sender: getEnvVariable('SENDER_EMAIL'),
	},
	SUPABASE_CONFIG: {
		url: getEnvVariable('SUPABASE_URL'),
		anonKey: getEnvVariable('SUPABASE_ANON_KEY'),
	},
	ADMIN_EMAIL: getEnvVariable('ADMIN_EMAIL'),
};

export default config;

