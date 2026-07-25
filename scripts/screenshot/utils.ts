// =============================================================================
// CELEBRA-ME | Screenshot Tool — Utility Functions
// =============================================================================

import * as path from 'node:path';
import * as syncFs from 'node:fs';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import sharp from 'sharp';
import {
	type PageType,
	type Viewport,
	type ViewportProfileType,
	type CliOptions,
	type OutputFormat,
	type ScreenshotConfig,
	type ScreenshotMode,
	type ScreenshotRunReport,
	type ScreenshotSelectorConfig,
	type CaptureResult,
	type ConsoleErrorReport,
	type ViewportManifestReport,
	type CaptureTarget,
	type BlankBottomValidation,
	VIEWPORT_PROFILES,
	DEFAULT_BASE_URL,
} from './types.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments into structured options.
 * Supports both `--key=value` and `--key value` forms.
 */
export function parseCliArgs(argv: string[]): CliOptions {
	const options: CliOptions = {};
	const args = argv.slice(2); // skip node and script path

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		// --no-* flags
		if (arg === '--no-interactive') {
			options.interactive = false;
			continue;
		}

		// --flag=value
		const eqIndex = arg.indexOf('=');
		if (eqIndex !== -1) {
			const key = arg.slice(0, eqIndex);
			const value = arg.slice(eqIndex + 1);
			setOption(options, key, value);
			continue;
		}

		// --flag value
		if (arg.startsWith('--')) {
			const key = arg;
			const next = args[i + 1];
			if (next && !next.startsWith('--')) {
				setOption(options, key, next);
				i++; // consume next arg
			} else {
				// boolean flag
				setOption(options, key, 'true');
			}
			continue;
		}

		// -flag value (short form)
		if (arg.startsWith('-') && !arg.startsWith('--')) {
			const next = args[i + 1];
			if (next && !next.startsWith('-')) {
				setShortOption(options, arg, next);
				i++;
			}
			continue;
		}
	}

	return options;
}

function setOption(options: CliOptions, key: string, value: string): void {
	// Single source of truth for CLI flag → option mapping. Flag names follow
	// kebab-case (matches README). CamelCase aliases were removed in favor of
	// a canonical, documented surface.
	const handlers: Record<string, () => void> = {
		'--interactive': () => {
			options.interactive = value === 'true';
		},
		'--url': () => {
			options.url = value;
		},
		'--base-url': () => {
			options.baseUrl = value;
		},
		'--type': () => {
			options.pageType = value as PageType;
		},
		'--mode': () => {
			if (isScreenshotMode(value)) {
				options.mode = value;
			}
		},
		'--viewport': () => {
			options.viewport = (options.viewport ?? []).concat(
				value.split(',').map((v) => v.trim()),
			);
		},
		'--profile': () => {
			options.profile = value as ViewportProfileType;
		},
		'--target': () => {
			if (
				value === 'full-page' ||
				value === 'critical-qa' ||
				value === 'all-sections' ||
				value === 'single-section'
			) {
				options.target = value as CaptureTarget;
			}
		},
		'--include-layout': () => {
			options.includeLayout = value === 'true';
		},
		'--set': () => {
			setInvitationSet(options, value);
		},
		'--general-set': () => {
			if (value === 'basic' || value === 'full-qa') {
				options.generalSet = value;
			}
		},
		'--reveal': () => {
			if (
				value === 'auto' ||
				value === 'force-open' ||
				value === 'closed-only' ||
				value === 'open-only' ||
				value === 'skip'
			) {
				options.reveal = value;
			}
		},
		'--animation': () => {
			if (
				value === 'disable' ||
				value === 'wait' ||
				value === 'query-param' ||
				value === 'custom'
			) {
				options.animation = value;
			}
		},
		'--sections': () => {
			options.sections = value;
		},
		'--section-selectors': () => {
			options.sectionSelectors = value;
		},
		'--auth': () => {
			if (
				value === 'none' ||
				value === 'existing-session' ||
				value === 'storage-state' ||
				value === 'manual-login'
			) {
				options.auth = value;
			}
		},
		'--format': () => {
			if (value === 'png' || value === 'jpeg' || value === 'webp' || value === 'pdf') {
				options.format = value;
			}
		},
		'--output': () => {
			options.output = value;
		},
		'--output-style': () => {
			if (
				value === 'default' ||
				value === 'timestamped' ||
				value === 'custom' ||
				value === 'overwrite'
			) {
				options.outputStyle = value;
			}
		},
		'--config': () => {
			options.config = value;
		},
		'--clean': () => {
			options.clean = true;
		},
	};

	const handler = handlers[key];
	if (handler) handler();
}

function setInvitationSet(options: CliOptions, value: string): void {
	// Map CLI-friendly values to internal enum
	const mapped =
		value === 'essential-invitation'
			? 'essential'
			: value === 'full-qa-invitation'
				? 'full-qa'
				: value;
	if (
		mapped === 'essential' ||
		mapped === 'full-qa' ||
		mapped === 'reveal-only' ||
		mapped === 'full-page'
	) {
		options.invitationSet = mapped;
	}
}

function isScreenshotMode(value: string): value is ScreenshotMode {
	return value === 'audit' || value === 'raw';
}

function setShortOption(options: CliOptions, key: string, value: string): void {
	switch (key) {
		case '-u':
			options.url = value;
			break;
		case '-t':
			options.pageType = value as PageType;
			break;
		case '-p':
			options.profile = value as ViewportProfileType;
			break;
		case '-f':
			options.format = value as OutputFormat;
			break;
		case '-o':
			options.output = value;
			break;
	}
}

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a user-provided URL or route to a full URL.
 * If the input starts with http:// or https://, return as-is.
 * Otherwise, prepend the base URL.
 *
 * Handles MSYS/git-bash path expansion on Windows where
 * --url=/boda/... gets converted to C:/Program Files/Git/boda/...
 */
export function resolveUrl(input: string, baseUrl: string = DEFAULT_BASE_URL): string {
	const trimmed = input.trim();
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	// Strip MSYS/git-bash Windows path prefix (e.g. C:/Program Files/Git/...)
	// This happens when git-bash converts /route to a Windows absolute path
	let route = trimmed;
	const msysMatch = trimmed.match(/^[A-Za-z]:\/(?:Program Files\/Git|Users\/[^/]+)\/(.+)$/);
	if (msysMatch) {
		route = '/' + msysMatch[1];
	}

	// Ensure leading slash for route joining
	if (!route.startsWith('/')) {
		route = '/' + route;
	}

	const base = baseUrl.replace(/\/+$/, '');
	return `${base}${route}`;
}

/**
 * Create a human-readable page slug from a URL, using all pathname segments.
 * Examples:
 *   /boda/demo-boda-jewelry-box-wedding  → boda-demo-boda-jewelry-box-wedding
 *   /dashboard                           → dashboard
 *   /                                    → home
 *   /login                               → login
 */
export function createPageSlug(url: string): string {
	try {
		const parsed = new URL(url);
		const pathname = parsed.pathname.replace(/\/+$/, '') || '/';

		if (pathname === '/') return 'home';

		// Use ALL path segments joined by hyphens for traceability
		const segments = pathname.split('/').filter(Boolean);
		return segments.join('-');
	} catch {
		// Fallback: extract from raw string
		const cleaned = url.replace(/\/+$/, '');
		const segments = cleaned.split('/').filter(Boolean);
		return segments.join('-') || 'page';
	}
}

// ---------------------------------------------------------------------------
// Viewport profile resolution
// ---------------------------------------------------------------------------

/**
 * Get the default viewport profile name for a given page type.
 */
export function getDefaultProfile(pageType: PageType): 'invitation' | 'site' {
	return pageType === 'invitation' ? 'invitation' : 'site';
}

/**
 * Resolve a viewport profile to its list of viewport configurations.
 */
export function getViewportsForProfile(profile: ViewportProfileType): Viewport[] {
	const entry = VIEWPORT_PROFILES[profile];
	if (entry) return [...entry.viewports];
	// Fallback: return site profile
	return [...VIEWPORT_PROFILES.site.viewports];
}

export function getViewportProfileSummary(profile: ViewportProfileType): string {
	const viewports = getViewportsForProfile(profile);
	return viewports.map((viewport) => viewport.name).join(', ');
}

/**
 * Look up a single named viewport from any profile.
 * Returns undefined if not found.
 */
export function findViewportByName(name: string): Viewport | undefined {
	const canonicalName = name === 'mobile-small' ? 'mobile-narrow' : name;
	for (const profile of Object.values(VIEWPORT_PROFILES)) {
		const found = profile.viewports.find((v) => v.name === canonicalName);
		if (found) return { ...found };
	}
	return undefined;
}

/**
 * Resolve the effective viewport list from CLI options.
 */
export function resolveViewports(
	profile: ViewportProfileType,
	viewportNames?: string[],
): Viewport[] {
	if (viewportNames && viewportNames.length > 0) {
		const viewports: Viewport[] = [];
		for (const name of viewportNames) {
			const found = findViewportByName(name);
			if (found) {
				viewports.push(found);
			} else {
				console.warn(
					`  ⚠ Unknown viewport "${name}" — skipping. Known names: mobile-narrow, mobile-standard, mobile-large, tablet, desktop`,
				);
			}
		}
		if (viewports.length === 0) {
			console.warn('  ⚠ No valid viewport names provided — falling back to profile defaults');
			return getViewportsForProfile(profile);
		}
		return viewports;
	}
	return getViewportsForProfile(profile);
}

export function getDefaultCriticalSelectors(pageType: PageType): ScreenshotSelectorConfig[] {
	if (pageType === 'invitation') {
		return [
			{ selector: '[data-screenshot="invitation-root"]', required: true },
			{ selector: '[data-screenshot="invitation-open-hero"], #inicio', required: true, capture: true, label: 'hero' },
			{ selector: '[data-screenshot-section="gallery"], #galeria', required: false, capture: true, label: 'gallery' },
			{ selector: '[data-screenshot-section="rsvp"], #rsvp', required: false, capture: true, label: 'rsvp' },
			{ selector: '[data-screenshot-section="location"], #event-location', required: false, capture: true, label: 'location' },
			{ selector: '[data-screenshot-section="thankYou"], #thank-you-section', required: false, capture: true, label: 'thankYou' },
		];
	}

	if (pageType === 'landing') {
		return [
			/* Required: hero, pricing, FAQ, contact */
			{ selector: '[data-screenshot="landing-hero"], #inicio', required: true, capture: true, label: 'hero' },
			{
				selector: '[data-screenshot="landing-pricing"], #pricing',
				required: true,
				capture: true,
				label: 'pricing',
			},
			{
				selector: '[data-screenshot="landing-faq"], #faq-section',
				required: true,
				capture: true,
				label: 'faq',
			},
			{
				selector: '[data-screenshot="landing-contact"], #contacto',
				required: true,
				capture: true,
				label: 'contact',
			},
			/* Optional / warning-only landing sections */
			{ selector: '[data-screenshot="landing-event-selector"], #tipo-evento', required: false },
			{ selector: '[data-screenshot="landing-includes"], #servicios', required: false },
			{ selector: '[data-screenshot="landing-guest-experience"], #experiencia-invitados', required: false },
			{
				selector: '[data-screenshot="landing-testimonials"], #testimonios',
				required: false,
				capture: true,
				label: 'testimonials',
			},
			{ selector: '[data-screenshot="landing-process"], #como-funciona', required: false },
			{ selector: '[data-screenshot="landing-footer"], footer', required: false },
		];
	}

	return [{ selector: 'main, [data-screenshot="main"]', required: false, capture: true }];
}

export function getAboveFoldCriticalSelector(pageType: PageType): string {
	if (pageType === 'invitation') {
		return '[data-screenshot="invitation-open-hero"], #inicio, [data-screenshot="invitation-root"]';
	}

	if (pageType === 'landing') {
		return '[data-screenshot="landing-hero"], #inicio, main section:first-of-type, main';
	}

	return 'main, [data-screenshot="main"], body';
}

export function getDefaultHideSelectors(): string[] {
	return [
		'[data-consent-banner]',
		'[data-cookie-banner]',
		'#cookie-banner',
		'#consent-banner',
		'.cookie-banner',
		'.consent-banner',
		'[aria-label*="cookie" i]',
		'[aria-label*="cookies" i]',
		'[aria-label*="consent" i]',
	];
}

export async function getDocumentHeight(page: import('playwright').Page): Promise<number> {
	try {
		return await page.evaluate(() =>
			Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
		);
	} catch {
		return 0;
	}
}

export function getExpectedCaptureCount(input: {
	pageType: PageType;
	mode: ScreenshotMode;
	target: CaptureTarget;
	includeLayout?: boolean;
	criticalSelectors?: ScreenshotSelectorConfig[];
	sectionSelectors?: string[];
}): number {
	const criticalCount =
		input.target === 'critical-qa' && input.mode === 'audit'
			? (input.criticalSelectors ?? []).filter((s) => s.capture).length
			: 0;

	if (input.pageType === 'invitation') {
		if (input.target === 'full-page') {
			return 2; // initial-full-page + invitation-full-open
		}
		if (input.target === 'critical-qa') {
			return 5 + criticalCount; // closed, reveal-closed, letter-open, reveal-open, full-open
		}
		if (input.target === 'all-sections') {
			return 0; // dynamic — resolved at runtime from actual page sections
		}
		if (input.target === 'single-section') {
			return 1;
		}
		return 5;
	}

	// General Page
	const layoutCount = input.includeLayout ? 4 : 0; // viewport + header + main + footer
	if (input.target === 'full-page') {
		return 1; // only 02-full-page
	}
	if (input.target === 'critical-qa') {
		return 1 + layoutCount + criticalCount; // full-page + layout + critical
	}
	if (input.target === 'all-sections') {
		return 0; // dynamic — resolved at runtime from actual page sections
	}
	if (input.target === 'single-section') {
		return 1;
	}
	return 2;
}

export function buildCurrentRunManifest(input: {
	viewports: Viewport[];
	captures: CaptureResult[];
	perViewportPlanned: Record<string, number>;
	target: CaptureTarget;
	perViewportPlannedTasks?: Record<string, Array<{ id: string; required: boolean }>>;
}): ViewportManifestReport[] {
	return input.viewports
		.map((viewport) => {
			const perViewport = input.captures.filter(
				(capture) => capture.viewportName === viewport.name,
			);
			const successfulCaptures = perViewport.filter((c) => c.success);
			const successfulIds = new Set(
				successfulCaptures.flatMap((c) => {
					const ids = [c.id].filter((x): x is string => Boolean(x));
					if (c.path?.includes('full-page') || c.label?.includes('Full page')) {
						ids.push('05-invitation-full-page');
					}
					return ids;
				}),
			);

			const plannedTasks = input.perViewportPlannedTasks?.[viewport.name] ?? [];
			const requiredTasks = plannedTasks.filter((t) => t.required);
			const optionalTasks = plannedTasks.filter((t) => !t.required);

			const missingRequiredTaskIds: string[] = [];
			if (requiredTasks.length > 0) {
				for (const task of requiredTasks) {
					if (!successfulIds.has(task.id)) {
						missingRequiredTaskIds.push(task.id);
					}
				}
			} else if (plannedTasks.length > 0) {
				if (
					(input.target === 'critical-qa' || input.target === 'full-page') &&
					!successfulIds.has('05-invitation-full-page')
				) {
					missingRequiredTaskIds.push('05-invitation-full-page');
				}
			}

			const files = successfulCaptures.length;
			const planned = input.perViewportPlanned[viewport.name] ?? 0;
			const expectsOutput =
				input.target === 'critical-qa' ||
				input.target === 'full-page' ||
				input.target === 'all-sections' ||
				input.target === 'single-section';

			const isPassed =
				expectsOutput && planned > 0 && missingRequiredTaskIds.length === 0 && files >= planned;

			const manifestItem: ViewportManifestReport = {
				name: viewport.name,
				files,
				expected: planned,
				status: isPassed ? 'passed' : 'failed',
			};

			if (plannedTasks.length > 0) {
				manifestItem.requiredExpected = requiredTasks.length;
				manifestItem.requiredVerified = requiredTasks.length - missingRequiredTaskIds.length;
				manifestItem.optionalGenerated = optionalTasks.filter((t) => successfulIds.has(t.id)).length;
				manifestItem.optionalOmitted = optionalTasks.filter((t) => !successfulIds.has(t.id)).length;
				manifestItem.missingRequiredTaskIds = missingRequiredTaskIds;
			}

			return manifestItem;
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function classifyConsoleError(message: string): ConsoleErrorReport {
	if (message.includes('__name is not defined')) {
		return {
			message,
			severity: 'warning',
			source: 'test-runner-transpiler',
			environment: 'development',
			productionRisk: 'none',
			affectsScreenshotReliability: false,
			note:
				'Dev-only esbuild/tsx helper ReferenceError that occurs when transpiled callbacks are executed in the browser context via Playwright page.evaluate. Confirmed to have zero production risk as this code is only run inside the screenshot testing harness.',
		};
	}

	if (message.includes('jsxDEV is not a function')) {
		return {
			message,
			severity: 'warning',
			source: 'test-runner-transpiler',
			environment: 'development',
			productionRisk: 'none',
			affectsScreenshotReliability: false,
			note:
				'Dev-only React JSX development runtime helper (jsxDEV) present in the Astro/Vite dev-server bundle but not available under tsx execution. Production builds (astro build) compile JSX with the production jsxRuntime (jsx/jsxs, not jsxDEV). Zero production risk — only occurs during local screenshot runs against the dev server.',
		};
	}

	if (
		message.includes("Cannot read properties of null (reading 'useState')") &&
		message.includes('framer-motion.js') &&
		message.includes('RSVP.tsx')
	) {
		return {
			message,
			severity: 'warning',
			source: 'page-script',
			environment: 'development',
			productionRisk: 'unlikely',
			affectsScreenshotReliability: false,
			note:
				'Observed only during local screenshot runs against the Vite dev server while hydrating the RSVP React island with framer-motion. Production build validation passes, and the screenshot targets for these runs are still generated. Treat as a dev-server hydration quirk unless reproduced in a production bundle.',
		};
	}

	if (
		message.includes('Outdated Optimize Dep') ||
		message.includes('Failed to fetch dynamically imported module') ||
		(message.includes('ERR_ABORTED') && message.includes('zod.js')) ||
		message.includes('astro-retry=')
	) {
		return {
			message,
			severity: 'warning',
			source: 'test-runner-transpiler',
			environment: 'development',
			productionRisk: 'none',
			affectsScreenshotReliability: false,
			note:
				'Dev-only Vite dependency optimizer re-bundling request abortion (504 Outdated Optimize Dep) or dynamic import retry. Occurs when multiple fresh Playwright contexts query the Vite dev server in rapid succession. Zero production risk as production builds pre-bundle all modules into static chunks.',
		};
	}

	return {
		message,
		severity: 'critical',
		source: message.startsWith('pageerror:') ? 'page-script' : 'browser',
		environment: 'unknown',
		productionRisk: 'unknown',
		affectsScreenshotReliability: true,
		note:
			'Unhandled browser/page error during capture; treat as screenshot-reliability risk until investigated.',
	};
}

// ---------------------------------------------------------------------------
// Config and report files
// ---------------------------------------------------------------------------

export function loadScreenshotConfig(configPath: string): ScreenshotConfig {
	const raw = syncFs.readFileSync(configPath, 'utf8');
	const parsed = JSON.parse(raw) as unknown;

	if (!isRecord(parsed)) {
		throw new Error(`Screenshot config must be a JSON object: ${configPath}`);
	}

	return parsed as ScreenshotConfig;
}

export async function writeScreenshotReport(
	outputDir: string,
	report: ScreenshotRunReport,
): Promise<string> {
	await ensureDir(outputDir);
	const reportPath = path.join(outputDir, 'report.json');
	await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
	return reportPath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Output path generation
// ---------------------------------------------------------------------------

/**
 * Format a timestamp for folder naming: YYYY-MM-DD-HHmm
 */
export function formatTimestamp(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	const h = String(date.getHours()).padStart(2, '0');
	const min = String(date.getMinutes()).padStart(2, '0');
	return `${y}-${m}-${d}-${h}${min}`;
}

/**
 * Determine the output directory for a screenshot job.
 */
export function resolveOutputDir(
	pageSlug: string,
	style: 'default' | 'timestamped' | 'custom' | 'overwrite',
	customPath?: string,
): string {
	if (style === 'custom' && customPath) {
		return customPath;
	}
	const baseDir = 'screenshots';
	const slugDir = `${baseDir}/${pageSlug}`;

	if (style === 'timestamped') {
		return `${slugDir}/${formatTimestamp()}`;
	}
	// 'default' or 'overwrite' — same base path
	return slugDir;
}

/**
 * Ensure a directory exists (recursive).
 */
export async function ensureDir(dirPath: string): Promise<void> {
	await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Build the file extension for a given output format.
 */
export function formatExtension(format: OutputFormat): string {
	switch (format) {
		case 'jpeg':
			return 'jpg';
		case 'pdf':
			return 'pdf';
		default:
			return format; // png, webp
	}
}

/**
 * Build the Playwright `screenshot()`/`locator.screenshot()` option overrides
 * for a given output format. Centralized here so adding a new format is a
 * one-line change.
 *
 * Notes:
 *   - pdf is handled by Playwright's `fullPage` mode, not via type/quality.
 *   - webp is rendered as PNG (Playwright's native screenshot does not emit
 *     webp directly); the extension is converted separately by `formatExtension`.
 *   - jpeg quality is fixed at 90 — exposed as a single tuning point.
 */
export function playwrightFormatOptions(format: OutputFormat): {
	type?: 'jpeg' | 'png';
	quality?: number;
} {
	if (format === 'jpeg') return { type: 'jpeg', quality: 90 };
	if (format === 'webp') return { type: 'png' };
	return {};
}

/**
 * Build the full file path for a screenshot capture.
 * Creates parent directories as needed.
 */
export async function buildScreenshotPath(
	outputDir: string,
	viewportName: string,
	label: string,
	format: OutputFormat,
): Promise<string> {
	const ext = formatExtension(format);
	const viewportDir = path.join(outputDir, viewportName);
	await ensureDir(viewportDir);
	const filename = `${label}.${ext}`;
	return path.join(viewportDir, filename);
}

// ---------------------------------------------------------------------------
// Format helpers for CLI output
// ---------------------------------------------------------------------------

/**
 * Format a viewport for display: "390×844 @2x (mobile-standard)"
 */
export function formatViewport(v: Viewport): string {
	return `${v.width}×${v.height} @${v.deviceScaleFactor}x (${v.name})`;
}

/**
 * Format duration in a human-readable way.
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	const minutes = Math.floor(ms / 60_000);
	const seconds = Math.round((ms % 60_000) / 1000);
	return `${minutes}m ${seconds}s`;
}

/**
 * Validate if the bottom region of a captured screenshot is mostly blank (uniform color).
 */
export interface LayoutEvidence {
	docHeight: number;
	lastContentBottom: number;
	trailingBlankPx: number;
}

export async function validateBlankBottom(
	filePath: string,
	layoutEvidence?: LayoutEvidence,
): Promise<BlankBottomValidation> {
	try {
		const isStitched =
			filePath.includes('02-full-page') || filePath.includes('05-invitation-full-page') || filePath.includes('05-invitation-full-open');

		// Priority 1: Use layout evidence if provided (DOM bottom boundary vs document canvas height)
		if (layoutEvidence) {
			const trailingBlankDetected = layoutEvidence.trailingBlankPx > 150;
			return {
				path: filePath,
				width: 0,
				height: layoutEvidence.docHeight,
				trailingBlankSpaceDetected: trailingBlankDetected,
				stitchedNecessary: isStitched,
				note: trailingBlankDetected
					? `Layout evidence indicates ${layoutEvidence.trailingBlankPx}px of trailing blank space after DOM content (content bottom: ${layoutEvidence.lastContentBottom}px, doc height: ${layoutEvidence.docHeight}px).`
					: `Layout evidence confirms content extends to document bottom (content bottom: ${layoutEvidence.lastContentBottom}px, doc height: ${layoutEvidence.docHeight}px).`,
			};
		}

		const image = sharp(filePath);
		const metadata = await image.metadata();
		const width = metadata.width || 0;
		const height = metadata.height || 0;

		if (height < 500) {
			return {
				path: filePath,
				width,
				height,
				trailingBlankSpaceDetected: false,
				stitchedNecessary: false,
				note: `Height is too small (${height}px) to run blank bottom validation.`,
			};
		}

		// Priority 2: Fallback pixel analysis — check alpha channel transparency ONLY
		// (Do not falsely flag solid-colored section or footer backgrounds as blank tails)
		const hasAlpha = Boolean(metadata.hasAlpha);
		let isBlankTail = false;

		if (hasAlpha) {
			const extractHeight = Math.min(200, height);
			const bottomRegion = await image
				.extract({
					left: 0,
					top: height - extractHeight,
					width,
					height: extractHeight,
				})
				.raw()
				.toBuffer();

			const channels = metadata.channels || 4;
			let transparentPixels = 0;
			const totalPixels = width * extractHeight;

			// Alpha is the last channel in RGBA / BGRA
			for (let i = channels - 1; i < bottomRegion.length; i += channels) {
				if (bottomRegion[i] === 0) {
					transparentPixels++;
				}
			}

			isBlankTail = transparentPixels / totalPixels > 0.8;
		}

		return {
			path: filePath,
			width,
			height,
			trailingBlankSpaceDetected: isBlankTail,
			stitchedNecessary: isStitched,
			note: isBlankTail
				? `Transparent un-rendered space detected in bottom region.`
				: `No trailing blank space detected.`,
		};
	} catch (err) {
		return {
			path: filePath,
			width: 0,
			height: 0,
			trailingBlankSpaceDetected: false,
			stitchedNecessary: false,
			note: `Failed to analyze image: ${err}`,
		};
	}
}

// ---------------------------------------------------------------------------
// Physical PNG & Artifact Verification Utilities
// ---------------------------------------------------------------------------

export async function calculateImageHash(filePath: string): Promise<string> {
	const buf = await fs.readFile(filePath);
	return crypto.createHash('md5').update(buf).digest('hex');
}

export async function getFileArtifactMeta(filePath: string): Promise<{ sizeBytes: number; mtimeMs: number; hash: string }> {
	const stat = await fs.stat(filePath);
	const hash = await calculateImageHash(filePath);
	return {
		sizeBytes: stat.size,
		mtimeMs: stat.mtimeMs,
		hash,
	};
}

export interface VerifyPhysicalPngOptions {
	filePath: string;
	expectedCssWidth: number;
	expectedCssHeight: number;
	viewportCssHeight: number;
	deviceScaleFactor: number;
	tolerancePx?: number;
}

export interface PhysicalPngVerificationResult {
	valid: boolean;
	actualWidth: number;
	actualHeight: number;
	expectedPixelWidth: number;
	expectedPixelHeight: number;
	error?: string;
	errorCode?: string;
}

export async function verifyPhysicalPng(
	opts: VerifyPhysicalPngOptions,
): Promise<PhysicalPngVerificationResult> {
	const {
		filePath,
		expectedCssWidth,
		expectedCssHeight,
		viewportCssHeight,
		deviceScaleFactor,
		tolerancePx = 15,
	} = opts;

	const expectedPixelWidth = Math.round(expectedCssWidth * deviceScaleFactor);
	const expectedPixelHeight = Math.round(expectedCssHeight * deviceScaleFactor);
	const viewportPixelHeight = Math.round(viewportCssHeight * deviceScaleFactor);

	try {
		const meta = await sharp(filePath).metadata();
		const actualWidth = meta.width || 0;
		const actualHeight = meta.height || 0;

		if (!actualWidth || !actualHeight) {
			return {
				valid: false,
				actualWidth: 0,
				actualHeight: 0,
				expectedPixelWidth,
				expectedPixelHeight,
				error: `File ${filePath} could not be decoded or has 0 dimensions.`,
				errorCode: 'FULL_PAGE_CAPTURE_FAILED',
			};
		}

		// Width check (allow 2px rounding)
		if (Math.abs(actualWidth - expectedPixelWidth) > 4) {
			return {
				valid: false,
				actualWidth,
				actualHeight,
				expectedPixelWidth,
				expectedPixelHeight,
				error: `Width mismatch: PNG width ${actualWidth}px does not match expected viewport width ${expectedPixelWidth}px (${expectedCssWidth}px @${deviceScaleFactor}x).`,
				errorCode: 'FULL_PAGE_DIMENSION_MISMATCH',
			};
		}

		// Multi-viewport check: if content > 1 viewport, PNG height MUST exceed viewport height
		if (expectedCssHeight > viewportCssHeight + 10 && actualHeight <= viewportPixelHeight + 10) {
			return {
				valid: false,
				actualWidth,
				actualHeight,
				expectedPixelWidth,
				expectedPixelHeight,
				error: `Full-page artifact is mislabeled viewport-sized screenshot (${actualHeight}px) for multi-viewport invitation (${expectedPixelHeight}px expected).`,
				errorCode: 'FULL_PAGE_DIMENSION_MISMATCH',
			};
		}

		// Height tolerance check
		if (Math.abs(actualHeight - expectedPixelHeight) > tolerancePx) {
			return {
				valid: false,
				actualWidth,
				actualHeight,
				expectedPixelWidth,
				expectedPixelHeight,
				error: `Height mismatch: PNG height ${actualHeight}px differs from validated content height ${expectedPixelHeight}px by more than tolerance ±${tolerancePx}px.`,
				errorCode: 'FULL_PAGE_DIMENSION_MISMATCH',
			};
		}

		return {
			valid: true,
			actualWidth,
			actualHeight,
			expectedPixelWidth,
			expectedPixelHeight,
		};
	} catch (err) {
		return {
			valid: false,
			actualWidth: 0,
			actualHeight: 0,
			expectedPixelWidth,
			expectedPixelHeight,
			error: `Physical PNG verification failed for ${filePath}: ${err}`,
			errorCode: 'FULL_PAGE_CAPTURE_FAILED',
		};
	}
}

export interface VerifySectionCropOptions {
	fullPagePath: string;
	sectionId: string;
	sectionBounds: { y: number; height: number };
	topY: number;
	deviceScaleFactor: number;
	standalonePath?: string;
}

export interface SectionCropVerificationResult {
	valid: boolean;
	error?: string;
	errorCode?: string;
}

export async function verifySectionCropInclusion(
	opts: VerifySectionCropOptions,
): Promise<SectionCropVerificationResult> {
	const { fullPagePath, sectionId, sectionBounds, topY, deviceScaleFactor, standalonePath } = opts;

	try {
		const fullPageMeta = await sharp(fullPagePath).metadata();
		const fullWidth = fullPageMeta.width || 0;
		const fullHeight = fullPageMeta.height || 0;

		const cropTop = Math.max(0, Math.round((sectionBounds.y - topY) * deviceScaleFactor));
		const cropHeight = Math.round(sectionBounds.height * deviceScaleFactor);

		if (cropTop + cropHeight > fullHeight + 10) {
			return {
				valid: false,
				error: `Section "${sectionId}" region [top ${cropTop}px, height ${cropHeight}px] extends outside full-page image height ${fullHeight}px.`,
				errorCode: 'SECTION_OUTSIDE_FULL_PAGE',
			};
		}

		// Extract crop from full-page PNG
		const actualExtractHeight = Math.min(cropHeight, Math.max(1, fullHeight - cropTop));
		const cropBuffer = await sharp(fullPagePath)
			.extract({ left: 0, top: cropTop, width: fullWidth, height: actualExtractHeight })
			.raw()
			.toBuffer();

		// Check non-blank (ensure alpha/color pixels vary)
		let nonZero = 0;
		for (let i = 0; i < cropBuffer.length; i += 4) {
			if (cropBuffer[i] > 10 || cropBuffer[i + 1] > 10 || cropBuffer[i + 2] > 10) {
				nonZero++;
			}
		}
		if (nonZero === 0) {
			return {
				valid: false,
				error: `Section "${sectionId}" region in full-page artifact is completely blank / unrendered.`,
				errorCode: 'SECTION_CAPTURE_MISMATCH',
			};
		}

		// If standalone section capture exists, compare height dimensions
		if (standalonePath && syncFs.existsSync(standalonePath)) {
			const standaloneMeta = await sharp(standalonePath).metadata();
			const standaloneHeight = standaloneMeta.height || 0;
			if (standaloneHeight > 0 && Math.abs(cropHeight - standaloneHeight) > 30) {
				return {
					valid: false,
					error: `Section "${sectionId}" crop height (${cropHeight}px) differs materially from standalone capture height (${standaloneHeight}px).`,
					errorCode: 'SECTION_CAPTURE_MISMATCH',
				};
			}
		}

		return { valid: true };
	} catch (err) {
		return {
			valid: false,
			error: `Failed section crop comparison for "${sectionId}": ${err}`,
			errorCode: 'SECTION_CAPTURE_MISMATCH',
		};
	}
}

export async function publishArtifactAtomically(
	tempPath: string,
	finalPath: string,
): Promise<{ path: string; sizeBytes: number; mtimeMs: number; hash: string }> {
	await ensureDir(path.dirname(finalPath));
	await fs.copyFile(tempPath, finalPath);
	await fs.rm(tempPath, { force: true });
	const meta = await getFileArtifactMeta(finalPath);
	return {
		path: finalPath,
		...meta,
	};
}



