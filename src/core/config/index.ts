// src/core/config/index.ts

import type { RedisConfig, EmailConfig, SupabaseConfig, Config } from '../interfaces/coreConfig.interface';
import { getEnvVariable } from './getEnvVariable';

/**
 * Load environment variables from a `.env` file in development.
 * In production, environment variables should be set in the hosting environment.
 */
const isProduction: boolean = getEnvVariable('NODE_ENV') === 'production';

/**
 * Retrieves the Redis configuration.
 * @returns RedisConfig object.
 */
const getRedisConfig = (): RedisConfig => ({
	url: getEnvVariable('REDIS_URL'),
	token: getEnvVariable('REDIS_TOKEN'),
});

/**
 * Retrieves the Email configuration for the contact form.
 * @returns EmailConfig object.
 */
const getContactFormEmailConfig = (): EmailConfig => ({
	sendgridApiKey: getEnvVariable('SENDGRID_API_KEY'),
	recipient: getEnvVariable('CONTACT_FORM_RECIPIENT_EMAIL'),
	sender: getEnvVariable('CONTACT_FORM_SENDER_EMAIL'),
});

/**
 * Retrieves the Email configuration for alerts.
 * @returns EmailConfig object.
 */
const getAlertEmailConfig = (): EmailConfig => ({
	sendgridApiKey: getEnvVariable('SENDGRID_API_KEY'),
	recipient: getEnvVariable('ALERT_RECIPIENT_EMAIL'),
	sender: getEnvVariable('ALERT_SENDER_EMAIL'),
});

/**
 * Retrieves the Supabase configuration.
 * @returns SupabaseConfig object.
 */
const getSupabaseConfig = (): SupabaseConfig => ({
	url: getEnvVariable('SUPABASE_URL'),
	anonKey: getEnvVariable('SUPABASE_ANON_KEY'),
});
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
 * Main configuration object.
 */
const config: Config = {
	environment: process.env.NODE_ENV || 'development',
	isProduction,
	redisConfig: getRedisConfig(),
	contactFormEmailConfig: getContactFormEmailConfig(),
	alertEmailConfig: getAlertEmailConfig(),
	supabaseConfig: getSupabaseConfig(),
	rateLimiterConfig: getRateLimiterConfig(),
	adminEmail: getEnvVariable('ADMIN_EMAIL'),
};

export default config;
