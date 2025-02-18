// src/core/config/index.ts

import type {
	RedisConfig,
	EmailConfig,
	SupabaseConfig,
	Config,
	LoggingConfig,
} from '@interfaces/config/coreConfig.interface';
import { getEnvVariable } from './getEnvVariable';
import { LogLevel } from '@interfaces/logging/logEntry.interface';
import { ContactData } from '../interfaces/data/contactData.interface';

/**
 * Load environment variables from a `.env` file in development.
 * In production, environment variables should be set in the hosting environment.
 */
const isProduction: boolean = getEnvVariable('NODE_ENV') === 'production';

/**
 * Retrieve Redis configuration.
 */
const getRedisConfig = (): RedisConfig => ({
	url: getEnvVariable('REDIS_URL'),
	token: getEnvVariable('REDIS_TOKEN'),
});

/**
 * Retrieve Email configuration for the contact form.
 */
const getContactFormEmailConfig = (): EmailConfig => ({
	sendgridApiKey: getEnvVariable('SENDGRID_API_KEY'),
	recipient: getEnvVariable('CONTACT_FORM_RECIPIENT_EMAIL'),
	sender: getEnvVariable('CONTACT_FORM_SENDER_EMAIL'),
});

/**
 * Retrieve Email configuration for alerts.
 */
const getAlertEmailConfig = (): EmailConfig => ({
	sendgridApiKey: getEnvVariable('SENDGRID_API_KEY'),
	recipient: getEnvVariable('ALERT_RECIPIENT_EMAIL'),
	sender: getEnvVariable('ALERT_SENDER_EMAIL'),
});

/**
 * Retrieve Supabase configuration.
 */
const getSupabaseConfig = (): SupabaseConfig => ({
	url: getEnvVariable('SUPABASE_URL'),
	anonKey: getEnvVariable('SUPABASE_ANON_KEY'),
});

/**
 * Retrieve Loggly configuration.
 */
const getLogglyConfig = (): { token: string; subdomain: string } => ({
	token: getEnvVariable('LOGGLY_TOKEN'),
	subdomain: getEnvVariable('LOGGLY_SUBDOMAIN') || 'unknown-host',
});

/**
 * Retrieve Logging configuration.
 * "critical" is no longer a valid Winston log level but may
 * still appear in IMMEDIATE_LEVELS for metadata-based triggers.
 */
const validWinstonLogLevels = ['debug', 'info', 'warn', 'error'];

const getLoggingConfig = (): LoggingConfig => {
	const logLevel = getEnvVariable('LOG_LEVEL') || (isProduction ? 'info' : 'debug');

	// Validate the logLevel against Winston defaults
	if (!validWinstonLogLevels.includes(logLevel as LogLevel)) {
		throw new Error(
			`Invalid log level: ${logLevel}. Valid levels: ${validWinstonLogLevels.join(', ')}`,
		);
	}

	return {
		// The cast is safe after validation
		logLevel: logLevel as LoggingConfig['logLevel'],

		scheduledFrequency:
			(getEnvVariable('SCHEDULED_FREQUENCY') as 'daily' | 'weekly' | 'monthly') || 'daily',
		maxEmailsPerMinute: parseInt(getEnvVariable('MAX_EMAILS_PER_MINUTE') || '5', 10),
		deduplicateCritical: getEnvVariable('DEDUPLICATE_CRITICAL') === 'true',
		notificationInterval: parseInt(getEnvVariable('NOTIFICATION_INTERVAL') || '60', 10),
	};
};

/**
 * Retrieve rate limiter configuration.
 */
const getRateLimiterConfig = () => ({
	rateLimit: {
		limit: parseInt(getEnvVariable('RATE_LIMIT') || '100', 10),
		duration: getEnvVariable('RATE_LIMIT_DURATION') || '15m',
		prefix: getEnvVariable('RATE_LIMIT_PREFIX') || 'rateLimiter',
	},
});

/**
 * Retrieve the contact data for clients
 */
const getContactData = (): ContactData => ({
	email: getEnvVariable('CONTACT_EMAIL'),
	contactType: getEnvVariable('CONTACT_TYPE'),
	phoneNumber: getEnvVariable('CONTACT_PHONE'),
	address: {
		city: getEnvVariable('CONTACT_CITY'),
		state: getEnvVariable('CONTACT_STATE'),
		zipCode: getEnvVariable('CONTACT_ZIP'),
		country: getEnvVariable('CONTACT_COUNTRY'),
	},
});

/**
 * Main configuration object.
 */
const config: Config = {
	environment: process.env.NODE_ENV || 'development',
	isProduction,
	redisConfig: getRedisConfig(),
	contactFormEmailConfig: getContactFormEmailConfig(),
	alertEmailConfig: getAlertEmailConfig(),
	supabaseConfig: getSupabaseConfig(),
	logglyConfig: getLogglyConfig(),
	logging: getLoggingConfig(),
	rateLimiterConfig: getRateLimiterConfig(),
	adminEmail: getEnvVariable('ADMIN_EMAIL'),
	contactData: getContactData(),
};

export default config;
