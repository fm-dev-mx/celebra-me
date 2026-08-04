/**
 * push-prod-migrations.ts — Compatibility wrapper for Production schema migrate.
 *
 * Canonical entrypoint: pnpm db:migrate -- --target production
 * Alias: pnpm db:prod:migrate
 *
 * Orchestration lives in migrate-orchestrator.ts + migrate-policy-production.ts.
 */

import { runMigrateCli } from './migrate-cli.ts';

// Re-export helpers/tests still import from this path.
export { isAllowlistedBehindAuditOutput } from './migrate-policy-production.ts';

async function main(): Promise<void> {
	const forwarded = [
		process.argv[0] ?? 'node',
		'migrate-cli.ts',
		'--target',
		'production',
		...process.argv.slice(2),
	];
	await runMigrateCli(forwarded);
}

if (process.argv[1]?.endsWith('push-prod-migrations.ts')) {
	void main().catch((error: unknown) => {
		console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	});
}
