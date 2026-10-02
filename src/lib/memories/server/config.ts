/**
 * Server-only environment variable names for event memories. Values are owned
 * by Vercel (see docs/env-workflow.md); this module never reads secrets itself.
 */

export const MEMORIES_ENV = {
	uploadOrigin: 'MEMORIES_PRIVATE_UPLOAD_ORIGIN',
	retrievalOrigin: 'MEMORIES_PRIVATE_RETRIEVAL_ORIGIN',
	uploadSigningPrivateKey: 'MEMORIES_UPLOAD_REQUEST_SIGNING_PRIVATE_KEY',
	retrievalSigningPrivateKey: 'MEMORIES_RETRIEVAL_REQUEST_SIGNING_PRIVATE_KEY',
	cronSecret: 'CRON_SECRET',
	/**
	 * Optional read-only usage for the admin console. Deliberately not named
	 * `CLOUDFLARE_*`: Wrangler would pick those up as deploy credentials.
	 */
	analyticsAccountId: 'MEMORIES_CLOUDFLARE_ACCOUNT_ID',
	analyticsToken: 'MEMORIES_CLOUDFLARE_ANALYTICS_TOKEN',
	r2BucketName: 'MEMORIES_R2_BUCKET_NAME',
} as const;
