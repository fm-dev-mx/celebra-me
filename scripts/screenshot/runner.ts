// =============================================================================
// CELEBRA-ME | Screenshot Tool — Job Runner
// =============================================================================

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
} from './types.js';
import {
	createPageSlug,
	resolveOutputDir,
	ensureDir,
	formatViewport,
	formatDuration,
	writeScreenshotReport,
	buildCurrentRunManifest,
	classifyConsoleError,
	getExpectedCaptureCount,
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
			const consoleErrors: string[] = [];
			const requestFailures: RequestFailureReport[] = [];

			page.on('console', (message) => {
				if (message.type() === 'error') {
					consoleErrors.push(message.text());
				}
			});
			page.on('pageerror', (error) => {
				consoleErrors.push(`pageerror: ${error.message}`);
			});
			page.on('requestfailed', (request) => {
				requestFailures.push(classifyRequestFailure(request));
			});

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
				const viewportReport = await buildViewportReport({
					page,
					job,
					viewport,
					results,
					consoleErrors,
					requestFailures,
				});
				viewportReports.push(viewportReport);

				// Log summary for this viewport
				const succeeded = results.filter((r) => r.success).length;
				const failed = results.filter((r) => !r.success).length + viewportReport.failures.length;
				console.log(
					`  ─── Done: ${succeeded} captured, ${failed} failed, ${viewportReport.warnings.length} warning(s) ───`,
				);
			} catch (err) {
				console.error(`  ✕ Error capturing viewport ${viewport.name}: ${err}`);
				viewportReports.push({
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
				});
			} finally {
				await context.close();
			}
		}
	} finally {
		await browser.close();
	}

	// ── 4. Current-run manifest ──────────────────────────────────────────
	const expectedPerViewport = getExpectedCaptureCount({
		pageType: job.pageType,
		mode: job.mode,
		invitationSet: job.invitationSet,
		generalSet: job.generalSet,
		sectionCapture: job.sectionCapture,
		sectionSelectors: job.sectionSelectors,
		criticalSelectors: job.criticalSelectors,
	});
	const manifest = buildCurrentRunManifest({
		viewports: job.viewports,
		captures: allCaptures,
		expectedPerViewport,
	});
	const manifestFiles = manifest.reduce((sum, vp) => sum + vp.files, 0);

	// ── 5. Compile results ────────────────────────────────────────────────
	const durationMs = Date.now() - startTime;
	const succeeded = allCaptures.filter((r) => r.success).length;
	const validationFailures = viewportReports.reduce((sum, report) => sum + report.failures.length, 0);
	const failed = allCaptures.filter((r) => !r.success).length + validationFailures;
	const warnings = viewportReports.flatMap((report) => report.warnings);
	const failures = viewportReports.flatMap((report) => report.failures);
	const report: ScreenshotRunReport = {
		route: job.url,
		mode: job.mode,
		startedAt,
		durationMs,
		status: failed > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
		viewports: viewportReports,
		manifest,
		warnings,
		failures,
	};
	const reportPath = await writeScreenshotReport(outputDir, report);

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
	console.log(`  Report:          ${reportPath}`);
	console.log('');

	// Current-run manifest
	if (manifest.length > 0) {
		console.log('  📁 Current-run manifest:');
		for (const vp of manifest) {
			const status = vp.status !== 'passed' ? ' ⚠' : '';
			console.log(
				`    ${vp.name}/  (${vp.files} files${vp.expected > 0 ? `, expected ~${vp.expected}` : ''})${status}`,
			);
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
	const failures: string[] = [];
	const documentHeight = await getDocumentHeight(page);
	const outputFiles = await Promise.all(
		results
			.filter((result) => result.success)
			.map(async (result) => {
				const metadata = await readImageMetadata(result.path);
				return {
					path: result.path,
					label: result.label,
					width: metadata.width,
					height: metadata.height,
				};
			}),
	);
	const criticalSelectors = await validateCriticalSelectors(page, job.criticalSelectors);
	const criticalFailures = criticalSelectors.flatMap((selector) => selector.failures ?? []);
	const criticalWarnings = criticalSelectors.flatMap((selector) => selector.warnings ?? []);
	const criticalRequestFailures = requestFailures
		.filter((failure) => failure.severity === 'critical')
		.map((failure) => `Critical request failed: ${failure.method} ${failure.url} :: ${failure.errorText}`);
	const warningRequestFailures = requestFailures
		.filter((failure) => failure.severity === 'warning')
		.map((failure) => `Non-critical request failed: ${failure.method} ${failure.url} :: ${failure.errorText}`);

	const classifiedConsoleErrors = consoleErrors.map(classifyConsoleError);
	const fatalConsoleErrors = classifiedConsoleErrors.filter((error) => error.severity === 'critical');
	const warningConsoleErrors = classifiedConsoleErrors.filter(
		(error) => error.severity === 'warning',
	);
	const auditNormalizations = await readAuditNormalizations(page);

	failures.push(...criticalFailures, ...criticalRequestFailures);
	warnings.push(...criticalWarnings, ...warningRequestFailures);
	failures.push(
		...fatalConsoleErrors.map(
			(error) => `Console error (${error.source}, affects screenshots): ${error.message}`,
		),
	);
	warnings.push(
		...warningConsoleErrors.map(
			(error) =>
				`Console warning (${error.source}; production risk ${error.productionRisk}; screenshot reliability ${error.affectsScreenshotReliability ? 'affected' : 'not affected'}): ${error.message}`,
		),
	);
	warnings.push(...auditNormalizations.map((message) => `Audit normalization: ${message}`));

	for (const result of results) {
		if (!result.success) {
			failures.push(`${result.label}: ${result.error ?? 'capture failed'}`);
		}
	}

	for (const file of outputFiles.filter((outputFile) => isViewportSizedCapture(outputFile.label))) {
		if (!file.width || !file.height) {
			failures.push(`Could not read dimensions for ${file.path}`);
			continue;
		}
		if (file.width < viewport.width || file.height < viewport.height) {
			failures.push(
				`${file.path} dimensions ${file.width}x${file.height} are smaller than viewport ${viewport.width}x${viewport.height}`,
			);
		}
	}

	if (documentHeight < viewport.height) {
		warnings.push(
			`Document height ${documentHeight}px is shorter than viewport height ${viewport.height}px.`,
		);
	}

	return {
		name: viewport.name,
		width: viewport.width,
		height: viewport.height,
		deviceScaleFactor: viewport.deviceScaleFactor,
		documentHeight,
		outputFiles,
		criticalSelectors,
		warnings,
		failures,
		consoleErrors: classifiedConsoleErrors,
		requestFailures,
	};
}

function isViewportSizedCapture(label: string): boolean {
	return label === 'Viewport' || label === 'Full page' || label === 'Initial full page';
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
				(window as Window & {
					__screenshotAuditNormalizations?: string[];
				}).__screenshotAuditNormalizations ?? []
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
	return Array.isArray(value) && value.every(
		(item) =>
			item !== null &&
			typeof item === 'object' &&
			typeof (item as Record<string, unknown>).selector === 'string',
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
			return /\.(css|js|mjs|ts|tsx|astro|png|jpg|jpeg|webp|gif|svg|avif|woff2?|ttf|otf)$/i.test(
				parsed.pathname,
			);
		}

		return false;
	} catch {
		return true;
	}
}
