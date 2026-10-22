import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { isVisualImpactPath, normalizeVisualPath } from './visual-impact.ts';
import { githubApi } from '../lib/github-api.ts';
import { BROWSER_JOB_NAME, jobPassed } from './ci-browser-jobs.ts';

/**
 * Decides whether the Repository CI browser tier must execute for a `develop` push or a pull
 * request into `develop`.
 *
 * The tier is skipped only when every browser input (application sources, served assets, the
 * browser harness and its configuration) of the validated commit is byte-identical to the head of
 * an earlier `develop` push whose browser jobs passed. For a pull request the validated commit is
 * its merge candidate, so changes on `develop` since that run count as well. Pull requests into
 * other branches, manual dispatches and every uncertain case run the tier (fail-open). A run that
 * skipped the tier never serves as evidence itself: its browser jobs conclude `skipped`, so
 * evidence reuse and this assessment both look past it.
 *
 * It also decides whether the tier runs the complete visual parity suites (`assessVisualParity`).
 */

/** Browser inputs beyond the shared visual-impact classifier (which already covers assets, harness and lockfile). */
export const BROWSER_INPUT_PATTERNS = [
	/^src\//u,
	/^public\//u,
	/^scripts\/shared\//u,
	/^tests\/fixtures\//u,
	/^scripts\/ops\/(?:ci-browser-jobs|ci-browser-scope|browser-outcome|visual-impact)\.ts$/u,
	/^\.github\/workflows\/commit-validation\.yml$/u,
	/^(?:\.npmrc|tsconfig(?:\..+)?\.json)$/u,
];

/** Every job of the browser tier; a source run proves the tier only when all of them passed. */
export const BROWSER_JOB_NAMES = [BROWSER_JOB_NAME, 'Application / browser memories'] as const;
export const SCOPE_WORKFLOW_FILE = 'commit-validation.yml';
export const SCOPE_SOURCE_BRANCH = 'develop';

/** Events whose run may inherit browser evidence when they validate `develop`. */
export const SCOPE_EVENTS = ['push', 'pull_request'] as const;

export type BrowserScope = 'run' | 'skip';

export interface ScopeDecision {
	browser: BrowserScope;
	reason: string;
	sourceRunId: number | null;
}

export interface ProvenRun {
	id: number;
	headSha: string;
}

export function isBrowserInput(path: string): boolean {
	const normalized = normalizeVisualPath(path);
	return (
		isVisualImpactPath(normalized) ||
		BROWSER_INPUT_PATTERNS.some((pattern) => pattern.test(normalized))
	);
}

export function browserInputFiles(paths: string[]): string[] {
	return [...new Set(paths.map(normalizeVisualPath))].filter(isBrowserInput).sort();
}

function run(reason: string): ScopeDecision {
	return { browser: 'run', reason, sourceRunId: null };
}

export function assessBrowserScope(input: {
	eventName: string;
	/** Branch the run validates: the pushed branch, or the base branch of a pull request. */
	refName: string;
	proven: ProvenRun | null;
	/** Paths changed between the proven head and this head; null when unknown. */
	changedPaths: string[] | null;
}): ScopeDecision {
	if (
		!(SCOPE_EVENTS as readonly string[]).includes(input.eventName) ||
		input.refName !== SCOPE_SOURCE_BRANCH
	)
		return run(
			`Only ${SCOPE_SOURCE_BRANCH} pushes and pull requests into ${SCOPE_SOURCE_BRANCH} may inherit browser evidence.`,
		);
	if (!input.proven) return run('No earlier integration run with a passing browser tier exists.');
	if (!Array.isArray(input.changedPaths))
		return run(`The diff against integration run ${input.proven.id} is unavailable.`);
	const inputs = browserInputFiles(input.changedPaths);
	if (inputs.length > 0)
		return run(
			`Browser inputs changed since integration run ${input.proven.id}: ${inputs.join(', ')}`,
		);
	return {
		browser: 'skip',
		reason: `Browser inputs are identical to integration run ${input.proven.id} (${input.proven.headSha}), whose browser tier passed.`,
		sourceRunId: input.proven.id,
	};
}

/**
 * Paths that change how invitations, demos or their sections render, or how the complete visual
 * parity suites capture them. A pull request into develop that touches one runs both suites.
 */
export const VISUAL_PARITY_INPUT_PATTERNS = [
	/^src\/invitations\//u,
	/^src\/styles\/(?!(?:auth|dashboard|home|intake|showroom)\/|(?:auth|dashboard|intake|landing)\.scss$)/u,
	/^src\/components\/(?!(?:dashboard|home|intake|showroom)\/)/u,
	/^src\/(?:assets|content|data|layouts|lib\/invitation|interfaces\/ui\/sections)\//u,
	/^src\/pages\/\[eventType\]\//u,
	/^public\/.*\.(?:avif|gif|jpe?g|otf|png|svg|ttf|webp|woff2?)$/u,
	/^scripts\/provision\/(?:invitations|local-render-corpus)\//u,
	/^scripts\/(?:playwright|screenshot)\//u,
	/^tests\/e2e\/(?:harness|visual-baselines)\//u,
	/^tests\/e2e\/(?:canonical-invitation-page-parity|structural-variant-portability)\.spec\.ts$/u,
	/^tests\/fixtures\//u,
	/^scripts\/ops\/(?:ci-browser-jobs|ci-browser-scope)\.ts$/u,
	/^\.github\/workflows\/commit-validation\.yml$/u,
	/^(?:astro|playwright)\.config\./u,
	/^(?:package\.json|pnpm-lock\.yaml)$/u,
];

/** Browser job parts: the complete page parity suite beside every other browser check. */
export const SPLIT_BROWSER_PARTS = ['pages', 'rest'] as const;

export interface VisualParityDecision {
	visual: 'full' | 'deferred';
	/** Matrix of the browser job; `all` runs every browser check in one job. */
	parts: readonly string[];
	reason: string;
}

export function isVisualParityInput(path: string): boolean {
	const normalized = normalizeVisualPath(path);
	return VISUAL_PARITY_INPUT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function fullParity(reason: string): VisualParityDecision {
	return { visual: 'full', parts: SPLIT_BROWSER_PARTS, reason };
}

/**
 * Decides whether the browser job runs the complete visual parity suites. Only a pull request
 * into develop that changes no visual parity input defers them, in one job; every other run and
 * every uncertain case runs them, split into two parallel jobs.
 */
export function assessVisualParity(input: {
	eventName: string;
	refName: string;
	/** Paths the pull request changes against its base; null when unknown. */
	changedPaths: string[] | null;
}): VisualParityDecision {
	if (input.eventName !== 'pull_request' || input.refName !== SCOPE_SOURCE_BRANCH)
		return fullParity(
			`Only pull requests into ${SCOPE_SOURCE_BRANCH} may defer complete visual parity.`,
		);
	if (!Array.isArray(input.changedPaths))
		return fullParity('The pull request diff is unavailable.');
	const inputs = [...new Set(input.changedPaths.map(normalizeVisualPath))]
		.filter(isVisualParityInput)
		.sort();
	if (inputs.length > 0) return fullParity(`Visual parity inputs changed: ${inputs.join(', ')}`);
	return {
		visual: 'deferred',
		parts: ['all'],
		reason: 'No visual parity input changed; develop and the nightly run check them.',
	};
}

const EXACT_SHA = /^[a-f0-9]{40}$/u;

/** Most recent successful `develop` push run whose browser jobs themselves concluded `success`. */
async function findProvenRun(
	repository: string,
	token: string,
	currentRunId: string,
): Promise<ProvenRun | null> {
	const query = new URLSearchParams({
		event: 'push',
		branch: SCOPE_SOURCE_BRANCH,
		status: 'success',
		per_page: '20',
	});
	const listing = (await githubApi(
		`actions/workflows/${SCOPE_WORKFLOW_FILE}/runs?${query.toString()}`,
		repository,
		token,
	)) as {
		workflow_runs?: Array<{
			id: number;
			head_sha: string;
			head_repository?: { full_name?: string } | null;
		}>;
	};
	for (const candidate of listing.workflow_runs ?? []) {
		if (String(candidate.id) === currentRunId) continue;
		if (candidate.head_repository?.full_name !== repository) continue;
		if (!EXACT_SHA.test(candidate.head_sha)) continue;
		const body = (await githubApi(
			`actions/runs/${candidate.id}/jobs?filter=latest&per_page=100`,
			repository,
			token,
		)) as { jobs?: Array<{ name: string; conclusion: string | null }> };
		const jobs = body.jobs ?? [];
		const browserTierPassed = BROWSER_JOB_NAMES.every((name) => jobPassed(jobs, name));
		if (browserTierPassed) {
			return { id: candidate.id, headSha: candidate.head_sha };
		}
	}
	return null;
}

function git(args: string[]): string {
	return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function changedPathsSince(provenSha: string, headSha: string): string[] | null {
	try {
		git(['cat-file', '-e', `${provenSha}^{commit}`]);
		execFileSync('git', ['merge-base', '--is-ancestor', provenSha, headSha]);
		return git(['diff', '--name-only', '--diff-filter=ACMRD', provenSha, headSha])
			.split(/\r?\n/u)
			.filter(Boolean);
	} catch {
		return null;
	}
}

async function decide(): Promise<ScopeDecision> {
	const eventName = process.env.GITHUB_EVENT_NAME ?? '';
	// A pull request validates its merge candidate (GITHUB_SHA) against its base branch.
	const refName =
		(eventName === 'pull_request'
			? process.env.GITHUB_BASE_REF
			: process.env.GITHUB_REF_NAME) ?? '';
	const repository = process.env.GITHUB_REPOSITORY ?? '';
	const token = process.env.GH_TOKEN ?? '';
	const headSha = process.env.GITHUB_SHA ?? '';
	if (!(SCOPE_EVENTS as readonly string[]).includes(eventName) || refName !== SCOPE_SOURCE_BRANCH)
		return assessBrowserScope({ eventName, refName, proven: null, changedPaths: null });
	if (!token || !repository || !EXACT_SHA.test(headSha))
		return run('Scope inputs are incomplete.');
	const proven = await findProvenRun(repository, token, process.env.GITHUB_RUN_ID ?? '');
	const changedPaths = proven ? changedPathsSince(proven.headSha, headSha) : null;
	return assessBrowserScope({ eventName, refName, proven, changedPaths });
}

/** Paths a pull request changes: its merge candidate (GITHUB_SHA) against the base branch tip. */
function pullRequestChangedPaths(mergeSha: string): string[] | null {
	if (!EXACT_SHA.test(mergeSha)) return null;
	try {
		return git(['diff', '--name-only', '--diff-filter=ACMRD', `${mergeSha}^1`, mergeSha])
			.split(/\r?\n/u)
			.filter(Boolean);
	} catch {
		return null;
	}
}

function decideVisualParity(): VisualParityDecision {
	const eventName = process.env.GITHUB_EVENT_NAME ?? '';
	return assessVisualParity({
		eventName,
		refName: (eventName === 'pull_request' ? process.env.GITHUB_BASE_REF : '') ?? '',
		changedPaths:
			eventName === 'pull_request'
				? pullRequestChangedPaths(process.env.GITHUB_SHA ?? '')
				: null,
	});
}

async function main(): Promise<void> {
	let decision: ScopeDecision;
	try {
		decision = await decide();
	} catch (error) {
		// Unreadable evidence never skips a tier.
		decision = run(error instanceof Error ? error.message : String(error));
	}
	let parity: VisualParityDecision;
	try {
		parity = decideVisualParity();
	} catch (error) {
		// An unreadable diff never defers visual parity.
		parity = fullParity(error instanceof Error ? error.message : String(error));
	}
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(
			process.env.GITHUB_OUTPUT,
			`browser=${decision.browser}\nsource_run_id=${decision.sourceRunId ?? ''}\n` +
				`visual=${parity.visual}\nbrowser_parts=${JSON.stringify(parity.parts)}\n`,
		);
	}
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(
			process.env.GITHUB_STEP_SUMMARY,
			`Browser scope: ${decision.browser} — ${decision.reason}\n\n` +
				`Visual parity: ${parity.visual} — ${parity.reason}\n`,
		);
	}
	console.log(JSON.stringify({ ...decision, visualParity: parity }));
}

if (process.argv[1] && /^ci-browser-scope\.(?:ts|js)$/u.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
