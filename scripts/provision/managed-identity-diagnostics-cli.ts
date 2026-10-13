/**
 * managed-identity-diagnostics-cli.ts — Alias-aware managed identity diagnostics.
 *
 * Usage:
 *   pnpm invitation:diagnose-identity -- --target disposable-test|local|preview
 *   pnpm invitation:diagnose-identity -- --db-url <url>
 */

import { flagValue as value } from '../lib/cli-args.ts';
import { runManagedIdentityDiagnostics } from './managed-identity-diagnostics.ts';
import { classifyDbTarget, resolveTargetDbUrl } from '../db/db-target-config.ts';

function resolveDbUrl(argv: string[]): string {
	const explicit = value(argv, '--db-url');
	if (explicit) return explicit;
	const target = value(argv, '--target') ?? 'local';
	if (target === 'local') return resolveTargetDbUrl('persistent-local');
	if (target === 'disposable-test') return resolveTargetDbUrl('disposable-test');
	if (target === 'preview') {
		const previewUrl = resolveTargetDbUrl('preview');
		if (!previewUrl) {
			throw new Error('PREVIEW_DB_URL_REQUIRED for --target preview.');
		}
		return previewUrl;
	}
	throw new Error(`Unsupported --target "${target}". Use local|disposable-test|preview.`);
}

async function main(argv = process.argv.slice(2)): Promise<void> {
	const dbUrl = resolveDbUrl(argv);
	const classification = classifyDbTarget(dbUrl);
	if (classification.target === 'production') {
		throw new Error('PRODUCTION_REJECTED: Identity diagnostics refuse Production targets.');
	}
	const report = runManagedIdentityDiagnostics(dbUrl);
	if (argv.includes('--json')) {
		console.log(JSON.stringify({ classification, ...report }, null, 2));
	} else {
		console.log(`Managed identity diagnostics (${classification.target})`);
		console.log(`  ok: ${report.ok ? 'yes' : 'NO'}`);
		console.log(`  definition aliases: ${report.definitionAliasCount}`);
		console.log(`  findings: ${report.findings.length}`);
		for (const finding of report.findings) {
			console.log(`  - [${finding.severity}] ${finding.code}: ${finding.detail}`);
		}
	}
	if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
