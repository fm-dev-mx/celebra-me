// =============================================================================
// CELEBRA-ME | Screenshot Tool — Utility Functions
// =============================================================================

import * as path from 'node:path';
import * as syncFs from 'node:fs';
import * as fs from 'node:fs/promises';
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
	type GeneralSet,
	type InvitationSet,
	type SectionCapture,
	type ViewportManifestReport,
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
			{ selector: '[data-screenshot="invitation-open-content"]', required: true, capture: true },
			{ selector: '[data-screenshot="invitation-open-hero"], #inicio', required: true },
			{ selector: '[data-screenshot-section="gallery"], #galeria', required: false, capture: true },
			{ selector: '[data-screenshot-section="rsvp"], #rsvp', required: false, capture: true },
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
			{ selector: '[data-screenshot="landing-event-types"], #tipo-evento', required: false },
			{ selector: '[data-screenshot="landing-includes"], #servicios', required: false },
			{ selector: '[data-screenshot="landing-essence"], #nosotros', required: false },
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
	invitationSet?: InvitationSet;
	generalSet?: GeneralSet;
	sectionCapture?: SectionCapture;
	criticalSelectors?: ScreenshotSelectorConfig[];
	sectionSelectors?: string[];
}): number {
	const criticalCaptures =
		input.mode === 'audit'
			? (input.criticalSelectors ?? []).filter((selector) => selector.capture).length
			: 0;

	if (input.pageType === 'invitation') {
		const base =
			input.invitationSet === 'full-page'
				? 1
				: input.invitationSet === 'reveal-only'
					? 1
					: input.invitationSet === 'full-qa'
						? 7
						: 5;
		const optionalSections =
			input.sectionCapture === 'custom' ? (input.sectionSelectors ?? []).length : 0;
		return base + optionalSections + criticalCaptures;
	}

	const base = input.generalSet === 'full-qa' ? 5 : 2;
	const optionalSections =
		input.sectionCapture === 'custom' ? (input.sectionSelectors ?? []).length : 0;

	return base + optionalSections + criticalCaptures;
}

export function buildCurrentRunManifest(input: {
	viewports: Viewport[];
	captures: CaptureResult[];
	expectedPerViewport: number;
}): ViewportManifestReport[] {
	return input.viewports
		.map((viewport) => {
			const files = input.captures.filter(
				(capture) => capture.success && capture.viewportName === viewport.name,
			).length;
			return {
				name: viewport.name,
				files,
				expected: input.expectedPerViewport,
				status:
					files >= input.expectedPerViewport
						? 'passed'
						: files > 0
							? 'warning'
							: 'failed',
			} satisfies ViewportManifestReport;
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function classifyConsoleError(message: string): ConsoleErrorReport {
	if (message.includes('__name is not defined')) {
		return {
			message,
			severity: 'warning',
			source: 'vite-dev-runtime',
			environment: 'development',
			productionRisk: 'unknown',
			affectsScreenshotReliability: false,
			note:
				'Known Vite/dev transform error observed during local screenshot runs; retained as a technical warning and not treated as screenshot-blocking unless visual validation fails.',
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
