/* eslint-disable max-lines -- Shared compatibility utilities remain one import surface for the capture adapters. */
// =============================================================================
// CELEBRA-ME | Screenshot Tool — Utility Functions
// =============================================================================

import * as path from 'node:path';
import * as syncFs from 'node:fs';
import * as fs from 'node:fs/promises';
import {
	detectWorktreeLane,
	getWorktreeDevServerPort,
	type WorktreeLaneId,
} from '../shared/worktree-lane.ts';
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
	type SectionExtent,
	type ValidationStatus,
	VIEWPORT_PROFILES,
} from './types.js';
import type { ResolvedScreenshotPlan } from './scope.js';
import {
	isSafeScreenshotArtifactSegment,
	validateScreenshotConfig,
} from './registry-validation.js';
import { redactScreenshotPlan, redactScreenshotReport, redactScreenshotText } from './redaction.js';
export {
	redactScreenshotPlan,
	redactScreenshotReport,
	redactScreenshotText,
	redactScreenshotUrl,
} from './redaction.js';
export {
	calculateImageHash,
	getFileArtifactMeta,
	invalidateStaleInvitationFullPage,
	publishArtifactAtomically,
	removeLegacyInvitationFullOpenArtifacts,
	validateBlankBottom,
	verifyPhysicalPng,
	verifySectionCropInclusion,
} from './artifact-validation.js';
export type {
	LayoutEvidence,
	PhysicalPngVerificationResult,
	SectionCropVerificationResult,
	VerifyPhysicalPngOptions,
	VerifySectionCropOptions,
} from './artifact-validation.js';

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
	const booleanFlags = new Set([
		'--interactive',
		'--no-interactive',
		'--include-layout',
		'--corpus',
		'--clean',
		'--allow-large',
		'--help',
	]);

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		// --no-* flags
		if (arg === '--no-interactive') {
			options.interactive = false;
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			options.help = true;
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
			if (!booleanFlags.has(key) && next && !next.startsWith('-')) {
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
			} else {
				throw new ScreenshotCliError(`Unknown or incomplete short option "${arg}".`);
			}
			continue;
		}

		throw new ScreenshotCliError(`Unexpected positional argument "${arg}".`);
	}

	return options;
}

export class ScreenshotCliError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ScreenshotCliError';
	}
}

function parseBoolean(value: string, key: string): boolean {
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new ScreenshotCliError(`Invalid value "${value}" for ${key}; expected true or false.`);
}

function requireValue(value: string, key: string): string {
	const trimmed = value.trim();
	if (!trimmed) throw new ScreenshotCliError(`${key} requires a non-empty value.`);
	return trimmed;
}

function setOption(options: CliOptions, key: string, value: string): void {
	// Single source of truth for CLI flag → option mapping. Flag names follow
	// kebab-case (matches README). CamelCase aliases were removed in favor of
	// a canonical, documented surface.
	const handlers: Record<string, () => void> = {
		'--interactive': () => {
			options.interactive = parseBoolean(value, key);
		},
		'--url': () => {
			options.url = requireValue(value, key);
		},
		'--base-url': () => {
			options.baseUrl = requireValue(value, key);
		},
		'--type': () => {
			if (
				!['invitation', 'landing', 'dashboard', 'admin', 'login', 'custom'].includes(value)
			) {
				throw new ScreenshotCliError(`Invalid page type "${value}" for ${key}.`);
			}
			options.pageType = value as PageType;
		},
		'--mode': () => {
			if (!isScreenshotMode(value))
				throw new ScreenshotCliError(`Invalid screenshot mode "${value}".`);
			options.mode = value;
		},
		'--viewport': () => {
			const values = value
				.split(',')
				.map((v) => v.trim())
				.filter(Boolean);
			if (values.length === 0)
				throw new ScreenshotCliError(`${key} requires at least one viewport.`);
			options.viewport = (options.viewport ?? []).concat(values);
		},
		'--profile': () => {
			if (!['invitation', 'site', 'full', 'single'].includes(value)) {
				throw new ScreenshotCliError(`Invalid viewport profile "${value}".`);
			}
			options.profile = value as ViewportProfileType;
		},
		'--target': () => {
			if (
				![
					'full-page',
					'critical-qa',
					'all-sections',
					'single-section',
					'reveal-only',
				].includes(value)
			) {
				throw new ScreenshotCliError(`Invalid screenshot target "${value}".`);
			}
			options.target = value as CaptureTarget;
		},
		'--include-layout': () => {
			options.includeLayout = parseBoolean(value, key);
		},
		'--set': () => {
			setInvitationSet(options, value);
		},
		'--general-set': () => {
			if (value !== 'basic' && value !== 'full-qa')
				throw new ScreenshotCliError(`Invalid general set "${value}".`);
			options.generalSet = value;
		},
		'--reveal': () => {
			if (!['auto', 'force-open', 'closed-only', 'open-only', 'skip'].includes(value))
				throw new ScreenshotCliError(`Invalid reveal mode "${value}".`);
			options.reveal = value as CliOptions['reveal'];
		},
		'--animation': () => {
			if (!['disable', 'wait', 'query-param', 'custom'].includes(value))
				throw new ScreenshotCliError(`Invalid animation mode "${value}".`);
			options.animation = value as CliOptions['animation'];
		},
		'--sections': () => {
			options.sections = requireValue(value, key);
		},
		'--section-selectors': () => {
			throw new ScreenshotCliError(
				`${key} was removed from the strict scope pipeline; use --sections=<registered-id>.`,
			);
		},
		'--section-extent': () => {
			if (value !== 'full' && value !== 'viewport')
				throw new ScreenshotCliError(`Invalid section extent "${value}".`);
			options.sectionExtent = value as SectionExtent;
		},
		'--auth': () => {
			if (!['none', 'existing-session', 'storage-state', 'manual-login'].includes(value))
				throw new ScreenshotCliError(`Invalid auth method "${value}".`);
			options.auth = value as CliOptions['auth'];
		},
		'--format': () => {
			if (!['png', 'jpeg', 'webp', 'pdf'].includes(value))
				throw new ScreenshotCliError(`Invalid output format "${value}".`);
			options.format = value as OutputFormat;
		},
		'--output': () => {
			options.output = requireValue(value, key);
		},
		'--output-style': () => {
			if (!['default', 'timestamped', 'custom', 'overwrite'].includes(value))
				throw new ScreenshotCliError(`Invalid output style "${value}".`);
			options.outputStyle = value as CliOptions['outputStyle'];
		},
		'--config': () => {
			options.config = requireValue(value, key);
		},
		'--corpus': () => {
			options.corpus = parseBoolean(value, key);
		},
		'--clean': () => {
			options.clean = parseBoolean(value, key);
		},
		'--allow-large': () => {
			options.allowLarge = parseBoolean(value, key);
		},
		'--help': () => {
			options.help = true;
		},
	};

	const handler = handlers[key];
	if (!handler) throw new ScreenshotCliError(`Unknown screenshot argument "${key}".`);
	handler();
}

function setInvitationSet(options: CliOptions, value: string): void {
	// Map CLI-friendly values to internal enum
	const mapped =
		value === 'essential-invitation'
			? 'essential'
			: value === 'full-qa-invitation'
				? 'full-qa'
				: value;
	if (!['essential', 'full-qa', 'reveal-only', 'full-page'].includes(mapped)) {
		throw new ScreenshotCliError(`Invalid invitation set "${value}".`);
	}
	options.invitationSet = mapped as CliOptions['invitationSet'];
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
		default:
			throw new ScreenshotCliError(`Unknown short option "${key}".`);
	}
}

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

export interface ScreenshotLaneContext {
	laneId: WorktreeLaneId;
	displayName: string;
	port: number;
	baseUrl: string;
	/** True when base URL came from ASTRO_PORT / explicit override rather than lane table. */
	portSource: 'lane' | 'astro-port' | 'explicit';
}

/**
 * Resolve the default screenshot base URL for the current worktree lane.
 *
 * Ports match Astro `server.port` / `getWorktreeDevServerPort`:
 * - Integration (`develop` trunk) / `dev-local` → 4321
 * - `dev-extra` → 4322
 * - `dev-preview` → 4323
 *
 * `ASTRO_PORT` overrides the lane table (same contract as `astro.config.mjs`).
 * Explicit `--base-url` / config `baseUrl` should be passed via `explicitBaseUrl`.
 */
export function resolveScreenshotBaseUrl(options?: {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	explicitBaseUrl?: string;
}): string {
	return resolveScreenshotLaneContext(options).baseUrl;
}

export function resolveScreenshotLaneContext(options?: {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	explicitBaseUrl?: string;
}): ScreenshotLaneContext {
	const explicit = options?.explicitBaseUrl?.trim();
	if (explicit) {
		const normalized = explicit.replace(/\/+$/, '');
		let port = 0;
		try {
			const parsed = Number(new URL(normalized).port);
			if (Number.isFinite(parsed) && parsed > 0) {
				port = parsed;
			}
		} catch {
			// Non-URL explicit values keep port 0.
		}
		return {
			laneId: 'unknown',
			displayName: 'Explicit base URL',
			port,
			baseUrl: normalized,
			portSource: 'explicit',
		};
	}

	const env = options?.env ?? process.env;
	const astroPort = Number(env.ASTRO_PORT ?? '');
	if (Number.isFinite(astroPort) && astroPort > 0) {
		return {
			laneId: detectWorktreeLane(options?.cwd ?? process.cwd()).id,
			displayName: `ASTRO_PORT override (${astroPort})`,
			port: astroPort,
			baseUrl: `http://localhost:${astroPort}`,
			portSource: 'astro-port',
		};
	}

	const lane = detectWorktreeLane(options?.cwd ?? process.cwd());
	const port = getWorktreeDevServerPort(lane.id);
	return {
		laneId: lane.id,
		displayName: lane.displayName,
		port,
		baseUrl: `http://localhost:${port}`,
		portSource: 'lane',
	};
}

/**
 * Resolve a user-provided URL or route to a full URL.
 * If the input starts with http:// or https://, return as-is.
 * Otherwise, prepend the base URL.
 *
 * Handles MSYS/git-bash path expansion on Windows where
 * --url=/boda/... gets converted to C:/Program Files/Git/boda/...
 */
export function resolveUrl(input: string, baseUrl: string = resolveScreenshotBaseUrl()): string {
	const trimmed = input.trim();
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	// Strip known MSYS/Git Bash roots only (see tests). Prefer MSYS_NO_PATHCONV=1
	// (Git Bash) or MSYS2_ARG_CONV_EXCL="*" to disable conversion at the shell.
	let route = trimmed;
	const msysMatch = trimmed.match(
		/^[A-Za-z]:\/(?:Program Files\/Git|msys64|Users\/[^/]+\/scoop\/apps\/git\/current|Users\/[^/]+)\/(.+)$/i,
	);
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
			if (!found) {
				throw new Error(
					`Unknown viewport "${name}". Known names: mobile-narrow, mobile-standard, mobile-large, tablet, desktop`,
				);
			}
			if (!viewports.some((viewport) => viewport.name === found.name)) viewports.push(found);
		}
		return viewports;
	}
	return getViewportsForProfile(profile);
}

export function getDefaultCriticalSelectors(pageType: PageType): ScreenshotSelectorConfig[] {
	if (pageType === 'invitation') {
		return [
			{ selector: '[data-screenshot="invitation-root"]', required: true },
			{
				selector: '[data-screenshot="invitation-open-hero"], #inicio',
				required: true,
				capture: true,
				label: 'hero',
			},
			{
				selector: '[data-screenshot-section="gallery"], #galeria',
				required: false,
				capture: true,
				label: 'gallery',
			},
			{
				selector: '[data-screenshot-section="rsvp"], #rsvp',
				required: false,
				capture: true,
				label: 'rsvp',
			},
			{
				selector: '[data-screenshot-section="location"], #event-location',
				required: false,
				capture: true,
				label: 'location',
			},
			{
				selector: '[data-screenshot-section="thankYou"], #thank-you-section',
				required: false,
				capture: true,
				label: 'thankYou',
			},
		];
	}

	if (pageType === 'landing') {
		return [
			/* Required: hero, pricing, FAQ, contact */
			{
				selector: '[data-screenshot="landing-hero"], #inicio',
				required: true,
				capture: true,
				label: 'hero',
			},
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
			{
				selector: '[data-screenshot="landing-event-selector"], #tipo-evento',
				required: false,
			},
			{ selector: '[data-screenshot="landing-includes"], #servicios', required: false },
			{
				selector: '[data-screenshot="landing-guest-experience"], #experiencia-invitados',
				required: false,
			},
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

/**
 * Operational toolbars injected by local/preview hosts.
 * Hidden only under screenshot/audit capture CSS — never product UI.
 */
export function getOperationalToolbarSelectors(): string[] {
	return [
		'astro-dev-toolbar',
		'astro-dev-overlay',
		'#vercel-live-feedback',
		'vercel-live-feedback',
		'[data-vercel-toolbar]',
		'[data-vercel-toolbar-rel]',
		'#__vercel_toolbar',
	];
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
		...getOperationalToolbarSelectors(),
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

export function dedupeScreenshotNotices(notices: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const notice of notices) {
		const key = notice.trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(notice);
	}
	return out;
}

/** Blocking failures that must drive a non-zero CLI exit. */
export function computeScreenshotBlockingErrors(input: {
	captureFailed: number;
	validationFailed: number;
	manifestFailed: number;
}): number {
	return input.captureFailed + input.validationFailed + input.manifestFailed;
}

export function resolveScreenshotRunStatus(input: {
	failed: number;
	succeeded: number;
	warnings: number;
}): ValidationStatus {
	if (input.failed > 0) return input.succeeded > 0 ? 'partial' : 'failed';
	return input.warnings > 0 ? 'warning' : 'passed';
}

/** Targets whose manifest contract requires at least one successful output. */
export function expectsScreenshotOutput(target: CaptureTarget): boolean {
	return (
		target === 'critical-qa' ||
		target === 'full-page' ||
		target === 'all-sections' ||
		target === 'single-section' ||
		target === 'reveal-only'
	);
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
				successfulCaptures.map((c) => c.id).filter((id): id is string => Boolean(id)),
			);

			const plannedTasks = input.perViewportPlannedTasks?.[viewport.name] ?? [];
			const requiredTasks = plannedTasks.filter((t) => t.required);
			const optionalTasks = plannedTasks.filter((t) => !t.required);

			const missingRequiredTaskIds: string[] = [];
			if (requiredTasks.length > 0) {
				for (const task of requiredTasks) {
					if (!task.id || !successfulIds.has(task.id)) {
						missingRequiredTaskIds.push(task.id || '(missing-task-id)');
					}
				}
			}

			const files = successfulCaptures.length;
			const plannedRequired =
				requiredTasks.length > 0
					? requiredTasks.length
					: (input.perViewportPlanned[viewport.name] ?? 0);
			const expectsOutput = expectsScreenshotOutput(input.target);

			// Pass when every required planned task succeeded. Optional extras may
			// increase `files` above `expected` without failing the run.
			const isPassed =
				expectsOutput &&
				plannedRequired > 0 &&
				missingRequiredTaskIds.length === 0 &&
				(requiredTasks.length > 0 || files >= plannedRequired);

			const manifestItem: ViewportManifestReport = {
				name: viewport.name,
				files,
				expected: plannedRequired,
				status: isPassed ? 'passed' : 'failed',
			};

			if (plannedTasks.length > 0) {
				manifestItem.plannedTotal = plannedTasks.length;
				manifestItem.requiredExpected = requiredTasks.length;
				manifestItem.requiredVerified =
					requiredTasks.length - missingRequiredTaskIds.length;
				manifestItem.optionalExpected = optionalTasks.length;
				manifestItem.optionalGenerated = optionalTasks.filter((t) =>
					successfulIds.has(t.id),
				).length;
				manifestItem.optionalOmitted = optionalTasks.filter(
					(t) => !successfulIds.has(t.id),
				).length;
				manifestItem.missingRequiredTaskIds = missingRequiredTaskIds;
			}

			return manifestItem;
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function classifyConsoleError(message: string): ConsoleErrorReport {
	const safeMessage = redactScreenshotText(message);
	if (message.includes('__name is not defined')) {
		return {
			message: safeMessage,
			severity: 'warning',
			source: 'test-runner-transpiler',
			environment: 'development',
			productionRisk: 'none',
			affectsScreenshotReliability: false,
			note: 'Dev-only esbuild/tsx helper ReferenceError that occurs when transpiled callbacks are executed in the browser context via Playwright page.evaluate. Confirmed to have zero production risk as this code is only run inside the screenshot testing harness.',
		};
	}

	if (message.includes('jsxDEV is not a function')) {
		return {
			message: safeMessage,
			severity: 'warning',
			source: 'test-runner-transpiler',
			environment: 'development',
			productionRisk: 'none',
			affectsScreenshotReliability: false,
			note: 'Dev-only React JSX development runtime helper (jsxDEV) present in the Astro/Vite dev-server bundle but not available under tsx execution. Production builds (astro build) compile JSX with the production jsxRuntime (jsx/jsxs, not jsxDEV). Zero production risk — only occurs during local screenshot runs against the dev server.',
		};
	}

	if (
		message.includes("Cannot read properties of null (reading 'useState')") &&
		message.includes('framer-motion.js') &&
		message.includes('RSVP.tsx')
	) {
		return {
			message: safeMessage,
			severity: 'warning',
			source: 'page-script',
			environment: 'development',
			productionRisk: 'unlikely',
			affectsScreenshotReliability: false,
			note: 'Observed only during local screenshot runs against the Vite dev server while hydrating the RSVP React island with framer-motion. Production build validation passes, and the screenshot targets for these runs are still generated. Treat as a dev-server hydration quirk unless reproduced in a production bundle.',
		};
	}

	if (
		message.includes('Outdated Optimize Dep') ||
		message.includes('Failed to fetch dynamically imported module') ||
		(message.includes('ERR_ABORTED') && message.includes('zod.js')) ||
		message.includes('astro-retry=')
	) {
		return {
			message: safeMessage,
			severity: 'warning',
			source: 'test-runner-transpiler',
			environment: 'development',
			productionRisk: 'none',
			affectsScreenshotReliability: false,
			note: 'Dev-only Vite dependency optimizer re-bundling request abortion (504 Outdated Optimize Dep) or dynamic import retry. Occurs when multiple fresh Playwright contexts query the Vite dev server in rapid succession. Zero production risk as production builds pre-bundle all modules into static chunks.',
		};
	}

	return {
		message: safeMessage,
		severity: 'critical',
		source: message.startsWith('pageerror:') ? 'page-script' : 'browser',
		environment: 'unknown',
		productionRisk: 'unknown',
		affectsScreenshotReliability: true,
		note: 'Unhandled browser/page error during capture; treat as screenshot-reliability risk until investigated.',
	};
}

// ---------------------------------------------------------------------------
// Config and report files
// ---------------------------------------------------------------------------

export function loadScreenshotConfig(configPath: string): ScreenshotConfig {
	let parsed: unknown;
	try {
		const raw = syncFs.readFileSync(configPath, 'utf8');
		parsed = JSON.parse(raw) as unknown;
	} catch (error) {
		throw new Error(
			`Could not load screenshot config ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
	return validateScreenshotConfig(parsed, configPath);
}

export async function writeScreenshotReport(
	outputDir: string,
	report: ScreenshotRunReport,
): Promise<string> {
	await ensureDir(outputDir);
	const reportPath = path.join(outputDir, 'report.json');
	await fs.writeFile(
		reportPath,
		`${JSON.stringify(redactScreenshotReport(report), null, 2)}\n`,
		'utf8',
	);
	return reportPath;
}

/** Persist the resolved scope before Playwright is launched. */
export async function writeScreenshotPreflight(
	outputDir: string,
	plan: ResolvedScreenshotPlan,
): Promise<string> {
	await ensureDir(outputDir);
	const preflightPath = path.join(outputDir, 'preflight.json');
	await fs.writeFile(
		preflightPath,
		`${JSON.stringify(redactScreenshotPlan(plan), null, 2)}\n`,
		'utf8',
	);
	return preflightPath;
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
	if (!isSafeScreenshotArtifactSegment(viewportName) || !isSafeScreenshotArtifactSegment(label)) {
		throw new Error(
			`Unsafe screenshot artifact name: viewport="${viewportName}" label="${label}".`,
		);
	}
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
 * Intersect an element box (viewport coordinates) with the visible viewport.
 * Returns null when there is no visible overlap.
 */
export function intersectRectWithViewport(
	box: { x: number; y: number; width: number; height: number },
	viewport: { width: number; height: number },
): { x: number; y: number; width: number; height: number } | null {
	const left = Math.max(0, box.x);
	const top = Math.max(0, box.y);
	const right = Math.min(viewport.width, box.x + box.width);
	const bottom = Math.min(viewport.height, box.y + box.height);
	const width = right - left;
	const height = bottom - top;
	if (width <= 0 || height <= 0) return null;
	return { x: left, y: top, width, height };
}

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
