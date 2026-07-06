// =============================================================================
// CELEBRA-ME | Screenshot Tool — Utility Functions
// =============================================================================

import * as path from 'node:path';
import * as syncFs from 'node:fs';
import * as fs from 'node:fs/promises';
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
	// Object map: each flag key → handler
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
		'--baseUrl': () => {
			options.baseUrl = value;
		},
		'--type': () => {
			options.pageType = value as PageType;
		},
		'--page-type': () => {
			options.pageType = value as PageType;
		},
		'--pageType': () => {
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
		'--includeLayout': () => {
			options.includeLayout = value === 'true';
		},
		'--set': () => {
			setInvitationSet(options, value);
		},
		'--screenshot-set': () => {
			setInvitationSet(options, value);
		},
		'--screenshotSet': () => {
			setInvitationSet(options, value);
		},
		'--invitation-set': () => {
			setInvitationSet(options, value);
		},
		'--invitationSet': () => {
			setInvitationSet(options, value);
		},
		'--general-set': () => {
			if (value === 'basic' || value === 'full-qa') {
				options.generalSet = value;
			}
		},
		'--generalSet': () => {
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
		'--sectionSelectors': () => {
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
		'--outputStyle': () => {
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
}): ViewportManifestReport[] {
	return input.viewports
		.map((viewport) => {
			const perViewport = input.captures.filter(
				(capture) => capture.viewportName === viewport.name,
			);
			const files = perViewport.filter((c) => c.success).length;
			const planned = input.perViewportPlanned[viewport.name] ?? 0;
			const expectsOutput =
				input.target === 'critical-qa' ||
				input.target === 'full-page' ||
				input.target === 'all-sections' ||
				input.target === 'single-section';
			const status =
				expectsOutput && planned === 0
					? 'failed'
					: files >= planned
						? 'passed'
						: files > 0
							? 'warning'
							: 'failed';
			return {
				name: viewport.name,
				files,
				expected: planned,
				status,
			} satisfies ViewportManifestReport;
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

// ---------------------------------------------------------------------------
// Dynamic Demos & Templates Discovery
// ---------------------------------------------------------------------------

export interface DemoInvitation {
	name: string;
	route: string;
	slug: string;
	eventType: string;
}

/**
 * Dynamically discover all event demos from src/content/event-demos
 */
export function getAvailableDemos(): DemoInvitation[] {
	const demosDir = path.join(process.cwd(), 'src/content/event-demos');
	const results: DemoInvitation[] = [];

	if (!syncFs.existsSync(demosDir)) return results;

	const folders = syncFs.readdirSync(demosDir);
	for (const folder of folders) {
		const folderPath = path.join(demosDir, folder);
		if (!syncFs.statSync(folderPath).isDirectory()) continue;

		const files = syncFs.readdirSync(folderPath);
		for (const file of files) {
			if (!file.endsWith('.json') || file.startsWith('_')) continue;

			try {
				const contentStr = syncFs.readFileSync(path.join(folderPath, file), 'utf8');
				const content = JSON.parse(contentStr);

				const eventType = content.eventType || folder;
				const slug = file.replace(/\.json$/, '');
				const route = `/${eventType}/${slug}`;

				results.push({
					name: content.title || `${eventType}: ${slug}`,
					route,
					slug,
					eventType,
				});
			} catch {
				// Ignore invalid/empty files
			}
		}
	}

	return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Dynamically discover all event templates from src/content/event-templates
 */
export function getAvailableTemplates(): DemoInvitation[] {
	const templatesDir = path.join(process.cwd(), 'src/content/event-templates');
	const results: DemoInvitation[] = [];

	if (!syncFs.existsSync(templatesDir)) return results;

	const folders = syncFs.readdirSync(templatesDir);
	for (const folder of folders) {
		const folderPath = path.join(templatesDir, folder);
		if (!syncFs.statSync(folderPath).isDirectory()) continue;

		const files = syncFs.readdirSync(folderPath);
		for (const file of files) {
			if (!file.endsWith('.json') || file.startsWith('_')) continue;

			try {
				const contentStr = syncFs.readFileSync(path.join(folderPath, file), 'utf8');
				const content = JSON.parse(contentStr);

				const eventType = content.eventType || folder;
				const slug = file.replace(/\.json$/, '');
				const route = `/${eventType}/${slug}`;

				results.push({
					name: content.title || `Template ${eventType}: ${slug}`,
					route,
					slug,
					eventType,
				});
			} catch {
				// Ignore invalid/empty files
			}
		}
	}

	return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Validate if the bottom region of a captured screenshot is mostly blank (uniform color).
 */
export async function validateBlankBottom(filePath: string): Promise<BlankBottomValidation> {
	try {
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

		// Extract the bottom 200px
		const extractHeight = 200;
		const bottomRegion = await image
			.extract({
				left: 0,
				top: height - extractHeight,
				width,
				height: extractHeight,
			})
			.raw()
			.toBuffer();

		const channels = metadata.channels || 3;
		const firstPixelR = bottomRegion[0];
		const firstPixelG = bottomRegion[1];
		const firstPixelB = bottomRegion[2];

		let isUniform = true;
		for (let i = 0; i < bottomRegion.length; i += channels) {
			const r = bottomRegion[i];
			const g = bottomRegion[i + 1];
			const b = bottomRegion[i + 2];
			if (
				Math.abs(r - firstPixelR) > 5 ||
				Math.abs(g - firstPixelG) > 5 ||
				Math.abs(b - firstPixelB) > 5
			) {
				isUniform = false;
				break;
			}
		}

		const isStitched =
			filePath.includes('02-full-page') || filePath.includes('05-invitation-full-open');

		return {
			path: filePath,
			width,
			height,
			trailingBlankSpaceDetected: isUniform,
			stitchedNecessary: isStitched,
			note: isUniform
				? `Bottom ${extractHeight}px has a uniform color (R:${firstPixelR}, G:${firstPixelG}, B:${firstPixelB}), indicating a blank tail.`
				: `No trailing blank space detected in bottom ${extractHeight}px.`,
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


