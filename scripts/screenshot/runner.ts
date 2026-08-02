/* eslint-disable max-lines -- Job runner owns browser lifecycle, viewport loop, and report assembly. */
// CELEBRA-ME | Screenshot Tool — Job Runner

import sharp from 'sharp';
import * as fs from 'node:fs/promises';
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
	ensureDir,
	formatViewport,
	formatDuration,
	writeScreenshotReport,
	writeScreenshotPreflight,
	buildCurrentRunManifest,
	classifyConsoleError,
	dedupeScreenshotNotices,
	computeScreenshotBlockingErrors,
	expectsScreenshotOutput,
	resolveScreenshotRunStatus,
	validateBlankBottom,
	getDocumentHeight,
	getFileArtifactMeta,
	removeLegacyInvitationFullOpenArtifacts,
} from './utils.js';
import { validateResolvedCleanupTargets } from './scope.js';
import type { ResolvedScreenshotPlan } from './scope.js';
import {
	launchBrowser,
	createContext,
	captureInvitationScreenshots,
	captureGeneralPageScreenshots,
	type PlannedCaptureTask,
} from './capture.js';

interface SingleViewportCaptureResult {
	captures: CaptureResult[];
	plannedCaptures: number;
	plannedTasks: PlannedCaptureTask[];
	report: ViewportRunReport;
}

async function cleanResolvedScope(plan: ResolvedScreenshotPlan): Promise<void> {
	for (const target of plan.cleanupTargets) {
		const stat = await fs.lstat(target).catch(() => undefined);
		if (!stat) continue;
		if (stat.isDirectory()) {
			throw new Error(
				`Refusing to clean directory target; expected an owned file: ${target}`,
			);
		}
		await fs.rm(target, { force: true });
		console.log(`  Cleaned planned artifact: ${target}`);
	}
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
	const context = await createContext(browser, viewport, { authMethod: job.authMethod });
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
		const { results, plannedCount, plannedTasks } = await (job.pageType === 'invitation'
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
		const succeeded = results.filter((r) => r.success && !r.isOptional).length;
		const captureFailed = viewportReport.captureFailures?.length ?? 0;
		const validationFailed = viewportReport.validationFailures?.length ?? 0;
		const warningsCount =
			viewportReport.warnings.length + (viewportReport.detailedWarnings?.length ?? 0);
		const noticesCount = viewportReport.notices?.length ?? 0;
		let summaryParts = `Done: ${succeeded} required captured`;
		if (captureFailed > 0) summaryParts += `, ${captureFailed} capture failed`;
		if (validationFailed > 0) summaryParts += `, ${validationFailed} validation failed`;
		if (warningsCount > 0) summaryParts += `, ${warningsCount} warning(s)`;
		if (noticesCount > 0) summaryParts += `, ${noticesCount} notice(s)`;
		console.log(`  ─── ${summaryParts} ───`);

		return {
			captures: results,
			plannedCaptures: plannedCount,
			plannedTasks,
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
				captureFailures: [String(err)],
				validationFailures: [],
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
	console.log(`  Base:    ${job.baseUrl}`);
	console.log(`  Slug:    ${pageSlug}`);
	console.log(`  Type:    ${job.pageType}`);
	console.log(`  Mode:    ${job.mode}`);
	console.log(`  Profile: ${job.viewportProfile} (${job.viewports.length} viewport(s))`);
	console.log('');

	// ── 1. Prepare output directory ────────────────────────────────────────
	if (!job.scope?.invitations[0]) {
		throw new Error(
			'Screenshot job has no resolved scope. Resolve it before launching the runner.',
		);
	}
	const outputDir = job.scope.invitations[0].outputDir;
	if (job.scope) {
		validateResolvedCleanupTargets(job.scope);
	}
	if (job.scope?.clean) {
		await cleanResolvedScope(job.scope);
	}
	await ensureDir(outputDir);
	if (job.scope) {
		const preflightPath = await writeScreenshotPreflight(outputDir, job.scope);
		console.log(`  Preflight plan: ${preflightPath}`);
		console.log(`  Planned scope: ${job.scope.tasks.length} exact task artifact(s)`);
		console.log(`  Resolved plan:\n${JSON.stringify(job.scope, null, 2)}`);
	}

	if (job.pageType === 'invitation') {
		const legacyTargets = job.scope?.invitations[0]?.cleanupTargets.filter((target) =>
			target.includes('05-invitation-full-open.'),
		);
		const removedLegacy = legacyTargets
			? await removeLegacyInvitationFullOpenArtifacts(legacyTargets)
			: [];
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
			captureFailed: 1,
			validationFailed: 0,
			manifestFailed: 0,
			blockingErrors: 1,
			captures: [],
			outputDir,
			durationMs: Date.now() - startTime,
		};
	}

	// ── 3. Capture each viewport ──────────────────────────────────────────
	const perViewportPlanned: Record<string, number> = {};
	const perViewportPlannedTasks: Record<string, PlannedCaptureTask[]> = {};

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
			perViewportPlannedTasks[viewport.name] = result.plannedTasks;
		}
	} finally {
		await browser.close();
	}

	return finalizeScreenshotJobResult({
		job,
		startedAt,
		startTime,
		outputDir,
		allCaptures,
		viewportReports,
		perViewportPlanned,
		perViewportPlannedTasks,
	});
}

async function finalizeScreenshotJobResult(input: {
	job: ScreenshotJob;
	startedAt: string;
	startTime: number;
	outputDir: string;
	allCaptures: CaptureResult[];
	viewportReports: ViewportRunReport[];
	perViewportPlanned: Record<string, number>;
	perViewportPlannedTasks: Record<string, PlannedCaptureTask[]>;
}): Promise<JobResult> {
	const {
		job,
		startedAt,
		startTime,
		outputDir,
		allCaptures,
		viewportReports,
		perViewportPlanned,
		perViewportPlannedTasks,
	} = input;

	const manifest = buildCurrentRunManifest({
		viewports: job.viewports,
		captures: allCaptures,
		perViewportPlanned,
		perViewportPlannedTasks,
		target: job.target,
	});
	const manifestFiles = manifest.reduce((sum, vp) => sum + vp.files, 0);

	const durationMs = Date.now() - startTime;
	const requiredCaptures = allCaptures.filter((r) => !r.isOptional);
	const succeeded = requiredCaptures.filter((r) => r.success).length;
	const captureFailureMessages = requiredCaptures
		.filter((r) => !r.success)
		.map((r) => `${r.viewportName}/${r.id ?? r.label}: ${r.error ?? 'capture failed'}`);
	const captureFailed = captureFailureMessages.length;

	const validationFailureMessages = viewportReports.flatMap(
		(report) => report.validationFailures ?? [],
	);
	const validationFailed = validationFailureMessages.length;

	const warnings = viewportReports.flatMap((report) => report.warnings);
	const detailedWarnings = viewportReports.flatMap((report) => report.detailedWarnings ?? []);
	const notices = dedupeScreenshotNotices(
		viewportReports.flatMap((report) => report.notices ?? []),
	);
	const blankBottomValidations = viewportReports.flatMap(
		(report) => report.blankBottomValidations ?? [],
	);
	const fallbacks = viewportReports.flatMap((report) =>
		report.fallback ? [report.fallback] : [],
	);
	const stitchFailures = viewportReports.flatMap((report) => report.stitchFailures ?? []);
	const manifestFailures = manifest
		.filter((viewportManifest) => viewportManifest.status === 'failed')
		.map(
			(viewportManifest) =>
				`Manifest failed for ${viewportManifest.name}: verified ${viewportManifest.requiredVerified ?? 0} of ${viewportManifest.requiredExpected ?? viewportManifest.expected} required capture(s)` +
				(viewportManifest.missingRequiredTaskIds?.length
					? ` (missing: ${viewportManifest.missingRequiredTaskIds.join(', ')})`
					: '') +
				`.`,
		);
	const manifestFailed = manifestFailures.length;
	const blockingErrors = computeScreenshotBlockingErrors({
		captureFailed,
		validationFailed,
		manifestFailed,
	});
	const failed = blockingErrors;
	const optionalOmitted = allCaptures.filter((r) => r.isOptional && !r.success).length;

	const reportStatus: ScreenshotRunReport['status'] = resolveScreenshotRunStatus({
		failed,
		succeeded,
		warnings: warnings.length,
	});

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
		captureFailures: captureFailureMessages,
		validationFailures: validationFailureMessages,
		manifestFailures,
		failures: [...captureFailureMessages, ...validationFailureMessages, ...manifestFailures],
		scope: job.scope,
		...(fallbacks.length > 0 ? { fallback: fallbacks[0], stitchFailures } : {}),
	};
	const reportPath = await writeScreenshotReport(outputDir, report);

	printScreenshotJobSummary({
		requiredCount: requiredCaptures.length,
		succeeded,
		captureFailed,
		validationFailed,
		manifestFailed,
		optionalOmitted,
		warnings,
		notices,
		detailedWarnings,
		blockingErrors,
		durationMs,
		outputDir,
		reportPath,
		manifest,
		manifestFiles,
	});

	return {
		total: requiredCaptures.length,
		succeeded,
		failed,
		captureFailed,
		validationFailed,
		manifestFailed,
		blockingErrors,
		warningCount: warnings.length,
		noticeCount: notices.length,
		captures: allCaptures,
		outputDir,
		durationMs,
		report,
	};
}

function printScreenshotJobSummary(input: {
	requiredCount: number;
	succeeded: number;
	captureFailed: number;
	validationFailed: number;
	manifestFailed: number;
	optionalOmitted: number;
	warnings: string[];
	notices: string[];
	detailedWarnings: ScreenshotWarning[];
	blockingErrors: number;
	durationMs: number;
	outputDir: string;
	reportPath: string;
	manifest: ReturnType<typeof buildCurrentRunManifest>;
	manifestFiles: number;
}): void {
	console.log('');
	console.log('═'.repeat(56));
	console.log('📊  RESULTS');
	console.log('═'.repeat(56));
	console.log(`  Required captures: ${input.requiredCount}`);
	console.log(`  Successful:        ${input.succeeded}`);
	console.log(`  Capture failures:  ${input.captureFailed}`);
	console.log(`  Validation failures: ${input.validationFailed}`);
	console.log(`  Manifest failures: ${input.manifestFailed}`);
	if (input.optionalOmitted > 0) {
		console.log(`  Optional omitted:  ${input.optionalOmitted} (see notices)`);
	}
	console.log(`  Warnings:        ${input.warnings.length}`);
	console.log(`  Notices:         ${input.notices.length}`);
	console.log(`  Blocking errors: ${input.blockingErrors}`);
	console.log(`  Duration:        ${formatDuration(input.durationMs)}`);
	console.log(`  Output:          ${input.outputDir}/`);
	console.log(`  Report:          ${input.reportPath}`);
	console.log('');

	if (input.notices.length > 0) {
		console.log('═'.repeat(56));
		console.log('ℹ️  INFO / NOTICES');
		console.log('═'.repeat(56));
		for (const n of input.notices) {
			console.log(`  ℹ  ${n}`);
		}
		console.log('');
	}

	if (input.detailedWarnings.length > 0) {
		console.log('═'.repeat(56));
		console.log('⚠️  WARNINGS');
		console.log('═'.repeat(56));
		for (const w of input.detailedWarnings) {
			const typeStr = w.expected ? 'Expected' : 'UNEXPECTED';
			const vpStr = w.viewport ? ` [${w.viewport}]` : '';
			console.log(`  ⚠ [${typeStr}]${vpStr}: ${w.message}`);
		}
		console.log('');
	}

	if (input.manifest.length > 0) {
		console.log('  📁 Current-run manifest:');
		for (const vp of input.manifest) {
			const status = vp.status !== 'passed' ? ' ⚠' : '';
			const requiredStr =
				vp.requiredExpected !== undefined
					? `${vp.requiredVerified ?? 0}/${vp.requiredExpected} required`
					: `${vp.files} files, expected ${vp.expected}`;
			const optionalStr =
				vp.optionalExpected !== undefined
					? `, ${vp.optionalGenerated ?? 0}/${vp.optionalExpected} optional`
					: '';
			console.log(`    ${vp.name}/  (${requiredStr}${optionalStr})${status}`);
		}
		console.log(`    Total generated this run: ${input.manifestFiles} files`);
		console.log('');
	}
}

// =============================================================================
// Viewport Report Builder
// =============================================================================

// eslint-disable-next-line complexity -- Viewport reporting combines capture, artifact, selector, and scope checks.
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
	const taskCaptureFailures: string[] = [];
	const validationFailures: string[] = [];
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
				validationFailures.push(
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
				taskCaptureFailures.push(
					`${result.id ?? result.label}: ${result.error ?? 'capture failed'}`,
				);
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
	validationFailures.push(...blockingErrors);
	const classifiedConsoleErrors = consoleErrors.map(classifyConsoleError);

	const auditNormalizations = await readAuditNormalizations(page);
	for (const norm of auditNormalizations) {
		const msg = `Audit normalization: ${norm}`;
		notices.push(msg);
	}

	appendExpectedOutputFailures(validationFailures, job, results, outputFiles);

	// Physical dimension check on full-page captures — fail if viewport-sized on multi-viewport page
	appendFullPageDimensionFailures(validationFailures, outputFiles, documentHeight, viewport);

	if (documentHeight < viewport.height) {
		warnings.push(
			`Document height ${documentHeight}px is shorter than viewport height ${viewport.height}px.`,
		);
	}

	let sectionCoverage: SectionCoverageReport | undefined;

	if (
		job.pageType === 'invitation' &&
		job.target !== 'full-page' &&
		job.target !== 'reveal-only'
	) {
		const inventory = await deriveSectionInventory(page);
		const plannedSectionIds =
			job.scope?.invitations[0]?.sectionSelection.kind === 'ids'
				? job.scope.invitations[0].sectionSelection.ids
				: undefined;
		if (plannedSectionIds === undefined || plannedSectionIds.length > 0) {
			sectionCoverage = buildSectionCoverage(
				inventory,
				results,
				validationFailures,
				plannedSectionIds,
			);
		}
	}

	const failures = [...taskCaptureFailures, ...validationFailures];

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
		captureFailures: taskCaptureFailures,
		validationFailures,
		failures,
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
	plannedSectionIds?: string[],
): SectionCoverageReport {
	const sectionResults = results.filter((r) => r.label.startsWith('Section:'));
	const missingSections: string[] = [];
	const sections = plannedSectionIds
		? plannedSectionIds.map(
				(id, index) =>
					inventory.sections.find((section) => section.id === id) ?? {
						id,
						order: index + 1,
						label: id,
						selector: `[data-screenshot-section="${id}"]`,
					},
			)
		: inventory.sections;

	for (const sec of sections) {
		const found = results.some(
			(r) => r.success && (r.path.includes(`-${sec.id}.`) || r.label.includes(sec.label)),
		);
		if (!found) {
			missingSections.push(sec.id);
			captureFailures.push(`Missing section capture for required section "${sec.id}".`);
		}
	}

	for (const dup of inventory.duplicates.filter(
		(id) => !plannedSectionIds || plannedSectionIds.includes(id),
	)) {
		captureFailures.push(`Duplicate section root detected in DOM: "${dup}".`);
	}

	return {
		expectedCount: sections.length,
		renderedCount: sections.filter((section) =>
			inventory.sections.some((item) => item.id === section.id),
		).length,
		plannedCount: sectionResults.length,
		successfulCount: sectionResults.filter((r) => r.success).length,
		missingSections,
		duplicateSections: inventory.duplicates,
		sections: sections.map((sec) => {
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
