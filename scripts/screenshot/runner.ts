/* eslint-disable max-lines -- Job runner owns browser lifecycle, viewport loop, and report assembly. */
// CELEBRA-ME | Screenshot Tool — Job Runner

import sharp from 'sharp';
import type { Page, Request } from 'playwright';
import {
	type ScreenshotJob,
	type CaptureResult,
	type JobResult,
	type ScreenshotRunReport,
	type ViewportRunReport,
	type RequestFailureReport,
	type SelectorValidationReport,
	type ScreenshotWarning,
	type BlankBottomValidation,
	type SectionCoverageReport,
} from './types.js';
import { deriveSectionInventory } from './inventory.js';
import {
	createPageSlug,
	resolveOutputDir,
	ensureDir,
	formatViewport,
	formatDuration,
	writeScreenshotReport,
	buildCurrentRunManifest,
	classifyConsoleError,
	validateBlankBottom,
	getFileArtifactMeta,
	removeLegacyInvitationFullOpenArtifacts,
} from './utils.js';
import {
	launchBrowser,
	createContext,
	captureInvitationScreenshots,
	captureGeneralPageScreenshots,
} from './capture.js';

interface SingleViewportCaptureResult {
	captures: CaptureResult[];
	plannedCaptures: number;
	plannedTasks?: Array<{ id: string; required: boolean }>;
	report: ViewportRunReport;
}

/**
 * Capture a single viewport: create a page context, run captures, build report.
 */
async function captureSingleViewport(
	browser: import('playwright').Browser,
	job: ScreenshotJob,
	outputDir: string,
	viewport: ScreenshotJob['viewports'][number],
): Promise<SingleViewportCaptureResult> {
	const context = await createContext(browser, viewport);
	const page = await context.newPage();
	const consoleErrors: string[] = [];
	const requestFailures: RequestFailureReport[] = [];

	page.on('console', (message) => {
		if (message.type() === 'error') {
			consoleErrors.push(message.text());
		}
	});
	page.on('pageerror', (error) => {
		consoleErrors.push(`pageerror: ${error.stack || error.message}`);
	});
	page.on('requestfailed', (request) => {
		requestFailures.push(classifyRequestFailure(request));
	});

	try {
		const { results, plannedCount } = await (job.pageType === 'invitation'
			? captureInvitationScreenshots(page, job, outputDir, viewport.name)
			: captureGeneralPageScreenshots(page, job, outputDir, viewport.name));

		const viewportReport = await buildViewportReport({
			page,
			job,
			viewport,
			results,
			consoleErrors,
			requestFailures,
		});

		if (viewportReport.sectionCoverage) {
			const cov = viewportReport.sectionCoverage;
			console.log(`  ─── Section Coverage Matrix (${viewport.name}) ───`);
			console.log(`    Expected sections:   ${cov.expectedCount}`);
			console.log(`    Rendered sections:   ${cov.renderedCount}`);
			console.log(`    Planned captures:    ${cov.plannedCount}`);
			console.log(`    Successful captures: ${cov.successfulCount}`);
			console.log(
				`    Missing sections:    ${cov.missingSections.length > 0 ? cov.missingSections.join(', ') : 'none'}`,
			);
			console.log(
				`    Duplicate sections:  ${cov.duplicateSections.length > 0 ? cov.duplicateSections.join(', ') : 'none'}`,
			);
		}

		// Log summary for this viewport
		const succeeded = results.filter((r) => r.success).length;
		const failed = viewportReport.failures.length;
		const warningsCount =
			viewportReport.warnings.length + (viewportReport.detailedWarnings?.length ?? 0);
		const noticesCount = viewportReport.notices?.length ?? 0;
		const blockingErrorsCount = viewportReport.failures.filter(
			(f) => f.includes('blocking') || f.includes('Critical'),
		).length;
		let summaryParts = `Done: ${succeeded} captured`;
		if (failed > 0) summaryParts += `, ${failed} failed`;
		if (warningsCount > 0) summaryParts += `, ${warningsCount} warning(s)`;
		if (noticesCount > 0) summaryParts += `, ${noticesCount} notice(s)`;
		if (blockingErrorsCount > 0) summaryParts += `, ${blockingErrorsCount} blocking error(s)`;
		console.log(`  ─── ${summaryParts} ───`);

		return {
			captures: results,
			plannedCaptures: plannedCount,
			plannedTasks: results.map((r) => ({ id: r.id ?? '', required: !r.isOptional })),
			report: viewportReport,
		};
	} catch (err) {
		console.error(`  ✕ Error capturing viewport ${viewport.name}: ${err}`);
		return {
			captures: [],
			plannedCaptures: 0,
			plannedTasks: [],
			report: {
				name: viewport.name,
				width: viewport.width,
				height: viewport.height,
				deviceScaleFactor: viewport.deviceScaleFactor,
				documentHeight: 0,
				outputFiles: [],
				criticalSelectors: [],
				warnings: [],
				failures: [String(err)],
				consoleErrors: consoleErrors.map(classifyConsoleError),
				requestFailures,
			},
		};
	} finally {
		await context.close();
	}
}

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
	const startedAt = new Date().toISOString();
	const allCaptures: CaptureResult[] = [];
	const viewportReports: ViewportRunReport[] = [];
	const pageSlug = createPageSlug(job.url);

	console.log('');
	console.log('╔══════════════════════════════════════════════════════╗');
	console.log('║        CELEBRA-ME SCREENSHOT TOOL                   ║');
	console.log('╚══════════════════════════════════════════════════════╝');
	console.log('');
	console.log(`  Page:    ${job.url}`);
	console.log(`  Slug:    ${pageSlug}`);
	console.log(`  Type:    ${job.pageType}`);
	console.log(`  Mode:    ${job.mode}`);
	console.log(`  Profile: ${job.viewportProfile} (${job.viewports.length} viewport(s))`);
	console.log('');

	// ── 1. Prepare output directory ────────────────────────────────────────
	const outputDir = resolveOutputDir(pageSlug, job.outputFolderStyle, job.outputFolder);
	await ensureDir(outputDir);

	if (job.pageType === 'invitation') {
		const removedLegacy = await removeLegacyInvitationFullOpenArtifacts(outputDir);
		if (removedLegacy.length > 0) {
			console.log(
				`  🧹 Removed ${removedLegacy.length} legacy 05-invitation-full-open artifact(s)`,
			);
		}
	}

	console.log(`  Output:  ${outputDir}/`);
	// Sequential viewports avoid Vite optimize-dep races against `pnpm dev`.
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
			failed: 1, // blocking runtime error
			captures: [],
			outputDir,
			durationMs: Date.now() - startTime,
		};
	}

	// ── 3. Capture each viewport ──────────────────────────────────────────
	const perViewportPlanned: Record<string, number> = {};
	const perViewportPlannedTasks: Record<string, Array<{ id: string; required: boolean }>> = {};

	try {
		for (let i = 0; i < job.viewports.length; i++) {
			const viewport = job.viewports[i];
			console.log(
				`\n  ─── [${i + 1}/${job.viewports.length}] ${formatViewport(viewport)} ───`,
			);

			const result = await captureSingleViewport(browser, job, outputDir, viewport);
			allCaptures.push(...result.captures);
			viewportReports.push(result.report);
			perViewportPlanned[viewport.name] = result.plannedCaptures;
			perViewportPlannedTasks[viewport.name] = result.plannedTasks ?? [];
		}
	} finally {
		await browser.close();
	}

	// ── 4. Current-run manifest ──────────────────────────────────────────
	const manifest = buildCurrentRunManifest({
		viewports: job.viewports,
		captures: allCaptures,
		perViewportPlanned,
		perViewportPlannedTasks,
		target: job.target,
	});
	const manifestFiles = manifest.reduce((sum, vp) => sum + vp.files, 0);

	// ── 5. Compile results ────────────────────────────────────────────────
	const durationMs = Date.now() - startTime;
	const succeeded = allCaptures.filter((r) => r.success).length;
	const captureFailed = allCaptures.filter((r) => !r.success).length;
	const warnings = viewportReports.flatMap((report) => report.warnings);
	const detailedWarnings = viewportReports.flatMap((report) => report.detailedWarnings ?? []);
	const notices = viewportReports.flatMap((report) => report.notices ?? []);
	const blankBottomValidations = viewportReports.flatMap(
		(report) => report.blankBottomValidations ?? [],
	);
	const failures = viewportReports.flatMap((report) => report.failures);
	const fallbacks = viewportReports.flatMap((report) =>
		report.fallback ? [report.fallback] : [],
	);
	const stitchFailures = viewportReports.flatMap((report) => report.stitchFailures ?? []);
	const manifestFailures = manifest
		.filter((viewportManifest) => viewportManifest.status === 'failed')
		.map(
			(viewportManifest) =>
				`Manifest failed for ${viewportManifest.name}: generated ${viewportManifest.files} of expected ${viewportManifest.expected} capture(s).`,
		);
	const failed = failures.length + manifestFailures.length;
	const blockingErrors = Math.max(0, failures.length - captureFailed) + manifestFailures.length;

	// Separate required vs optional captures for unambiguous summary reporting.
	const requiredCaptures = allCaptures.filter((r) => !r.isOptional);
	const optionalOmitted = allCaptures.filter((r) => r.isOptional && !r.success).length;

	const reportStatus: ScreenshotRunReport['status'] =
		failed > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed';

	const report: ScreenshotRunReport = {
		route: job.url,
		mode: job.mode,
		startedAt,
		durationMs,
		status: reportStatus,
		viewports: viewportReports,
		manifest,
		warnings,
		detailedWarnings,
		notices,
		blankBottomValidations,
		failures: [...failures, ...manifestFailures],
		...(fallbacks.length > 0 ? { fallback: fallbacks[0], stitchFailures } : {}),
	};
	const reportPath = await writeScreenshotReport(outputDir, report);

	// Summary
	console.log('');
	console.log('═'.repeat(56));
	console.log('📊  RESULTS');
	console.log('═'.repeat(56));
	console.log(`  Required captures: ${requiredCaptures.length}`);
	console.log(`  Successful:        ${requiredCaptures.filter((r) => r.success).length}`);
	console.log(`  Failed:            ${failed}`);
	if (optionalOmitted > 0) {
		console.log(`  Optional omitted:  ${optionalOmitted} (see notices)`);
	}
	console.log(`  Warnings:        ${warnings.length}`);
	console.log(`  Notices:         ${notices.length}`);
	console.log(`  Blocking errors: ${blockingErrors}`);
	console.log(`  Duration:        ${formatDuration(durationMs)}`);
	console.log(`  Output:          ${outputDir}/`);
	console.log(`  Report:          ${reportPath}`);
	console.log('');

	if (notices.length > 0) {
		console.log('═'.repeat(56));
		console.log('ℹ️  INFO / NOTICES');
		console.log('═'.repeat(56));
		for (const n of notices) {
			console.log(`  ℹ  ${n}`);
		}
		console.log('');
	}

	if (detailedWarnings.length > 0) {
		console.log('═'.repeat(56));
		console.log('⚠️  WARNINGS');
		console.log('═'.repeat(56));
		for (const w of detailedWarnings) {
			const typeStr = w.expected ? 'Expected' : 'UNEXPECTED';
			const vpStr = w.viewport ? ` [${w.viewport}]` : '';
			console.log(`  ⚠ [${typeStr}]${vpStr}: ${w.message}`);
		}
		console.log('');
	}

	// Current-run manifest
	if (manifest.length > 0) {
		console.log('  📁 Current-run manifest:');
		for (const vp of manifest) {
			const status = vp.status !== 'passed' ? ' ⚠' : '';
			console.log(`    ${vp.name}/  (${vp.files} files, expected ${vp.expected})${status}`);
		}
		console.log(`    Total generated this run: ${manifestFiles} files`);
		console.log('');
	}

	return {
		total: allCaptures.length,
		succeeded,
		failed,
		captures: allCaptures,
		outputDir,
		durationMs,
		report,
	};
}

// =============================================================================
// Viewport Report Builder
// =============================================================================

async function buildViewportReport({
	page,
	job,
	viewport,
	results,
	consoleErrors,
	requestFailures,
}: {
	page: Page;
	job: ScreenshotJob;
	viewport: ScreenshotJob['viewports'][number];
	results: CaptureResult[];
	consoleErrors: string[];
	requestFailures: RequestFailureReport[];
}): Promise<ViewportRunReport> {
	const warnings: string[] = [];
	const notices: string[] = [];
	const captureFailures: string[] = [];
	const documentHeight = await getDocumentHeight(page);
	const fallback = results.find((result) => result.fallback)?.fallback;
	const stitchFailures = results.flatMap((result) => result.stitchFailures ?? []);
	const outputFiles = await Promise.all(
		results
			.filter((result) => result.success)
			.map(async (result) => {
				const metadata = await readImageMetadata(result.path);
				const artifactMeta = await getFileArtifactMeta(result.path).catch(() => undefined);

				return {
					path: result.path,
					label: result.label,
					width: metadata.width,
					height: metadata.height,
					hash: result.hash ?? artifactMeta?.hash,
					sizeBytes: result.sizeBytes ?? artifactMeta?.sizeBytes,
					mtimeMs: result.mtimeMs ?? artifactMeta?.mtimeMs,
					strategy: result.strategy,
					verificationStatus: result.verificationStatus ?? 'passed',
				};
			}),
	);
	const detailedWarnings: ScreenshotWarning[] = [];
	const blankBottomValidations: BlankBottomValidation[] = [];

	// Post-capture overwrite check: verify artifact hashes have not changed
	for (const file of outputFiles) {
		if (file.hash) {
			const currentMeta = await getFileArtifactMeta(file.path).catch(() => undefined);
			if (!currentMeta || currentMeta.hash !== file.hash) {
				captureFailures.push(
					`FULL_PAGE_ARTIFACT_OVERWRITTEN: Artifact ${file.path} was overwritten or modified after verification.`,
				);
			}
		}
	}

	// Track capture failures (not validation issues)
	for (const result of results) {
		if (!result.success) {
			if (result.isOptional) {
				notices.push(
					`Optional capture "${result.label}" omitted: ${result.error ?? 'not supported'}`,
				);
			} else {
				captureFailures.push(`${result.label}: ${result.error ?? 'capture failed'}`);
			}
		}
	}

	await validateFullPageBlanks(
		outputFiles,
		blankBottomValidations,
		detailedWarnings,
		warnings,
		job.url,
		viewport.name,
	);
	const { criticalSelectors, blockingErrors } = await collectSelectorAndRequestWarnings(
		page,
		job,
		requestFailures,
		consoleErrors,
		detailedWarnings,
		warnings,
		notices,
		viewport.name,
	);
	captureFailures.push(...blockingErrors);
	const classifiedConsoleErrors = consoleErrors.map(classifyConsoleError);

	const auditNormalizations = await readAuditNormalizations(page);
	for (const norm of auditNormalizations) {
		const msg = `Audit normalization: ${norm}`;
		notices.push(msg);
	}

	appendExpectedOutputFailures(captureFailures, job, results, outputFiles);

	// Physical dimension check on full-page captures — fail if viewport-sized on multi-viewport page
	appendFullPageDimensionFailures(captureFailures, outputFiles, documentHeight, viewport);

	if (documentHeight < viewport.height) {
		warnings.push(
			`Document height ${documentHeight}px is shorter than viewport height ${viewport.height}px.`,
		);
	}

	let sectionCoverage: SectionCoverageReport | undefined;

	if (job.pageType === 'invitation') {
		const inventory = await deriveSectionInventory(page);
		sectionCoverage = buildSectionCoverage(inventory, results, captureFailures);
	}

	return {
		name: viewport.name,
		width: viewport.width,
		height: viewport.height,
		deviceScaleFactor: viewport.deviceScaleFactor,
		documentHeight,
		outputFiles,
		criticalSelectors,
		sectionCoverage,
		warnings,
		detailedWarnings,
		notices,
		...(fallback ? { fallback } : {}),
		...(stitchFailures.length > 0 ? { stitchFailures } : {}),
		blankBottomValidations,
		failures: captureFailures,
		consoleErrors: classifiedConsoleErrors,
		requestFailures,
	};
}

function appendFullPageDimensionFailures(
	captureFailures: string[],
	outputFiles: Array<{ path: string; label: string; width?: number; height?: number }>,
	documentHeight: number,
	viewport: ScreenshotJob['viewports'][number],
): void {
	for (const file of outputFiles.filter((outputFile) =>
		isFullPageCaptureLabel(outputFile.label),
	)) {
		if (!file.width || !file.height) {
			captureFailures.push(
				`FULL_PAGE_CAPTURE_FAILED: Could not read image dimensions for ${file.path}`,
			);
			continue;
		}
		const viewportPixelWidth = Math.round(viewport.width * viewport.deviceScaleFactor);
		const viewportPixelHeight = Math.round(viewport.height * viewport.deviceScaleFactor);

		if (file.width < viewportPixelWidth) {
			captureFailures.push(
				`FULL_PAGE_DIMENSION_MISMATCH: ${file.path} width ${file.width}px is smaller than viewport width ${viewportPixelWidth}px`,
			);
		}

		if (
			documentHeight > viewport.height + 20 &&
			Math.abs(file.height - viewportPixelHeight) <= 10
		) {
			captureFailures.push(
				`FULL_PAGE_DIMENSION_MISMATCH: ${file.path} height ${file.height}px is equal to single viewport height (${viewportPixelHeight}px) for multi-viewport page (${documentHeight}px CSS height).`,
			);
		}
	}
}

// =============================================================================
// Helper Functions — Extracted to Reduce Cognitive Complexity
// =============================================================================

/**
 * Build section coverage report from a section inventory and capture results.
 * Mutates captureFailures when sections are missing or duplicate roots are detected.
 */
function buildSectionCoverage(
	inventory: Awaited<ReturnType<typeof deriveSectionInventory>>,
	results: CaptureResult[],
	captureFailures: string[],
): SectionCoverageReport {
	const sectionResults = results.filter((r) => r.label.startsWith('Section:'));
	const missingSections: string[] = [];

	for (const sec of inventory.sections) {
		const found = results.some(
			(r) => r.success && (r.path.includes(`-${sec.id}.`) || r.label.includes(sec.label)),
		);
		if (!found) {
			missingSections.push(sec.id);
			captureFailures.push(`Missing section capture for required section "${sec.id}".`);
		}
	}

	for (const dup of inventory.duplicates) {
		captureFailures.push(`Duplicate section root detected in DOM: "${dup}".`);
	}

	return {
		expectedCount: inventory.expected,
		renderedCount: inventory.rendered,
		plannedCount: sectionResults.length,
		successfulCount: sectionResults.filter((r) => r.success).length,
		missingSections,
		duplicateSections: inventory.duplicates,
		sections: inventory.sections.map((sec) => {
			const match = results.find(
				(r) => r.success && (r.path.includes(`-${sec.id}.`) || r.label.includes(sec.label)),
			);
			return {
				id: sec.id,
				order: sec.order,
				label: sec.label,
				selector: sec.selector,
				status: match ? 'captured' : 'missing',
				file: match?.path,
			};
		}),
	};
}

/**
 * Validate blank bottom on full-page captures.
 * Results go to blankBottomValidations, detailedWarnings, and warnings arrays.
 */
function appendExpectedOutputFailures(
	captureFailures: string[],
	job: ScreenshotJob,
	results: CaptureResult[],
	outputFiles: Array<{ label: string }>,
): void {
	const successfulOutputCount = outputFiles.length;
	const successfulFullPageCount = outputFiles.filter((outputFile) =>
		isFullPageCaptureLabel(outputFile.label),
	).length;

	if (job.target === 'all-sections' && results.length === 0) {
		captureFailures.push(
			`No capturable sections resolved for ${job.pageType} route ${job.url}.`,
		);
	}

	if (job.target === 'single-section' && results.length === 0) {
		captureFailures.push(
			`Selected section "${job.selectedSection ?? 'unknown'}" could not be resolved for ${job.pageType} route ${job.url}.`,
		);
	}

	if (job.target === 'full-page' && successfulFullPageCount == 0) {
		captureFailures.push(
			`Full-page target produced no successful full-page capture for ${job.pageType} route ${job.url}.`,
		);
	}

	if (expectsScreenshotOutput(job.target) && successfulOutputCount === 0) {
		captureFailures.push(
			`Screenshot target "${job.target}" produced zero output files for ${job.pageType} route ${job.url}.`,
		);
	}
}

async function validateFullPageBlanks(
	outputFiles: Array<{ path: string }>,
	blankBottomValidations: BlankBottomValidation[],
	detailedWarnings: ScreenshotWarning[],
	warnings: string[],
	targetUrl: string,
	viewportName: string,
): Promise<void> {
	for (const file of outputFiles) {
		const isFullPage =
			file.path.includes('02-full-page') ||
			file.path.includes('01-initial-full-page') ||
			file.path.includes('05-invitation-full-page') ||
			file.path.includes('05-invitation-full-open');
		if (!isFullPage) continue;

		const check = await validateBlankBottom(file.path);
		blankBottomValidations.push(check);
		if (check.trailingBlankSpaceDetected) {
			detailedWarnings.push({
				message: `Trailing blank space detected in full page: ${check.note}`,
				target: targetUrl,
				viewport: viewportName,
				expected: false,
			});
			warnings.push(`Trailing blank space detected in full page: ${check.note}`);
		}
	}
}

/**
 * Collect selector, request, and console warnings.
 * Returns the critical selectors validation report array.
 * Critical/page errors that are NOT dev-transpiler issues are returned so
 * the caller can promote them to failures that affect exit code.
 */
async function collectSelectorAndRequestWarnings(
	page: Page,
	job: ScreenshotJob,
	requestFailures: RequestFailureReport[],
	consoleErrors: string[],
	detailedWarnings: ScreenshotWarning[],
	warnings: string[],
	notices: string[],
	viewportName: string,
): Promise<{ criticalSelectors: SelectorValidationReport[]; blockingErrors: string[] }> {
	const blockingErrors: string[] = [];

	// Critical selectors — reclassify "Optional selector not found" as notices
	const criticalSelectors = await validateCriticalSelectors(page, job.criticalSelectors);

	for (const selector of criticalSelectors) {
		for (const w of selector.warnings ?? []) {
			if (
				w.startsWith('Optional selector not found:') ||
				w.startsWith('Optional selector is not visibly ready:')
			) {
				notices.push(w);
			} else {
				detailedWarnings.push({
					message: w,
					target: job.url,
					viewport: viewportName,
					expected: true,
				});
				warnings.push(w);
			}
		}

		for (const failure of selector.failures ?? []) {
			detailedWarnings.push({
				message: failure,
				target: job.url,
				viewport: viewportName,
				expected: true,
			});
			blockingErrors.push(failure);
		}
	}

	// Request failures — all go to warnings
	for (const failure of requestFailures) {
		const msg = `${failure.severity === 'critical' ? 'Critical' : 'Non-critical'} request failed: ${failure.method} ${failure.url} :: ${failure.errorText}`;
		detailedWarnings.push({
			message: msg,
			target: job.url,
			viewport: viewportName,
			expected: false,
		});
		warnings.push(msg);
	}

	// Console errors — deduplicate by message, then classify
	const seenConsoleMessages = new Set<string>();
	for (const raw of consoleErrors) {
		// Deduplicate: normalize by stripping stack lines and extra whitespace
		const normalized = raw
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith('at '))
			.join(' | ');
		if (seenConsoleMessages.has(normalized)) continue;
		seenConsoleMessages.add(normalized);

		const classified = classifyConsoleError(raw);
		const msg = `Console ${classified.severity} (${classified.source}; production risk ${classified.productionRisk}; screenshot reliability ${classified.affectsScreenshotReliability ? 'affected' : 'not affected'}): ${classified.message} — ${classified.note}`;
		detailedWarnings.push({
			message: msg,
			target: job.url,
			viewport: viewportName,
			expected: classified.source === 'test-runner-transpiler',
		});
		warnings.push(msg);

		// Critical console errors from app code (not dev-transpiler) are blocking
		if (classified.severity === 'critical' && classified.source !== 'test-runner-transpiler') {
			blockingErrors.push(msg);
		}
	}

	return { criticalSelectors, blockingErrors };
}

function isFullPageCaptureLabel(label: string): boolean {
	return (
		label === 'Full page' ||
		label === 'Initial full page' ||
		label === 'Initial full page (closed)' ||
		label === 'Full invitation (open)'
	);
}

function expectsScreenshotOutput(target: ScreenshotJob['target']): boolean {
	return (
		target === 'critical-qa' ||
		target === 'full-page' ||
		target === 'all-sections' ||
		target === 'single-section'
	);
}

async function readImageMetadata(filePath: string): Promise<{ width?: number; height?: number }> {
	try {
		const metadata = await sharp(filePath).metadata();
		return { width: metadata.width, height: metadata.height };
	} catch {
		return {};
	}
}

async function readAuditNormalizations(page: Page): Promise<string[]> {
	try {
		return await page.evaluate(() => {
			return (
				(
					window as Window & {
						__screenshotAuditNormalizations?: string[];
					}
				).__screenshotAuditNormalizations ?? []
			);
		});
	} catch {
		return [];
	}
}

async function getDocumentHeight(page: Page): Promise<number> {
	try {
		return await page.evaluate(() =>
			Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
		);
	} catch {
		return 0;
	}
}

/**
 * Minimal runtime guard for SelectorValidationReport[] returned from
 * page.evaluate. Checks that the value is an array and each element
 * has a string `selector` field — sufficient to distinguish valid
 * results from null/undefined/broken-shape data crossing the page boundary.
 */
function isSelectorValidationReportArray(value: unknown): value is SelectorValidationReport[] {
	return (
		Array.isArray(value) &&
		value.every(
			(item) =>
				item !== null &&
				typeof item === 'object' &&
				typeof (item as Record<string, unknown>).selector === 'string',
		)
	);
}

async function validateCriticalSelectors(
	page: Page,
	selectors: ScreenshotJob['criticalSelectors'],
): Promise<SelectorValidationReport[]> {
	const script = `
		(() => {
			const selectorConfigs = ${JSON.stringify(selectors)};
			const preState = window.__screenshotPreNormalizationVisibility || {};
			const isElementVisiblyRendered = (element) => {
				const style = window.getComputedStyle(element);
				const box = element.getBoundingClientRect();
				if (
					style.display === 'none' ||
					style.visibility === 'hidden' ||
					Number.parseFloat(style.opacity || '1') <= 0.01 ||
					box.width <= 0 ||
					box.height <= 0
				) {
					return false;
				}

				let parent = element.parentElement;
				while (parent) {
					const parentStyle = window.getComputedStyle(parent);
					if (
						parent.hidden ||
						parentStyle.display === 'none' ||
						parentStyle.visibility === 'hidden'
					) {
						return false;
					}
					parent = parent.parentElement;
				}

				return true;
			};

			return selectorConfigs.map((config) => {
				const warnings = [];
				const failures = [];
				const element = document.querySelector(config.selector);
				const visibleBeforeNormalization = preState[config.selector];

				if (!element) {
					if (config.required) failures.push('Critical selector not found: ' + config.selector);
					else warnings.push('Optional selector not found: ' + config.selector);
					return {
						selector: config.selector,
						required: config.required,
						label: config.label,
						visibleBeforeNormalization,
						visibleAfterNormalization: false,
						status: config.required ? 'failed' : 'warning',
						warnings,
						failures,
					};
				}

				const style = window.getComputedStyle(element);
				const box = element.getBoundingClientRect();
				const hiddenByStyle =
					style.display === 'none' ||
					style.visibility === 'hidden' ||
					Number.parseFloat(style.opacity || '1') <= 0.01;
				const blurred = style.filter.includes('blur') && !style.filter.includes('blur(0');
				const visibleAfterNormalization =
					!hiddenByStyle && !blurred && box.width > 0 && box.height > 0;

				if (!visibleAfterNormalization) {
					const message = 'Critical selector is not visibly ready: ' + config.selector;
					if (config.required) failures.push(message);
					else warnings.push('Optional selector is not visibly ready: ' + config.selector);
				}

				if (visibleBeforeNormalization === false && visibleAfterNormalization) {
					warnings.push('Critical selector visible only after screenshot normalization: ' + config.selector);
				}

				const unloadedImages = Array.from(element.querySelectorAll('img')).filter(
					(img) => isElementVisiblyRendered(img) && (!img.complete || img.naturalWidth <= 0),
				);
				if (unloadedImages.length > 0) {
					const message = 'Images inside selector are not fully loaded: ' + config.selector;
					if (config.required) failures.push(message);
					else warnings.push(message);
				}

				return {
					selector: config.selector,
					required: config.required,
					label: config.label,
					visibleBeforeNormalization,
					visibleAfterNormalization,
					status: failures.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
					warnings,
					failures,
				};
			});
		})()
	`;
	const result = await page.evaluate(script);
	return isSelectorValidationReportArray(result) ? result : [];
}

function classifyRequestFailure(request: Request): RequestFailureReport {
	const url = request.url();
	const errorText = request.failure()?.errorText ?? 'unknown';
	const severity = isCriticalRequest(url) ? 'critical' : 'warning';

	return {
		url,
		method: request.method(),
		errorText,
		severity,
	};
}

function isCriticalRequest(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
			if (parsed.pathname.includes('/node_modules/.vite/deps/')) return false;
			return /\.(css|js|mjs|ts|tsx|astro|png|jpg|jpeg|webp|gif|svg|avif|woff2?|ttf|otf)$/i.test(
				parsed.pathname,
			);
		}

		return false;
	} catch {
		return true;
	}
}
