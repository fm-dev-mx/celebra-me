/**
 * Environment variable names read by the platform usage clients. Values are
 * server-only and never leave these modules. Deliberately not named
 * `CLOUDFLARE_*`: Wrangler would pick those up as deploy credentials.
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
