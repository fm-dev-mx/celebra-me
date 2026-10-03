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
	/** Server-only PKCS#8 P-256 private key for upload-control requests. */
	readonly MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY: string;
	/** Server-only PKCS#8 P-256 private key for retrieval-control requests. */
	readonly MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY: string;
	/** Server-only origin for the authenticated upload Sign Worker. */
	readonly MEMORIES_PRIVATE_UPLOAD_ORIGIN: string;
	/** Server-only HTTPS origin for the private retrieval Worker. */
	readonly MEMORIES_PRIVATE_RETRIEVAL_ORIGIN: string;
	/** Server-only bearer secret injected by Vercel Cron. */
	readonly CRON_SECRET: string;
	/** Server-only Cloudflare account id for the platform usage console (optional). */
	readonly MEMORIES_CLOUDFLARE_ACCOUNT_ID: string;
	/** Server-only read-only token (Account Analytics: Read) for the usage console (optional). */
	readonly MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN: string;
	/** Server-only R2 bucket name whose usage the console reports (optional). */
	readonly MEMORIES_R2_BUCKET_NAME: string;
	/** Server-only read-only Supabase Management PAT for the platform usage console. */
	readonly SUPABASE_MANAGEMENT_TOKEN: string;
	/** Local-only Preview override of the Management PAT (platform usage diagnostics). */
	readonly SUPABASE_MANAGEMENT_TOKEN_PREVIEW: string;
	/** Local-only Production override of the Management PAT (platform usage diagnostics). */
	readonly SUPABASE_MANAGEMENT_TOKEN_PRODUCTION: string;
	/** Non-secret Supabase project ref of the Preview environment. */
	readonly SUPABASE_PROJECT_REF_PREVIEW: string;
	/** Non-secret Supabase project ref of the Production environment. */
	readonly SUPABASE_PROJECT_REF_PRODUCTION: string;
	/** Server-only read-only Vercel token (billing read) for the platform usage console. */
	readonly VERCEL_API_TOKEN: string;
	/** Non-secret Vercel team id used by the billing usage query. */
	readonly VERCEL_TEAM_ID: string;
	/** Server-only restricted Cloudinary key for the usage report (falls back to the upload key). */
	readonly CLOUDINARY_USAGE_API_KEY: string;
	/** Server-only restricted Cloudinary secret for the usage report. */
	readonly CLOUDINARY_USAGE_API_SECRET: string;
	/** Local-only Preview override of the Cloudflare analytics token. */
	readonly MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW: string;
	/** Local-only Production override of the Cloudflare analytics token. */
	readonly MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION: string;
	/** Local-only Preview override of the R2 bucket name. */
	readonly MEMORIES_R2_BUCKET_NAME_PREVIEW: string;
	/** Local-only Production override of the R2 bucket name. */
	readonly MEMORIES_R2_BUCKET_NAME_PRODUCTION: string;
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
	readonly REQUIRE_FRESH_MFA_FOR_ADMIN: string;
	readonly DEV_MFA_BYPASS: string;
	readonly PREVIEW_MFA_BYPASS: string;
	readonly PREVIEW_ADMIN_EMAILS: string;
	/** Local-process runtime target: `local` | `preview`. Never forges Vercel identity. */
	readonly CELEBRA_RUNTIME_TARGET: string;
	/** Optional override for the durable canonical-status cache file. */
	readonly CELEBRA_STATUS_CACHE_PATH: string;
	readonly VERCEL: string;
	readonly VERCEL_DEPLOYMENT_ID: string;
	readonly VERCEL_ENV: string;
	readonly VERCEL_GIT_COMMIT_SHA: string;
	readonly VERCEL_GIT_COMMIT_REF: string;
	readonly VERCEL_REGION: string;
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
