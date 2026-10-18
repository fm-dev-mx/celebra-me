/**
 * Server-only environment variable names for the platform usage console.
 * Values are owned by the hosting platform (see docs/env-workflow.md); this module never
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
} as const;
