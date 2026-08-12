/**
 * dbs-cli.ts — Read-Only Unified Environment Status CLI (dbs)
 *
 * Usage:
 *   pnpm dbs                   # Canonical schema + publication + readiness
 *   pnpm dbs <slug>            # One registry invitation
 *   pnpm dbs --verbose         # Migration IDs, env states, reasonCode
 *   pnpm dbs --in-sync         # Include NONE / in-sync slugs
 *   pnpm dbs --compact         # Connectivity CONTENT + schema (not publication)
 *   pnpm dbs --json            # CanonicalStatusView JSON
 */

import {
	MANAGED_STATUS_DEFAULT_TIMEOUT_MS,
	runCompactManagedStatusSafe,
} from './managed-status.ts';

function readTimeoutMs(args: string[]): number {
	const idx = args.indexOf('--timeout-ms');
	if (idx === -1) return MANAGED_STATUS_DEFAULT_TIMEOUT_MS;
	const raw = args[idx + 1];
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 500 || parsed > 60_000) {
		throw new Error('--timeout-ms must be a number between 500 and 60000.');
	}
	return Math.floor(parsed);
}

async function formatGeneralView(
	jsonMode: boolean,
	verbose: boolean,
	includeInSync: boolean,
): Promise<void> {
	const { buildCanonicalStatusView } = await import('./canonical-status.ts');
	const { formatCanonicalStatusView } = await import('./canonical-status-format.ts');
	const view = await buildCanonicalStatusView();
	if (jsonMode) {
		console.log(JSON.stringify(view, null, 2));
		return;
	}
	process.stdout.write(formatCanonicalStatusView(view, { verbose, includeInSync }));
}

async function formatInvitationView(
	slug: string,
	jsonMode: boolean,
	verbose: boolean,
): Promise<void> {
	const { buildCanonicalStatusView } = await import('./canonical-status.ts');
	const { formatSlugStatusView } = await import('./canonical-status-format.ts');
	const view = await buildCanonicalStatusView({ slugs: [slug] });
	if (jsonMode) {
		const promotion = view.promotions.find((row) => row.slug === slug) ?? null;
		console.log(
			JSON.stringify(
				{
					slug,
					inSync: view.inSyncSlugs.includes(slug),
					promotion,
					environments: view.environments,
					evidence: view.evidence,
				},
				null,
				2,
			),
		);
		return;
	}
	process.stdout.write(formatSlugStatusView(view, slug, { verbose }));
}

async function formatCompactView(
	slug: string | undefined,
	jsonMode: boolean,
	timeoutMs: number,
	aggregateContent: boolean,
): Promise<void> {
	if (jsonMode) {
		const result = await runCompactManagedStatusSafe({ slug, timeoutMs, aggregateContent });
		if (!result.ok) {
			console.log(
				JSON.stringify({ ok: false, error: result.text.trim(), readOnly: true }, null, 2),
			);
			process.exit(0);
		}
		console.log(JSON.stringify(result.status, null, 2));
		return;
	}

	const result = await runCompactManagedStatusSafe({ slug, timeoutMs, aggregateContent });
	process.stdout.write(result.text);
	if (!result.ok) {
		process.exit(0);
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const jsonMode = args.includes('--json');
	const compactMode = args.includes('--compact');
	const verbose = args.includes('--verbose');
	const includeInSync = args.includes('--in-sync');
	const aggregateContent = args.includes('--aggregate-content');
	const timeoutMs = readTimeoutMs(args);
	const timeoutIdx = args.indexOf('--timeout-ms');
	const slug = args.find(
		(arg, index) =>
			!arg.startsWith('-') &&
			!(timeoutIdx !== -1 && index === timeoutIdx + 1),
	);

	if (compactMode) {
		await formatCompactView(slug, jsonMode, timeoutMs, aggregateContent);
		return;
	}

	if (slug) {
		await formatInvitationView(slug, jsonMode, verbose);
	} else {
		await formatGeneralView(jsonMode, verbose, includeInSync);
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
