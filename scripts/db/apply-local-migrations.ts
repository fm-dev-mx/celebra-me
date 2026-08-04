/**
 * apply-local-migrations.ts — Compatibility wrapper for persistent-local schema migrate.
 *
 * Canonical entrypoint: pnpm db:migrate -- --target local
 * Alias: pnpm db:local:migrate (defaults to --apply for legacy compatibility)
 *
 * Orchestration lives in migrate-orchestrator.ts + migrate-policy-local.ts.
 */

import { runMigrateCli } from './migrate-cli.ts';

export {
	verifyPersistentLocalTarget,
} from './migrate-policy-local.ts';

export async function main(argv: string[] = process.argv): Promise<void> {
	const userArgs = argv.slice(2);
	// Legacy alias always applied pending migrations unless an explicit preflight is requested.
	const hasMode = userArgs.includes('--apply') || userArgs.includes('--preflight');
	const forwarded = [
		argv[0] ?? 'node',
		'migrate-cli.ts',
		'--target',
		'local',
		...(hasMode ? [] : ['--apply']),
		...userArgs.filter((a) => a !== '--preflight'),
	];
	await runMigrateCli(forwarded);
}

if (process.argv[1]?.endsWith('apply-local-migrations.ts')) {
	void main().catch((error: unknown) => {
		console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	});
}
