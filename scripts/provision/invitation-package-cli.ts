#!/usr/bin/env node
/**
 * invitation-package-cli.ts — CLI entrypoint for exporting canonical invitation packages.
 *
 * Usage:
 *   pnpm invitation:package -- --slug romina-rios-chaparro --dry-run
 *   pnpm invitation:package -- --slug romina-rios-chaparro --apply
 *   pnpm invitation:package -- --slug romina-rios-chaparro --apply --out .tmp/packages/romina.json
 */

import { exportInvitationPackage } from './invitation-package.ts';

function parseArgs() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const apply = args.includes('--apply');

	const slugIdx = args.indexOf('--slug');
	const slug = slugIdx >= 0 ? args[slugIdx + 1] : undefined;

	const outIdx = args.indexOf('--out');
	const outPath = outIdx >= 0 ? args[outIdx + 1] : undefined;

	if (!slug) {
		console.error('\x1b[31mError: Missing required --slug <slug> parameter.\x1b[0m\n');
		console.info('Usage:');
		console.info('  pnpm invitation:package -- --slug <slug> --dry-run');
		console.info('  pnpm invitation:package -- --slug <slug> --apply [--out <path>]\n');
		process.exit(1);
	}

	if (!dryRun && !apply) {
		console.error('\x1b[31mError: Specify either --dry-run or --apply.\x1b[0m\n');
		process.exit(1);
	}

	return { slug, dryRun: !apply || dryRun, isApply: apply, outPath };
}

async function main() {
	const { slug, isApply, outPath } = parseArgs();

	console.log(`\n\x1b[36m═══ Exporting Canonical Invitation Package ═══\x1b[0m`);
	console.log(`Slug:    \x1b[1m${slug}\x1b[0m`);
	console.log(`Mode:    \x1b[1m${isApply ? 'APPLY (writing package file)' : 'DRY RUN'}\x1b[0m\n`);

	try {
		const result = await exportInvitationPackage({
			slug,
			dryRun: !isApply,
			outPath,
		});

		console.log(`\x1b[32m✅ Package export ${isApply ? 'completed' : 'plan ready'}!\x1b[0m`);
		console.log(`   Package Hash: \x1b[1m${result.stats.packageHash}\x1b[0m`);
		console.log(
			`   Assets:       ${result.stats.assetCount} files (${(result.stats.totalBytes / 1024 / 1024).toFixed(2)} MB)`,
		);
		console.log(
			`   Published:    ${result.stats.hasPublishedContent ? 'Yes' : 'No (draft only)'}`,
		);

		if (result.packagePath) {
			console.log(`   Package File: \x1b[33m${result.packagePath}\x1b[0m\n`);
		} else {
			console.log(
				`   \x1b[33m[dry-run] Run with --apply to write the package file.\x1b[0m\n`,
			);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`\n\x1b[31m❌ Export failed:\x1b[0m ${message}\n`);
		process.exit(1);
	}
}

if (process.argv[1] && process.argv[1].includes('invitation-package-cli')) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
