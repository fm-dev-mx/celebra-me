/**
 * Server-only environment variable names for the platform usage console.
 * Values are owned by Vercel (see docs/env-workflow.md); this module never
 * reads secrets itself. Deliberately not named `CLOUDFLARE_*`: Wrangler would
 * pick those up as deploy credentials.
 */

export const PLATFORM_ENV = {
	cloudflareAccountId: 'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	cloudflareAnalyticsToken: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	r2BucketName: 'MEMORIES_R2_BUCKET_NAME',
	supabaseManagementToken: 'SUPABASE_MANAGEMENT_TOKEN',
	supabaseProjectRefPreview: 'SUPABASE_PROJECT_REF_PREVIEW',
	supabaseProjectRefProduction: 'SUPABASE_PROJECT_REF_PRODUCTION',
	vercelApiToken: 'VERCEL_API_TOKEN',
	vercelTeamId: 'VERCEL_TEAM_ID',
	/** Restricted read-only key; falls back to the upload key when unset. */
	cloudinaryUsageApiKey: 'CLOUDINARY_USAGE_API_KEY',
	cloudinaryUsageApiSecret: 'CLOUDINARY_USAGE_API_SECRET',
	cloudinaryApiKey: 'CLOUDINARY_API_KEY',
	cloudinaryApiSecret: 'CLOUDINARY_API_SECRET',
	cloudinaryCloudName: 'CLOUDINARY_CLOUD_NAME',
	/** Platform-injected (Vercel): `production` | `preview` | `development`. */
	vercelEnv: 'VERCEL_ENV',
} as const;

/**
 * Local-only per-environment overrides so the local dashboard can diagnose
 * each environment separately. Only `src/lib/platform/server/env-profiles.ts`
 * consults them; deployments read the plain names above.
 */
export const PLATFORM_ENV_BY_ENVIRONMENT = {
	cloudflareAnalyticsToken: {
		preview: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PREVIEW',
		production: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN_PRODUCTION',
	},
	r2BucketName: {
		preview: 'MEMORIES_R2_BUCKET_NAME_PREVIEW',
		production: 'MEMORIES_R2_BUCKET_NAME_PRODUCTION',
	},
	supabaseManagementToken: {
		preview: 'SUPABASE_MANAGEMENT_TOKEN_PREVIEW',
		production: 'SUPABASE_MANAGEMENT_TOKEN_PRODUCTION',
	},
} as const;
