/**
 * preview-demo-republish-cli.ts — Republish one Preview demo from its versioned JSON
 *
 * Usage:
 *   pnpm invitation:preview-demo --slug <demo-slug> --dry-run
 *   CELEBRA_TASK_SCOPE=preview:<demo-slug>:demo-republish pnpm invitation:preview-demo --slug <demo-slug> --apply
 */

import {
	PREVIEW_DEMO_REPUBLISH_OPERATION,
	republishPreviewDemo,
	type PreviewDemoRepublishResult,
} from './preview-demo-republish.ts';

function printHelp(): void {
	console.log(`Republish a Preview demo from src/content/event-demos (Preview-only; dry-run by default)

Usage:
  pnpm invitation:preview-demo --slug <demo-slug> --dry-run
  pnpm invitation:preview-demo --slug <demo-slug> --apply [--json]
  pnpm invitation:preview-demo --slug <demo-slug> --replace-url <cloudinary-url> --with <r2-url> --dry-run|--apply

Replaces the published content of that one demo (and its active draft, when present) with the
schema-parsed versioned JSON. With --replace-url, only string values equal to that Cloudinary URL
change, to an R2 media URL that must answer 200; the rest of the content stays as stored.
Production is rejected.

Automated --apply requires:
  CELEBRA_TASK_SCOPE=preview:<demo-slug>:${PREVIEW_DEMO_REPUBLISH_OPERATION}
An interactive --apply also asks for YES.
`);
}

function readValue(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index < 0) return undefined;
	const value = args[index + 1];
	if (!value || value.startsWith('--')) throw new Error(`Pass a value after ${flag}.`);
	return value;
}

function readReplaceUrl(args: string[]): { from: string; to: string } | undefined {
	const from = readValue(args, '--replace-url');
	const to = readValue(args, '--with');
	if (!from && !to) return undefined;
	if (!from || !to)
		throw new Error('Pass --replace-url <cloudinary-url> together with --with <r2-url>.');
	return { from, to };
}

function printResult(result: PreviewDemoRepublishResult): void {
	console.log(`Preview demo: ${result.action}`);
	console.log(`  demo:        ${result.eventType}/${result.slug}`);
	console.log(`  source:      ${result.sourcePath}`);
	console.log(`  version:     ${result.publishedVersion}`);
	console.log(
		`  sections:    ${result.changedSections.length > 0 ? result.changedSections.join(', ') : 'none'}`,
	);
	if (result.replacedUrls > 0) console.log(`  replaced:    ${result.replacedUrls} URL value(s)`);
	console.log(`  draft:       ${result.draftChanged ? 'updated' : 'unchanged'}`);
	console.log(
		`  cloudinary:  ${result.cloudinaryUrlsBefore} URL(s) now -> ${result.cloudinaryUrlsAfter} after`,
	);
	console.log(`  target:      ${result.dbUrlRedacted}`);
	if (result.action === 'dry_run_update') {
		console.log('\nDry-run only. Re-run with --apply to write Preview.');
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.includes('--help') || args.includes('-h')) {
		printHelp();
		return;
	}
	const apply = args.includes('--apply');
	if (apply && args.includes('--dry-run')) {
		throw new Error('Pass either --apply or --dry-run, not both.');
	}

	const result = await republishPreviewDemo({
		slug: readValue(args, '--slug') ?? '',
		apply,
		replaceUrl: readReplaceUrl(args),
		isInteractive: process.stdin.isTTY === true && !process.env.CI,
	});
	if (args.includes('--json')) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	printResult(result);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exitCode = 1;
});
