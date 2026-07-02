#!/usr/bin/env tsx
// =============================================================================
// CELEBRA-ME | Screenshot Tool — CLI Entry Point
// =============================================================================
//
// Usage:
//   pnpm screenshot                              # Interactive mode
//   pnpm screenshot:invite --url=...             # Direct invitation mode
//   pnpm screenshot:page --url=...               # Direct general page mode
//
// =============================================================================

import * as path from 'node:path';
import * as fs from 'node:fs';
import {
	type CliOptions,
	type ScreenshotJob,
	type PageType,
	DEFAULT_BASE_URL,
	DEFAULT_STORAGE_STATE_PATH,
} from './types.js';
import {
	parseCliArgs,
	resolveUrl,
	createPageSlug,
	resolveViewports,
	getDefaultProfile,
	resolveOutputDir,
} from './utils.js';
import { runInteractiveFlow } from './interactive.js';
import { runScreenshotJob } from './runner.js';

// ── Entry point ──────────────────────────────────────────────────────────

async function main() {
	const cliOptions = parseCliArgs(process.argv);

	// ── Route to interactive or direct mode ────────────────────────────────
	const isInteractive = shouldRunInteractive(cliOptions);

	const job = isInteractive ? await runInteractiveFlow() : buildJobFromCli(cliOptions);

	if (!job) {
		process.exit(0);
	}

	// ── Clean output directory ──────────────────────────────────────────
	if (cliOptions.clean) {
		const cleanDir = resolveOutputDir(
			createPageSlug(job.url),
			job.outputFolderStyle,
			job.outputFolder,
		);
		fs.rmSync(cleanDir, { recursive: true, force: true });
		console.log(`  🧹 Cleaned output: ${cleanDir}/`);
	}

	// ── Execute ────────────────────────────────────────────────────────────
	const result = await runScreenshotJob(job);

	// Exit with non-zero if any failures
	if (result.failed > 0) {
		process.exit(1);
	}
}

// ── Interactive vs Direct detection ───────────────────────────────────────

function shouldRunInteractive(options: CliOptions): boolean {
	// Explicit --interactive flag
	if (options.interactive === true) return true;

	// Explicit --no-interactive (from a preset command)
	if (options.interactive === false) return false;

	// If URL is provided, run direct
	if (options.url) return false;

	// If invoked with no flags, run interactive
	const hasAnyFlag = Object.values(options).some((v) => v !== undefined);
	if (!hasAnyFlag) return true;

	// Fallback: interactive
	return true;
}

// ── Build job from CLI flags ─────────────────────────────────────────────

function validateCliOptions(options: CliOptions): void {
	if (options.config) {
		console.error('✕ --config / batch mode is not yet implemented.');
		console.error('  The --config flag is parsed but batch execution has not been built.');
		console.error('  For now, run the tool once per page with --url=<route>.');
		process.exit(1);
	}

	if (options.auth === 'storage-state') {
		const storagePath = path.join(process.cwd(), DEFAULT_STORAGE_STATE_PATH);
		if (!fs.existsSync(storagePath)) {
			console.error(`✕ Storage state file not found: ${storagePath}`);
			console.error(
				'  Use --auth=manual-login instead, or save a Playwright storage state to:',
			);
			console.error(`    ${DEFAULT_STORAGE_STATE_PATH}`);
			process.exit(1);
		}
	}
}

function buildJobFromCli(options: CliOptions): ScreenshotJob | null {
	const url = options.url;
	if (!url) {
		console.error(
			'✕ No URL provided. Use --url=<url> or run without flags for interactive mode.',
		);
		console.error('  Examples:');
		console.error(
			'    pnpm screenshot:invite --url=http://localhost:4321/boda/demo-boda-jewelry-box-wedding',
		);
		console.error('    pnpm screenshot:page --url=http://localhost:4321/dashboard');
		process.exit(1);
	}

	validateCliOptions(options);

	const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
	const resolvedUrl = resolveUrl(url, baseUrl);

	// Determine page type
	let pageType: PageType;
	if (options.pageType) {
		pageType = options.pageType;
	} else if (url.includes('/boda/') || url.includes('/xv/') || url.includes('/invitation')) {
		pageType = 'invitation';
	} else {
		pageType = 'custom';
	}

	// Viewport handling
	const profile = options.profile ?? getDefaultProfile(pageType);
	const viewports = resolveViewports(profile, options.viewport);

	// Section capture
	let sectionCapture: 'none' | 'auto' | 'known' | 'custom' = 'none';
	let sectionSelectors: string[] | undefined;

	if (options.sections === 'known') {
		sectionCapture = 'known';
	} else if (options.sections === 'auto') {
		sectionCapture = 'auto';
	} else if (options.sectionSelectors) {
		sectionCapture = 'custom';
		sectionSelectors = options.sectionSelectors
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	const outputFolderStyle = options.outputStyle ?? 'default';

	const job: ScreenshotJob = {
		pageType,
		url: resolvedUrl,
		baseUrl,
		viewportProfile: profile,
		viewports,
		invitationSet: options.invitationSet ?? 'essential',
		generalSet: options.generalSet ?? 'basic',
		revealHandling: options.reveal ?? 'auto',
		animationHandling: options.animation ?? 'disable',
		sectionCapture,
		sectionSelectors,
		authMethod: options.auth ?? 'none',
		outputFormat: options.format ?? 'png',
		outputFolderStyle,
		outputFolder: outputFolderStyle === 'custom' ? options.output : undefined,
	};

	return job;
}

// ── Run ──────────────────────────────────────────────────────────────────

main().catch((err) => {
	console.error('\n✕  Fatal error:', err);
	process.exit(1);
});
