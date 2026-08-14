// src/env.d.ts

/// <reference types="astro/client" />
/// <reference types="framer-motion" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Astro generates this project type reference.
/// <reference path="../.astro/types.d.ts" />
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
	readonly PUBLIC_GA_MEASUREMENT_ID: string;
	readonly PUBLIC_META_PIXEL_ID: string;
	readonly PUBLIC_META_PIXEL_ENABLED: string;
	readonly META_CAPI_DELIVERY_MODE: string;
	readonly META_CAPI_ACCESS_TOKEN: string;
	readonly META_PIXEL_ID: string;
	readonly META_TEST_EVENT_CODE: string;
	readonly TRUST_DEVICE_SECRET: string;
	readonly TRUST_DEVICE_MAX_AGE_DAYS: string;
	readonly RSVP_CLAIM_CODE_PEPPER: string;
	readonly UPSTASH_REDIS_REST_URL: string;
	readonly UPSTASH_REDIS_REST_TOKEN: string;
	readonly RSVP_V2_DISTRIBUTED_RATELIMIT: string;
	readonly SUPER_ADMIN_EMAILS: string;
	readonly REQUIRE_FRESH_MFA_FOR_ADMIN: string;
	readonly DEV_MFA_BYPASS: string;
	readonly PREVIEW_MFA_BYPASS: string;
	readonly PREVIEW_ADMIN_EMAILS: string;
	/** Local-process runtime target: `local` | `preview`. Never forges Vercel identity. */
	readonly CELEBRA_RUNTIME_TARGET: string;
	/** Optional override for the durable canonical-status cache file. */
	readonly CELEBRA_STATUS_CACHE_PATH: string;
	readonly VERCEL: string;
	readonly VERCEL_ENV: string;
	readonly VERCEL_GIT_COMMIT_REF: string;
	readonly BASE_URL: string;
	readonly INTAKE_TOKEN_ENCRYPTION_KEY: string;
	readonly NODE_ENV: string;
	readonly CONTACT_WHATSAPP: string;
	readonly CLOUDINARY_CLOUD_NAME: string;
	readonly CLOUDINARY_API_KEY: string;
	readonly CLOUDINARY_API_SECRET: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare namespace App {
	interface Locals {
		csrfToken?: string;
		session?: import('@/lib/rsvp/auth/auth').SessionContext;
		hasAdminStrongAuth?: boolean;
	}
}

declare module '*.svg' {
	const content: string;
	export default content;
}
