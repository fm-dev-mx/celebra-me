// =============================================================================
// CELEBRA-ME | Screenshot Tool — Utility Functions
// =============================================================================

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {
	type PageType,
	type Viewport,
	type ViewportProfileType,
	type CliOptions,
	type OutputFormat,
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
			options.generalSet = value as any;
		},
		'--generalSet': () => {
			options.generalSet = value as any;
		},
		'--reveal': () => {
			options.reveal = value as any;
		},
		'--animation': () => {
			options.animation = value as any;
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
			options.auth = value as any;
		},
		'--format': () => {
			options.format = value as any;
		},
		'--output': () => {
			options.output = value;
		},
		'--output-style': () => {
			options.outputStyle = value as any;
		},
		'--outputStyle': () => {
			options.outputStyle = value as any;
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
	options.invitationSet = mapped as any;
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

/**
 * Look up a single named viewport from any profile.
 * Returns undefined if not found.
 */
export function findViewportByName(name: string): Viewport | undefined {
	for (const profile of Object.values(VIEWPORT_PROFILES)) {
		const found = profile.viewports.find((v) => v.name === name);
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
					`  ⚠ Unknown viewport "${name}" — skipping. Known names: mobile-small, mobile-standard, mobile-large, tablet, desktop`,
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
