/**
 * inventory-audit-cli.ts — Versioned Read-Only Environment Inventory Parity CLI.
 *
 * Usage:
 *   pnpm invitation:inventory-audit         # Human-readable tabular parity matrix
 *   pnpm invitation:inventory-audit --json  # Structured JSON output
 *
 * This command is strictly read-only and never mutates any database.
 * It uses the shared promotional-evidence collector, not Observability snapshots.
 */
import { runInventoryAudit } from './inventory-audit.ts';
import { readObservabilitySourceState } from '../observability/source-state.ts';

function pad(str: string, width: number): string {
	return str.padEnd(width, ' ');
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const jsonMode = args.includes('--json');

	const result = await runInventoryAudit();
	const source = readObservabilitySourceState();
	const reporting = {
		commitSha: source.commitSha,
		databaseTargets: {
			local: 'persistent-local',
			preview: 'preview',
			production: 'production',
		},
	};

	if (jsonMode) {
		console.log(JSON.stringify({ ...result, reporting }, null, 2));
		return;
	}

	console.log(
		`\n========================================================================================`,
	);
	console.log(` Celebra-me Managed Inventory & Environment Parity Audit`);
	console.log(
		`========================================================================================\n`,
	);

	console.log(`Generated At:                ${result.generatedAt}`);
	console.log(`Commit SHA:                  ${reporting.commitSha ?? 'unavailable'}`);
	console.log(
		`Database Targets:            local=${reporting.databaseTargets.local}, preview=${reporting.databaseTargets.preview}, production=${reporting.databaseTargets.production}`,
	);
	console.log(
		`Repository Definitions:     ${result.summary.repoCanonicalCount} (${result.summary.repoCanonicalPublishedCount} published, ${result.summary.repoCanonicalInProgressCount} in_progress)`,
	);
	console.log(
		`Local Render Corpus Size:   ${result.summary.localRenderCorpusCount} (${result.summary.repoCanonicalPublishedCount} canonical, ${result.summary.localRenderCorpusCount - result.summary.repoCanonicalPublishedCount} legacy)`,
	);
	console.log(`Observed Scope (Union):     ${result.summary.observedScopeCount} invitations\n`);

	console.log(`--- ENVIRONMENT ROW TOTALS & CATEGORY BREAKDOWN ---`);
	const colW = 16;
	console.log(
		pad('Category / Metric', 24) +
			pad('LOCAL DB', colW) +
			pad('PREVIEW DB', colW) +
			pad('PRODUCTION DB', colW),
	);
	console.log('-'.repeat(24 + colW * 3));

	const envs = result.summary.environments;

	console.log(
		pad('Reachability', 24) +
			pad(envs.local.reachable ? 'REACHABLE' : 'UNREACHABLE', colW) +
			pad(envs.preview.reachable ? 'REACHABLE' : 'UNREACHABLE', colW) +
			pad(envs.production.reachable ? 'REACHABLE' : 'UNREACHABLE', colW),
	);

	console.log(
		pad('Total Active Rows', 24) +
			pad(String(envs.local.totalActiveRows), colW) +
			pad(String(envs.preview.totalActiveRows), colW) +
			pad(String(envs.production.totalActiveRows), colW),
	);

	console.log('-'.repeat(24 + colW * 3));

	const categories: Array<{ id: keyof typeof envs.local.categoryCounts; label: string }> = [
		{ id: 'canonical_published', label: 'Canonical Published' },
		{ id: 'canonical_in_progress', label: 'Canonical In Progress' },
		{ id: 'legacy_corpus', label: 'Legacy Corpus' },
		{ id: 'demo', label: 'Demo Invitations' },
		{ id: 'preview_e2e_fixture', label: 'Preview E2E Fixture' },
		{ id: 'legacy_typo_alias', label: 'Legacy Typo Alias' },
		{ id: 'unmanaged', label: 'Unmanaged Rows' },
	];

	for (const cat of categories) {
		console.log(
			pad(cat.label, 24) +
				pad(String(envs.local.categoryCounts[cat.id]), colW) +
				pad(String(envs.preview.categoryCounts[cat.id]), colW) +
				pad(String(envs.production.categoryCounts[cat.id]), colW),
		);
	}

	console.log(
		`\n========================================================================================`,
	);
	console.log(
		` PER-INVITATION PARITY MATRIX (${result.rows.length} Total Slugs Across Registries & DBs)`,
	);
	console.log(
		`========================================================================================\n`,
	);

	const wSlug = 32;
	const wCat = 22;
	const wEnv = 8;
	const wProv = 10;
	const wState = 14;

	console.log(
		pad('Slug', wSlug) +
			pad('Category', wCat) +
			pad('Local', wEnv) +
			pad('Preview', wEnv) +
			pad('Prod', wEnv) +
			pad('Prod Prov', wProv) +
			pad('Delivery State', wState),
	);
	console.log('-'.repeat(wSlug + wCat + wEnv * 3 + wProv + wState));

	for (const row of result.rows) {
		const loc = row.environments.local.present ? 'YES' : '-';
		const prv = row.environments.preview.present ? 'YES' : '-';
		const prd = row.environments.production.present ? 'YES' : '-';
		const prov = row.environments.production.hasProvenance
			? 'YES'
			: row.environments.production.present
				? 'MISSING'
				: '-';

		console.log(
			pad(row.slug, wSlug) +
				pad(row.category, wCat) +
				pad(loc, wEnv) +
				pad(prv, wEnv) +
				pad(prd, wEnv) +
				pad(prov, wProv) +
				pad(row.deliveryState, wState),
		);
	}

	console.log(
		`\n========================================================================================\n`,
	);
	console.log(
		`Canonical publication decisions: pnpm dbs. Inventory categories above are not promotion authority.`,
	);
}

await main();
