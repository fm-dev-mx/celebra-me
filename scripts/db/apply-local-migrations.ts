/**
 * apply-local-migrations.ts — Compatibility wrapper for persistent-local schema migrate.
 *
 * Canonical entrypoint: pnpm db:migrate -- --target local
 * Alias: pnpm db:local:migrate
 *
 * Preflight-first: same CLI/policy as db:migrate. Never injects --apply.
 *
 * Orchestration lives in migrate-orchestrator.ts + migrate-policy-local.ts.
 */

export { verifyPersistentLocalTarget } from './migrate-policy-local.ts';

export async function main(argv: string[] = process.argv): Promise<void> {
	const { runMigrateCli } = await import('./migrate-cli.ts');
	const userArgs = argv.slice(2);
	const forwarded = [
		argv[0] ?? 'node',
		'migrate-cli.ts',
		'--target',
		'local',
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
