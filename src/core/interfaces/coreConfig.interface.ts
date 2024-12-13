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
	alertEmailConfig: EmailConfig;
	contactFormEmailConfig: EmailConfig;
	supabaseConfig: SupabaseConfig;
	adminEmail: string;
	rateLimiterConfig: RateLimiterConfig;
}
