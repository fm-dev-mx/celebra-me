/**
 * apply-local-migrations.ts — Compatibility wrapper for persistent-local schema migrate.
 *
 * Canonical entrypoint: pnpm db:migrate -- --target local
 * Alias: pnpm db:local:migrate
 *
 * DEPRECATED default: when neither --apply nor --preflight is passed, this wrapper injects
 * --apply for legacy callers. Canonical `pnpm db:migrate` remains preflight-first.
 *
 * Removal criteria: no remaining docs/scripts/CI callers that rely on default-apply, and
 * operators use `pnpm db:migrate -- --target local --apply` (or explicit --preflight) instead.
 *
 * Orchestration lives in migrate-orchestrator.ts + migrate-policy-local.ts.
 */

export {
	verifyPersistentLocalTarget,
} from './migrate-policy-local.ts';

export async function main(argv: string[] = process.argv): Promise<void> {
	const { runMigrateCli } = await import('./migrate-cli.ts');
	const userArgs = argv.slice(2);
	// Legacy alias always applied pending migrations unless an explicit preflight is requested.
	const hasMode = userArgs.includes('--apply') || userArgs.includes('--preflight');
	const injectLegacyApply = !hasMode;
	if (injectLegacyApply) {
		console.error(
			'DEPRECATED: pnpm db:local:migrate defaults to --apply. ' +
				'Prefer pnpm db:migrate -- --target local (preflight) then --apply after review. ' +
				'This default-apply shim will be removed when no callers rely on it.',
		);
	}
	const forwarded = [
		argv[0] ?? 'node',
		'migrate-cli.ts',
		'--target',
		'local',
		...(injectLegacyApply ? ['--apply'] : []),
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
