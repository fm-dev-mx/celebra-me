/**
 * managed-identity-diagnostics-cli.ts — Alias-aware managed identity diagnostics.
 *
 * Usage:
 *   pnpm invitation:diagnose-identity -- --target disposable-test|local|preview
 *   pnpm invitation:diagnose-identity -- --db-url <url>
 */

import {
	classifyDbTarget,
	getSecretFromEnvOrFiles,
	LOCAL_DB_URL,
	PREVIEW_SECRET_FILES,
} from '../db/db-workflow-lib.ts';
import { runManagedIdentityDiagnostics } from './managed-identity-diagnostics.ts';

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function resolveDbUrl(argv: string[]): string {
	const explicit = value(argv, '--db-url');
	if (explicit) return explicit;
	const target = value(argv, '--target') ?? 'local';
	if (target === 'local') return LOCAL_DB_URL;
	if (target === 'disposable-test') return 'postgresql://postgres:postgres@127.0.0.1:54332/postgres';
	if (target === 'preview') {
		const previewUrl = (
			process.env.PREVIEW_DB_URL?.trim() ||
			getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES)
		).trim();
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
