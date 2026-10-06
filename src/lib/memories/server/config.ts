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
	/** HMAC key for shared-gallery links; rotating it revokes every link at once. */
	shareSecret: 'MEMORIES_SHARE_SECRET',
} as const;
