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
	type CaptureTarget,
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
	loadScreenshotConfig,
	getDefaultCriticalSelectors,
} from './utils.js';
import { runInteractiveFlow } from './interactive.js';
import { runScreenshotJob } from './runner.js';

// ── Entry point ──────────────────────────────────────────────────────────

async function main() {
	const cliOptions = parseCliArgs(process.argv);

	// ── Route to interactive or direct mode ────────────────────────────────
	const isInteractive = shouldRunInteractive(cliOptions);

	if (!isInteractive && cliOptions.config) {
		const result = await runConfigJobs(cliOptions);
		if (result.failed > 0) process.exit(1);
		return;
	}

	const jobOrJobs = isInteractive ? await runInteractiveFlow() : buildJobFromCli(cliOptions);

	if (!jobOrJobs) {
		process.exit(0);
	}

	const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];
	let failed = 0;

	for (const job of jobs) {
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
		failed += result.failed;
	}

	// Exit with non-zero if any failures
	if (failed > 0) {
		process.exit(1);
	}
}

// ── Interactive vs Direct detection ───────────────────────────────────────

function shouldRunInteractive(options: CliOptions): boolean {
	// Explicit --interactive flag
	if (options.interactive === true) return true;

	// Explicit --no-interactive (from a preset command)
	if (options.interactive === false) return false;

	// Config-driven runs are always non-interactive.
	if (options.config) return false;

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

// eslint-disable-next-line complexity
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

	// Target resolution
	let target: CaptureTarget = options.target ?? 'critical-qa';
	let includeLayout = options.includeLayout;
	let sectionCapture: 'none' | 'auto' | 'known' | 'custom' | 'single' = 'none';
	let selectedSection: string | undefined;
	let sectionSelectors: string[] | undefined;

	if (options.sections) {
		if (options.sections === 'known' || options.sections === 'auto') {
			target = 'all-sections';
			sectionCapture = options.sections;
		} else {
			target = 'single-section';
			sectionCapture = 'single';
			selectedSection = options.sections;
		}
	} else if (options.sectionSelectors) {
		target = 'all-sections';
		sectionCapture = 'custom';
		sectionSelectors = options.sectionSelectors
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	if (includeLayout === undefined) {
		includeLayout = target === 'critical-qa' && pageType !== 'invitation';
	}

	const outputFolderStyle = options.outputStyle ?? 'default';

	const job: ScreenshotJob = {
		pageType,
		mode: options.mode ?? 'audit',
		url: resolvedUrl,
		baseUrl,
		viewportProfile: profile,
		viewports,
		target,
		includeLayout,
		invitationSet: options.invitationSet,
		generalSet: options.generalSet,
		revealHandling: options.reveal ?? 'auto',
		animationHandling: options.animation ?? 'disable',
		sectionCapture,
		selectedSection,
		sectionSelectors,
		criticalSelectors: getDefaultCriticalSelectors(pageType),
		waitSelectors: [],
		hideSelectors: [],
		authMethod: options.auth ?? 'none',
		outputFormat: options.format ?? 'png',
		outputFolderStyle,
		outputFolder: outputFolderStyle === 'custom' ? options.output : undefined,
	};

	return job;
}

// eslint-disable-next-line complexity -- Config defaults are resolved in one place for predictable batch jobs.
async function runConfigJobs(options: CliOptions): Promise<{ failed: number }> {
	if (!options.config) return { failed: 0 };

	const config = loadScreenshotConfig(options.config);
	const pages = config.pages ?? [];
	let failed = 0;

	if (pages.length === 0) {
		console.error(`✕ Config has no pages: ${options.config}`);
		return { failed: 1 };
	}

	for (const page of pages) {
		const baseUrl = config.baseUrl ?? options.baseUrl ?? DEFAULT_BASE_URL;
		const profile = page.profile ?? config.defaultViewportProfile ?? getDefaultProfile(page.pageType);
		const viewports = resolveViewports(profile, page.viewports);
		const route = page.route;
		const outputFolderStyle = options.outputStyle ?? config.defaultOutputFolderStyle ?? 'default';
		const outputFolder =
			options.output ??
			(config.outputDir ? path.join(config.outputDir, page.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) : undefined);

		const target = page.target ?? (
			(page.invitationSet === 'full-page') ? 'full-page' : 'critical-qa'
		);
		const includeLayout = page.includeLayout ?? (
			(target === 'critical-qa' && page.pageType !== 'invitation')
		);

		const job: ScreenshotJob = {
			pageType: page.pageType,
			mode: page.mode ?? config.defaultMode ?? options.mode ?? 'audit',
			url: resolveUrl(route, baseUrl),
			baseUrl,
			viewportProfile: profile,
			viewports,
			target,
			includeLayout,
			invitationSet: page.invitationSet ?? 'essential',
			generalSet: page.generalSet ?? 'basic',
			revealHandling: page.revealHandling ?? 'auto',
			animationHandling: page.animationHandling ?? options.animation ?? 'disable',
			sectionCapture: page.sectionCapture ?? 'none',
			sectionSelectors: page.sectionSelectors,
			criticalSelectors:
				page.criticalSelectors && page.criticalSelectors.length > 0
					? page.criticalSelectors
					: getDefaultCriticalSelectors(page.pageType),
			waitSelectors: page.waitSelectors ?? [],
			hideSelectors: page.hideSelectors ?? [],
			authMethod: page.authMethod ?? 'none',
			outputFormat: page.outputFormat ?? config.defaultOutputFormat ?? 'png',
			outputFolderStyle: outputFolder ? 'custom' : outputFolderStyle,
			outputFolder,
		};

		const result = await runScreenshotJob(job);
		if (result.failed > 0) failed++;
	}

	return { failed };
}

// ── Run ──────────────────────────────────────────────────────────────────

main().catch((err) => {
	console.error('\n✕  Fatal error:', err);
	process.exit(1);
});
