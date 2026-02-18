// src/env.d.ts

/// <reference types="astro/client" />
/// <reference types="framer-motion" />
// reference path="../.astro/types.d.ts"
/// <reference types="astro/content" />

interface ImportMetaEnv {
	readonly SUPABASE_URL: string;
	readonly SUPABASE_ANON_KEY: string;
	readonly SUPABASE_SERVICE_ROLE_KEY: string;
	readonly GMAIL_USER: string;
	readonly GMAIL_PASS: string;
	readonly CONTACT_FORM_RECIPIENT_EMAIL: string;
	readonly RSVP_TOKEN_SECRET: string;
	readonly RSVP_ADMIN_USER: string;
	readonly RSVP_ADMIN_PASSWORD: string;
	readonly PUBLIC_SUPABASE_URL: string;
	readonly PUBLIC_SUPABASE_ANON_KEY: string;
	readonly TRUST_DEVICE_SECRET: string;
	readonly TRUST_DEVICE_MAX_AGE_DAYS: string;
	readonly RSVP_CLAIM_CODE_PEPPER: string;
	readonly UPSTASH_REDIS_REST_URL: string;
	readonly UPSTASH_REDIS_REST_TOKEN: string;
	readonly RSVP_V2_DISTRIBUTED_RATELIMIT: string;
	readonly SUPER_ADMIN_EMAILS: string;
	readonly SENDGRID_API_KEY: string;
	readonly SENTRY_DSN: string;
	readonly SENTRY_AUTH_TOKEN: string;
	readonly ENABLE_MFA: string;
	readonly ENABLE_AUDIT_LOGS: string;
	readonly BASE_URL: string;
	readonly NODE_ENV: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare namespace App {
	interface Locals {
		csrfToken?: string;
	}
}
