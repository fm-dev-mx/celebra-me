/**
 * push-preview-migrations.ts — Preview Database Migration Runner
 *
 * Applies pending Supabase migrations to an ephemeral Preview database target.
 *
 * Supported Credentials:
 *   - Environment variable: PREVIEW_DB_URL
 *   - Secret files (PREVIEW_SECRET_FILES):
 *       .env.preview.local
 *       .env.preview
 *       .secrets/preview-db-url
 *       .tmp/secrets/preview-db-url
 *
 * Behavior & Scope:
 *   - Target: preview
 *   - Runs: `supabase db push --db-url <previewDbUrl> --yes`
 *   - Fails closed (exit code 1) when PREVIEW_DB_URL is not configured.
 *   - Migration ONLY: Seed data and audit (`pnpm db:preview:audit`) are separate operations.
 *
 * Status:
 *   SUPPORTED BY TOOLING
 *   NOT YET PROVISIONED
 *   NOT YET HOSTED-VALIDATED
 *
 * Privacy & Isolation:
 *   - Preview must use isolated synthetic test data (e.g. `supabase/test/seed-test-data.sql`).
 *   - Production customer data must NEVER be copied into Preview.
 */

import {
	fail,
	runCommand,
} from './db-workflow-lib.ts';
import { PREVIEW_SECRET_FILES, getSecretFromEnvOrFiles } from './db-guard.ts';

function main(): void {
	const previewDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (!previewDbUrl) {
		fail('PREVIEW_DB_URL is not configured. Set PREVIEW_DB_URL in environment or secret files.');
	}

	console.info('Applying pending migrations to preview database...');
	const result = runCommand('supabase', ['db', 'push', '--db-url', previewDbUrl, '--yes'], {
		redact: [previewDbUrl],
		throwOnError: false,
	});

	if (result.status !== 0) {
		fail(`Preview migration failed with exit code ${result.status}.`);
	}
	console.info('✅ Preview migration complete.');
}

try {
	main();
} catch (err: unknown) {
	fail(err instanceof Error ? err.message : String(err));
}
