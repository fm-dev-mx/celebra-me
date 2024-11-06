// src/core/config/index.ts

import type { RedisConfig, EmailConfig, SupabaseConfig, Config } from '../interfaces/coreConfig.interface';
import { getEnvVariable } from './getEnvVariable';

/**
 * Application configuration module.
 * Provides configuration objects for different parts of the application.
 *
 * **Setup Instructions:**
 * - **Development Environment:**
 *   - Ensure environment variables are set in a `.env` file at the root of the project.
 *   - Use tools like `dotenv` to load environment variables.
 * - **Production Environment:**
 *   - Set environment variables in the hosting environment or deployment platform.
 */

/**
 * Retrieves the Redis configuration.
 * @returns RedisConfig object.
 */
const getRedisConfig = (): RedisConfig => ({
	url: getEnvVariable('REDIS_URL'),
	token: getEnvVariable('REDIS_TOKEN'),
});

/**
 * Retrieves the Email configuration.
 * @returns EmailConfig object.
 */
const getEmailConfig = (): EmailConfig => ({
	sendgridApiKey: getEnvVariable('SENDGRID_API_KEY'),
	recipient: getEnvVariable('RECIPIENT_EMAIL'),
	sender: getEnvVariable('SENDER_EMAIL'),
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
 * Main configuration object.
 */
const config: Config = {
	environment: process.env.NODE_ENV || 'development',
	redisConfig: getRedisConfig(),
	emailConfig: getEmailConfig(),
	supabaseConfig: getSupabaseConfig(),
	adminEmail: getEnvVariable('ADMIN_EMAIL'),
};

export default config;
