/**
 * dbs-cli.ts — Read-Only Unified Environment Status CLI (dbs)
 *
 * Usage:
 *   pnpm dbs                   # Interactive menu on a terminal; canonical matrix otherwise
 *   pnpm dbs <slug>            # One registry invitation
 *   pnpm dbs --verbose         # Migration IDs, env states, reasonCode
 *   pnpm dbs --in-sync         # Include NONE / in-sync slugs
 *   pnpm dbs --compact         # Connectivity CONTENT + schema (not publication)
 *   pnpm dbs --diagnostics     # Same decisions plus diagnostic enrichment
 *   pnpm dbs --json            # CanonicalStatusView JSON
 *   pnpm dbs --targets local,preview   # Probe a subset of environments
 *
 * Most flags are also reachable from the interactive menu. Flags skip the menu (CI / automation).
 */

import { readStatusTargets } from './dbs-options.ts';
import { normalizeOperatorArgv } from '../lib/operator-argv.ts';
import { isInteractiveSession } from '../lib/cli-prompts.ts';
import { shouldOpenDbsMenu } from './dbs-interactive-model.ts';
import { readTimeoutMs, runCompactView, runGeneralView, runInvitationView } from './dbs-views.ts';

async function main(): Promise<void> {
	const normalizedArgs = normalizeOperatorArgv(process.argv.slice(2));
	if (shouldOpenDbsMenu(normalizedArgs, isInteractiveSession())) {
		const { runDbsInteractive } = await import('./dbs-interactive.ts');
		await runDbsInteractive();
		return;
	}
	const { args, targets } = readStatusTargets(normalizedArgs);
	const json = args.includes('--json');
	const compactMode = args.includes('--compact');
	const verbose = args.includes('--verbose');
	const includeInSync = args.includes('--in-sync');
	const diagnostics = args.includes('--diagnostics');
	const aggregateContent = args.includes('--aggregate-content');
	const timeoutMs = readTimeoutMs(args);
	const timeoutIdx = args.indexOf('--timeout-ms');
	const slug = args.find(
		(arg, index) => !arg.startsWith('-') && !(timeoutIdx !== -1 && index === timeoutIdx + 1),
	);

	if (compactMode) {
		await runCompactView({ slug, json, timeoutMs, aggregateContent, targets });
		return;
	}

	if (slug) {
		await runInvitationView(slug, { json, verbose, diagnostics, targets });
	} else {
		await runGeneralView({ json, verbose, includeInSync, diagnostics, targets });
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
