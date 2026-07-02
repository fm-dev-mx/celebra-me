// =============================================================================
// CELEBRA-ME | Screenshot Tool — Job Runner
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type ScreenshotJob, type CaptureResult, type JobResult } from './types.js';
import {
	createPageSlug,
	resolveOutputDir,
	ensureDir,
	formatViewport,
	formatDuration,
} from './utils.js';
import {
	launchBrowser,
	createContext,
	captureInvitationScreenshots,
	captureGeneralPageScreenshots,
} from './capture.js';

// =============================================================================
// Main Runner
// =============================================================================

/**
 * Execute a complete screenshot job across all configured viewports.
 *
 * This is the top-level orchestrator:
 *  1. Prepare output directory
 *  2. Launch headless Chromium
 *  3. For each viewport, create a dedicated context and run captures
 *  4. Report results
 */
export async function runScreenshotJob(job: ScreenshotJob): Promise<JobResult> {
	const startTime = Date.now();
	const allCaptures: CaptureResult[] = [];
	const pageSlug = createPageSlug(job.url);

	console.log('');
	console.log('╔══════════════════════════════════════════════════════╗');
	console.log('║        CELEBRA-ME SCREENSHOT TOOL                   ║');
	console.log('╚══════════════════════════════════════════════════════╝');
	console.log('');
	console.log(`  Page:    ${job.url}`);
	console.log(`  Slug:    ${pageSlug}`);
	console.log(`  Type:    ${job.pageType}`);
	console.log(`  Profile: ${job.viewportProfile} (${job.viewports.length} viewport(s))`);
	console.log('');

	// ── 1. Prepare output directory ────────────────────────────────────────
	const outputDir = resolveOutputDir(pageSlug, job.outputFolderStyle, job.outputFolder);
	await ensureDir(outputDir);

	console.log(`  Output:  ${outputDir}/`);
	console.log('');

	// ── 2. Launch browser ──────────────────────────────────────────────────
	let browser;
	try {
		browser = await launchBrowser();
	} catch (err) {
		console.error(`\n  ✕ Failed to launch browser: ${err}`);
		console.error('  ℹ Make sure Playwright browsers are installed:');
		console.error('    pnpm exec playwright install chromium\n');
		return {
			total: 0,
			succeeded: 0,
			failed: 0,
			captures: [],
			outputDir,
			durationMs: Date.now() - startTime,
		};
	}

	// ── 3. Capture each viewport ──────────────────────────────────────────
	try {
		for (let i = 0; i < job.viewports.length; i++) {
			const viewport = job.viewports[i];
			console.log(
				`\n  ─── [${i + 1}/${job.viewports.length}] ${formatViewport(viewport)} ───`,
			);

			const context = await createContext(browser, viewport);
			const page = await context.newPage();

			try {
				let results: CaptureResult[] = [];

				if (job.pageType === 'invitation') {
					results = await captureInvitationScreenshots(
						page,
						job,
						outputDir,
						viewport.name,
					);
				} else {
					results = await captureGeneralPageScreenshots(
						page,
						job,
						outputDir,
						viewport.name,
					);
				}

				allCaptures.push(...results);

				// Log summary for this viewport
				const succeeded = results.filter((r) => r.success).length;
				const failed = results.filter((r) => !r.success).length;
				console.log(`  ─── Done: ${succeeded} captured, ${failed} failed ───`);
			} catch (err) {
				console.error(`  ✕ Error capturing viewport ${viewport.name}: ${err}`);
			} finally {
				await context.close();
			}
		}
	} finally {
		await browser.close();
	}

	// ── 4. Filesystem validation ─────────────────────────────────────────
	const fsManifest = scanOutputDirectory(outputDir);
	const fsFiles = fsManifest.reduce((sum, vp) => sum + vp.files, 0);

	// ── 5. Compile results ────────────────────────────────────────────────
	const durationMs = Date.now() - startTime;
	const succeeded = allCaptures.filter((r) => r.success).length;
	const failed = allCaptures.filter((r) => !r.success).length;

	// Summary
	console.log('');
	console.log('═'.repeat(56));
	console.log('📊  RESULTS');
	console.log('═'.repeat(56));
	console.log(`  Total captures:  ${allCaptures.length}`);
	console.log(`  Successful:      ${succeeded}`);
	console.log(`  Failed:          ${failed}`);
	console.log(`  Duration:        ${formatDuration(durationMs)}`);
	console.log(`  Output:          ${outputDir}/`);
	console.log('');

	// Filesystem manifest
	if (fsManifest.length > 0) {
		console.log('  📁 Filesystem manifest:');
		for (const vp of fsManifest) {
			const status = vp.expected > 0 && vp.files < vp.expected ? ' ⚠' : '';
			console.log(
				`    ${vp.name}/  (${vp.files} files${vp.expected > 0 ? `, expected ~${vp.expected}` : ''})${status}`,
			);
		}
		console.log(`    Total on disk: ${fsFiles} files`);
		console.log('');
	}

	return {
		total: allCaptures.length,
		succeeded,
		failed,
		captures: allCaptures,
		outputDir,
		durationMs,
	};
}

// =============================================================================
// Filesystem Validation
// =============================================================================

interface ViewportManifest {
	name: string;
	files: number;
	expected: number;
}

/**
 * Walk the output directory and return a per-viewport file manifest.
 * Scans immediate subdirectories for .png/.jpg/.webp/.pdf files.
 */
function scanOutputDirectory(outputDir: string): ViewportManifest[] {
	const result: ViewportManifest[] = [];

	try {
		const entries = fs.readdirSync(outputDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const viewportPath = path.join(outputDir, entry.name);
			const files = fs
				.readdirSync(viewportPath)
				.filter((f) => /\.(png|jpg|jpeg|webp|pdf)$/i.test(f));

			// Infer expected file count: if essential invitation set, expect 5 per viewport
			const has05Files = files.some((f) => f.startsWith('05-'));
			const expected = has05Files ? 5 : 2;

			result.push({ name: entry.name, files: files.length, expected });
		}
	} catch {
		// Output directory may not exist yet
	}

	return result.sort((a, b) => a.name.localeCompare(b.name));
}
