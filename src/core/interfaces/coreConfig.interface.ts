// src/core/interfaces/coreConfig.interface.ts

export interface RedisConfig {
	url: string;
	token: string;
}

export interface EmailConfig {
	sendgridApiKey: string;
	recipient: string;
	sender: string;
}

export interface SupabaseConfig {
	url: string;
	anonKey: string;
}

export interface DatadogConfig {
	apiKey: string;
	hostname: string;
	serviceName: string;
}

/**
 * Winston logLevel must be 'debug' | 'info' | 'warn' | 'error'.
 * "critical" is removed here because it is now a metadata-based concept.
 */
export interface LoggingConfig {
	logLevel: 'debug' | 'info' | 'warn' | 'error';
	scheduledFrequency: 'daily' | 'weekly' | 'monthly';
	maxEmailsPerMinute: number;
	deduplicateCritical: boolean;
	notificationInterval: number;
}

export interface RateLimiterConfig {
	rateLimit: {
		limit: number;
		duration: string;
		prefix: string;
	};
}

export interface Config {
	environment: string;
	redisConfig: RedisConfig;
	contactFormEmailConfig: EmailConfig;
	alertEmailConfig: EmailConfig;
	supabaseConfig: SupabaseConfig;
	datadogConfig: DatadogConfig;
	adminEmail: string;
	isProduction: boolean;
	logging: LoggingConfig;
	rateLimiterConfig: RateLimiterConfig;
}
