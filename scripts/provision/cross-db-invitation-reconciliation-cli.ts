/**
 * cross-db-invitation-reconciliation-cli.ts
 *
 * Usage:
 *   pnpm invitation:cross-db-reconcile
 *   pnpm invitation:cross-db-reconcile -- --json
 *   pnpm invitation:cross-db-reconcile -- --targets local,preview,production
 */

import type { TargetEnv } from './dbs-status.ts';
import { runCrossDbInvitationReconciliation } from './cross-db-invitation-reconciliation.ts';

function parseTargets(raw: string | undefined): TargetEnv[] | undefined {
	if (!raw) return undefined;
	const parts = raw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	const allowed = new Set(['local', 'preview', 'production']);
	for (const part of parts) {
		if (!allowed.has(part)) {
			throw new Error(`Unknown target "${part}". Expected local,preview,production.`);
		}
	}
	return parts as TargetEnv[];
}

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function printHelp(): void {
	console.log(`invitation:cross-db-reconcile — Read-only cross-database invitation reconciliation

Usage:
  pnpm invitation:cross-db-reconcile
  pnpm invitation:cross-db-reconcile -- --json
  pnpm invitation:cross-db-reconcile -- --targets local,preview

Compares invitations by stable slug. Excludes lifecycle statuses draft and in_progress,
and excludes repo definitions with lifecycle in_progress.
`);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
	if (argv.includes('--help') || argv.includes('-h')) {
		printHelp();
		return;
	}
	const jsonMode = argv.includes('--json');
	const report = runCrossDbInvitationReconciliation({
		targets: parseTargets(value(argv, '--targets')),
	});

	if (jsonMode) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}

	console.log('Cross-database invitation reconciliation');
	console.log(`  generatedAt: ${report.generatedAt}`);
	console.log(`  identifier:  ${report.stableIdentifier}`);
	console.log(
		`  excluded:    statuses=[${report.excludedLifecycleStatuses.join(', ')}] repo=[${report.excludedRepoDefinitions.join(', ') || 'none'}]`,
	);
	console.log(
		`  summary:     aligned=${report.summary.aligned} missing=${report.summary.missing} extra=${report.summary.extra} divergent=${report.summary.divergent}`,
	);
	for (const env of ['local', 'preview', 'production'] as const) {
		const snap = report.environments[env];
		console.log(
			`  ${env}: reachable=${snap.reachable} rows=${snap.rows.length} excluded=${snap.excludedCount}${snap.error ? ` error=${snap.error}` : ''}`,
		);
	}
	const notable = report.findings.filter((finding) => finding.kind !== 'aligned');
	if (notable.length === 0) {
		console.log('\nNo missing/extra/divergent invitations among non-in-progress rows.');
		return;
	}
	console.log(`\nFindings (${notable.length}):`);
	for (const finding of notable) {
		console.log(`  - [${finding.kind}] ${finding.canonicalKey}`);
		for (const detail of finding.details) console.log(`      ${detail}`);
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exitCode = 1;
});
