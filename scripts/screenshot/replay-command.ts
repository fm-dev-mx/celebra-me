// =============================================================================
// CELEBRA-ME | Screenshot Tool — Replay command formatter
// =============================================================================

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CaptureTarget, ScreenshotJob } from './types.js';
import { resolveScreenshotLaneContext } from './utils.js';

const SECTION_TARGETS: ReadonlySet<CaptureTarget> = new Set([
	'critical-qa',
	'all-sections',
	'single-section',
]);

/**
 * Extract a relative route pathname from a job URL (absolute or relative).
 */
export function jobUrlToRoute(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) return '/';
	try {
		if (/^https?:\/\//i.test(trimmed)) {
			const pathname = new URL(trimmed).pathname.replace(/\/+$/, '') || '/';
			return pathname;
		}
	} catch {
		// Fall through to relative normalization.
	}
	let route = trimmed;
	if (!route.startsWith('/')) route = `/${route}`;
	return route.replace(/\/+$/, '') || '/';
}

/**
 * Absolute filesystem path for a job's resolved screenshot output directory.
 */
function resolveJobOutputDirAbsolute(job: ScreenshotJob, cwd: string = process.cwd()): string | null {
	const relative = job.scope?.invitations[0]?.outputDir;
	if (!relative) return null;
	return path.resolve(cwd, relative);
}

/**
 * Unique absolute output directories for one or more jobs (stable order).
 */
export function collectJobOutputDirsAbsolute(
	jobs: ScreenshotJob[],
	cwd: string = process.cwd(),
): string[] {
	const seen = new Set<string>();
	const dirs: string[] = [];
	for (const job of jobs) {
		const absolute = resolveJobOutputDirAbsolute(job, cwd);
		if (!absolute) continue;
		const key = absolute.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		dirs.push(absolute);
	}
	return dirs;
}

/**
 * file:// URI for terminal click-to-open (VS Code / Cursor).
 */
export function toClickableFileUri(absolutePath: string): string {
	return pathToFileURL(path.resolve(absolutePath)).href;
}

function flag(name: string, value: string | boolean): string {
	return `--${name}=${value}`;
}

/**
 * Build a copy-pasteable `pnpm screenshot` command that reproduces the same
 * scope as an interactive (or otherwise resolved) ScreenshotJob.
 */
export function formatScreenshotReplayCommand(
	job: ScreenshotJob,
	options?: { laneBaseUrl?: string },
): string {
	const parts: string[] = ['pnpm', 'screenshot'];

	parts.push(flag('url', jobUrlToRoute(job.url)));
	parts.push(flag('type', job.pageType));
	parts.push(flag('target', job.target));

	const sectionIds =
		job.selectedSections && job.selectedSections.length > 0
			? job.selectedSections
			: job.selectedSection
				? [job.selectedSection]
				: [];
	if (sectionIds.length > 0) {
		parts.push(flag('sections', sectionIds.join(',')));
	}

	if (SECTION_TARGETS.has(job.target)) {
		parts.push(flag('section-extent', job.sectionExtent ?? 'full'));
	}

	const profile = job.viewportProfile;
	if (profile === 'invitation' || profile === 'site' || profile === 'full') {
		parts.push(flag('profile', profile));
	} else {
		// single / custom / unexpected: emit explicit viewport names
		if (profile === 'single') {
			parts.push(flag('profile', 'single'));
		}
		const viewportNames = job.viewports.map((viewport) => viewport.name).filter(Boolean);
		if (viewportNames.length > 0) {
			parts.push(flag('viewport', viewportNames.join(',')));
		}
	}

	if (job.pageType === 'invitation') {
		parts.push(flag('reveal', job.revealHandling));
	}

	if (job.mode && job.mode !== 'audit') {
		parts.push(flag('mode', job.mode));
	}

	if (job.authMethod && job.authMethod !== 'none') {
		parts.push(flag('auth', job.authMethod));
	}

	if (job.outputFormat && job.outputFormat !== 'png') {
		parts.push(flag('format', job.outputFormat));
	}

	if (job.outputFolderStyle && job.outputFolderStyle !== 'default') {
		parts.push(flag('output-style', job.outputFolderStyle));
	}

	if (job.outputFolder) {
		parts.push(flag('output', job.outputFolder));
	}

	if (
		job.pageType !== 'invitation' &&
		job.target === 'critical-qa' &&
		job.includeLayout !== true
	) {
		parts.push(flag('include-layout', false));
	}

	const laneBaseUrl = (options?.laneBaseUrl ?? resolveScreenshotLaneContext().baseUrl).replace(
		/\/+$/,
		'',
	);
	const jobBaseUrl = job.baseUrl.replace(/\/+$/, '');
	if (jobBaseUrl && jobBaseUrl !== laneBaseUrl) {
		parts.push(flag('base-url', jobBaseUrl));
	}

	return parts.join(' ');
}

/**
 * Print output directory path(s) and copy-paste replay command(s) after a run.
 */
export function printScreenshotReplayCommands(jobs: ScreenshotJob[]): void {
	if (jobs.length === 0) return;

	const outputDirs = collectJobOutputDirsAbsolute(jobs);
	console.log('');
	if (outputDirs.length > 0) {
		console.log('── Output ──');
		for (const dir of outputDirs) {
			console.log(dir);
			console.log(toClickableFileUri(dir));
		}
		console.log('');
	}

	console.log('── Replay (same scope) ──');
	for (const job of jobs) {
		console.log(formatScreenshotReplayCommand(job));
	}
	console.log('');
}
