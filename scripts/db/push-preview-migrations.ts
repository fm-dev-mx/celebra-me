/**
 * push-preview-migrations.ts — Compatibility wrapper for Preview schema migrate.
 *
 * Canonical entrypoint: pnpm db:migrate -- --target preview
 * Alias: pnpm db:preview:migrate
 *
 * Orchestration lives in migrate-orchestrator.ts + migrate-policy-preview.ts.
 */

import { runMigrateCli } from './migrate-cli.ts';

export async function main(argv: string[] = process.argv): Promise<void> {
	const userArgs = argv.slice(2);
	const forwarded = [argv[0] ?? 'node', 'migrate-cli.ts', '--target', 'preview', ...userArgs];
	await runMigrateCli(forwarded);
}

if (
	typeof process.argv[1] === 'string' &&
	/push-preview-migrations\.(ts|js|mjs|cjs)$/.test(process.argv[1])
) {
	void main().catch((err: unknown) => {
		console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	});
}
