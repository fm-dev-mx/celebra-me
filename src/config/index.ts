// src/config/index.ts

const ENVIRONMENT = import.meta.env.NODE_ENV || 'development';

/**
 * Helper function to retrieve and validate environment variables.
 */
function getEnvVariable(key: string): string {
	const value = import.meta.env[key];
	if (!value) {
		throw new Error(`Environment variable ${key} is missing`);
	}
	return value;
}

/**
 * Redis configuration.
 */
const REDIS_CONFIG = {
	url: getEnvVariable('REDIS_URL'),
	token: getEnvVariable('REDIS_TOKEN'),
};

/**
 * Email configuration.
 */
const EMAIL_CONFIG = {
	sendgridApiKey: getEnvVariable('SENDGRID_API_KEY'),
	recipient: getEnvVariable('RECIPIENT_EMAIL'),
	sender: getEnvVariable('SENDER_EMAIL'),
};

export { REDIS_CONFIG, ENVIRONMENT, EMAIL_CONFIG };
