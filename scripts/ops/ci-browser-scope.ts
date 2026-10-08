import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { isVisualImpactPath, normalizeVisualPath } from './visual-impact.ts';

/**
 * Decides whether the Repository CI browser tier must execute for a `develop` push.
 *
 * The tier is skipped only when every browser input (application sources, served assets, the
 * browser harness and its configuration) is byte-identical to the head of an earlier `develop`
 * push whose browser job passed. Pull requests, manual dispatches and every uncertain case run
 * the tier (fail-open). A run that skipped the tier never serves as evidence itself: its browser
 * job concludes `skipped`, so evidence reuse and this assessment both look past it.
 */

/** Browser inputs beyond the shared visual-impact classifier (which already covers assets, harness and lockfile). */
export const BROWSER_INPUT_PATTERNS = [
	/^src\//u,
	/^public\//u,
	/^scripts\/shared\//u,
	/^tests\/fixtures\//u,
	/^scripts\/ops\/(?:ci-browser-scope|browser-outcome|visual-impact)\.ts$/u,
	/^\.github\/workflows\/commit-validation\.yml$/u,
	/^(?:\.npmrc|tsconfig(?:\..+)?\.json|vercel\.json)$/u,
];

export const BROWSER_JOB_NAME = 'Application / browser';
export const SCOPE_WORKFLOW_FILE = 'commit-validation.yml';
export const SCOPE_SOURCE_BRANCH = 'develop';

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
	refName: string;
	proven: ProvenRun | null;
	/** Paths changed between the proven head and this head; null when unknown. */
	changedPaths: string[] | null;
}): ScopeDecision {
	if (input.eventName !== 'push' || input.refName !== SCOPE_SOURCE_BRANCH)
		return run(`Only ${SCOPE_SOURCE_BRANCH} pushes may inherit browser evidence.`);
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

const EXACT_SHA = /^[a-f0-9]{40}$/u;

async function githubApi(suffix: string, repository: string, token: string): Promise<unknown> {
	const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
	const response = await fetch(`${apiUrl}/repos/${repository}/${suffix}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		},
	});
	if (!response.ok) throw new Error(`Cannot read ${suffix}: HTTP ${response.status}.`);
	return response.json();
}

/** Most recent successful `develop` push run whose browser job itself concluded `success`. */
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
		const browserJob = (body.jobs ?? []).find((job) => job.name === BROWSER_JOB_NAME);
		if (browserJob?.conclusion === 'success') {
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
	const refName = process.env.GITHUB_REF_NAME ?? '';
	const repository = process.env.GITHUB_REPOSITORY ?? '';
	const token = process.env.GH_TOKEN ?? '';
	const headSha = process.env.GITHUB_SHA ?? '';
	if (eventName !== 'push' || refName !== SCOPE_SOURCE_BRANCH)
		return assessBrowserScope({ eventName, refName, proven: null, changedPaths: null });
	if (!token || !repository || !EXACT_SHA.test(headSha))
		return run('Scope inputs are incomplete.');
	const proven = await findProvenRun(repository, token, process.env.GITHUB_RUN_ID ?? '');
	const changedPaths = proven ? changedPathsSince(proven.headSha, headSha) : null;
	return assessBrowserScope({ eventName, refName, proven, changedPaths });
}

async function main(): Promise<void> {
	let decision: ScopeDecision;
	try {
		decision = await decide();
	} catch (error) {
		// Unreadable evidence never skips a tier.
		decision = run(error instanceof Error ? error.message : String(error));
	}
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(
			process.env.GITHUB_OUTPUT,
			`browser=${decision.browser}\nsource_run_id=${decision.sourceRunId ?? ''}\n`,
		);
	}
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(
			process.env.GITHUB_STEP_SUMMARY,
			`Browser scope: ${decision.browser} — ${decision.reason}\n`,
		);
	}
	console.log(JSON.stringify(decision));
}

if (process.argv[1] && /^ci-browser-scope\.(?:ts|js)$/u.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
