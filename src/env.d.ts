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
	readonly PUBLIC_SUPABASE_URL: string;
	readonly PUBLIC_SUPABASE_ANON_KEY: string;
	readonly PUBLIC_GOOGLE_ANALYTICS_ID: string;
	readonly TRUST_DEVICE_SECRET: string;
	readonly TRUST_DEVICE_MAX_AGE_DAYS: string;
	readonly RSVP_CLAIM_CODE_PEPPER: string;
	readonly UPSTASH_REDIS_REST_URL: string;
	readonly UPSTASH_REDIS_REST_TOKEN: string;
	readonly RSVP_V2_DISTRIBUTED_RATELIMIT: string;
	readonly SUPER_ADMIN_EMAILS: string;
	readonly REQUIRE_FRESH_MFA_FOR_ADMIN: string;
	readonly BASE_URL: string;
	readonly INTAKE_TOKEN_ENCRYPTION_KEY: string;
	readonly NODE_ENV: string;
	readonly CONTACT_WHATSAPP: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare namespace App {
	interface Locals {
		csrfToken?: string;
	}
}
