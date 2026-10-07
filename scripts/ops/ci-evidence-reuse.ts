import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';

export const EVIDENCE_WORKFLOW_FILE = 'commit-validation.yml';
export const EVIDENCE_SOURCE_BRANCH = 'develop';
/** Every job the skipped tiers stand in for; a source run that skipped one proves nothing. */
export const REQUIRED_SOURCE_JOBS = [
	'Repository Policy',
	'Application / static',
	'Application / unit',
	'Application / database',
	'Application / browser',
	'Application Suite',
] as const;

export interface EvidenceRequest {
	eventName: string;
	repository: string;
	headRef: string;
	headRepository: string;
	headSha: string;
	headTreeSha: string;
	mergeTreeSha: string;
}

export interface SourceJob {
	name: string;
	conclusion: string | null;
}

export interface SourceRun {
	id: number;
	event: string;
	headBranch: string;
	headSha: string;
	headRepository: string;
	conclusion: string | null;
	jobs: SourceJob[];
}

export interface EvidenceDecision {
	reuse: boolean;
	reason: string;
	sourceRunId: number | null;
}

const EXACT_SHA = /^[a-f0-9]{40}$/u;

function declined(reason: string): EvidenceDecision {
	return { reuse: false, reason, sourceRunId: null };
}

/** Only the promotion pull request from this repository's integration branch may reuse evidence. */
export function ineligibilityReason(
	request: Pick<EvidenceRequest, 'eventName' | 'repository' | 'headRef' | 'headRepository'>,
): string | null {
	if (request.eventName !== 'pull_request') return 'Event is not a pull request.';
	if (!request.repository || request.headRepository !== request.repository)
		return 'Pull request head is outside this repository.';
	if (request.headRef !== EVIDENCE_SOURCE_BRANCH)
		return `Pull request head is not ${EVIDENCE_SOURCE_BRANCH}.`;
	return null;
}

function isCompleteSourceRun(run: SourceRun, request: EvidenceRequest): boolean {
	return (
		run.event === 'push' &&
		run.headBranch === EVIDENCE_SOURCE_BRANCH &&
		run.headSha === request.headSha &&
		run.headRepository === request.repository &&
		run.conclusion === 'success' &&
		REQUIRED_SOURCE_JOBS.every((name) =>
			run.jobs.some((job) => job.name === name && job.conclusion === 'success'),
		)
	);
}

/**
 * Integration evidence certifies the merge candidate only when both commits hold the same tree.
 * Anything short of a complete, successful push run for that exact head declines reuse, which
 * makes the workflow execute every tier.
 */
export function assessEvidenceReuse(request: EvidenceRequest, runs: SourceRun[]): EvidenceDecision {
	const ineligible = ineligibilityReason(request);
	if (ineligible) return declined(ineligible);
	if (!EXACT_SHA.test(request.headSha)) return declined('Pull request head SHA is not exact.');
	if (!EXACT_SHA.test(request.headTreeSha) || !EXACT_SHA.test(request.mergeTreeSha))
		return declined('Tree identity is unavailable.');
	if (request.headTreeSha !== request.mergeTreeSha)
		return declined('Merge candidate tree differs from the integration head tree.');
	const source = runs
		.filter((run) => isCompleteSourceRun(run, request))
		.sort((a, b) => b.id - a.id)[0];
	if (!source) return declined('No complete successful integration run exists for this head.');
	return {
		reuse: true,
		reason: `Tree ${request.headTreeSha} was validated by integration run ${source.id}.`,
		sourceRunId: source.id,
	};
}

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

async function loadTreeSha(sha: string, repository: string, token: string): Promise<string> {
	const commit = (await githubApi(`git/commits/${sha}`, repository, token)) as {
		tree?: { sha?: unknown };
	};
	return typeof commit.tree?.sha === 'string' ? commit.tree.sha : '';
}

async function loadSourceRuns(
	headSha: string,
	repository: string,
	token: string,
): Promise<SourceRun[]> {
	const query = new URLSearchParams({
		head_sha: headSha,
		event: 'push',
		branch: EVIDENCE_SOURCE_BRANCH,
		status: 'success',
		per_page: '20',
	});
	const listing = (await githubApi(
		`actions/workflows/${EVIDENCE_WORKFLOW_FILE}/runs?${query.toString()}`,
		repository,
		token,
	)) as {
		workflow_runs?: Array<{
			id: number;
			event: string;
			head_branch: string | null;
			head_sha: string;
			conclusion: string | null;
			head_repository?: { full_name?: string } | null;
		}>;
	};
	const runs: SourceRun[] = [];
	for (const run of listing.workflow_runs ?? []) {
		const body = (await githubApi(
			`actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
			repository,
			token,
		)) as { jobs?: SourceJob[] };
		runs.push({
			id: run.id,
			event: run.event,
			headBranch: run.head_branch ?? '',
			headSha: run.head_sha,
			headRepository: run.head_repository?.full_name ?? '',
			conclusion: run.conclusion,
			jobs: (body.jobs ?? []).map((job) => ({ name: job.name, conclusion: job.conclusion })),
		});
	}
	return runs;
}

async function decide(): Promise<EvidenceDecision> {
	const repository = process.env.GITHUB_REPOSITORY ?? '';
	const token = process.env.GH_TOKEN ?? '';
	const mergeSha = process.env.GITHUB_SHA ?? '';
	const eligibility = {
		eventName: process.env.GITHUB_EVENT_NAME ?? '',
		repository,
		headRef: process.env.PR_HEAD_REF ?? '',
		headRepository: process.env.PR_HEAD_REPOSITORY ?? '',
	};
	const headSha = process.env.PR_HEAD_SHA ?? '';
	const ineligible = ineligibilityReason(eligibility);
	if (ineligible) return declined(ineligible);
	if (!token || !EXACT_SHA.test(headSha) || !EXACT_SHA.test(mergeSha))
		return declined('Evidence inputs are incomplete.');
	const [headTreeSha, mergeTreeSha] = await Promise.all([
		loadTreeSha(headSha, repository, token),
		loadTreeSha(mergeSha, repository, token),
	]);
	const request = { ...eligibility, headSha, headTreeSha, mergeTreeSha };
	// Skip the run lookup when identity already fails; the assessment reports the reason.
	const runs =
		headTreeSha && headTreeSha === mergeTreeSha
			? await loadSourceRuns(headSha, repository, token)
			: [];
	return assessEvidenceReuse(request, runs);
}

async function main(): Promise<void> {
	let decision: EvidenceDecision;
	try {
		decision = await decide();
	} catch (error) {
		// Unreadable evidence is never approval: decline so every tier executes.
		decision = declined(error instanceof Error ? error.message : String(error));
	}
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(
			process.env.GITHUB_OUTPUT,
			`reuse=${decision.reuse}\nsource_run_id=${decision.sourceRunId ?? ''}\n`,
		);
	}
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(
			process.env.GITHUB_STEP_SUMMARY,
			`Evidence reuse: ${decision.reuse ? 'yes' : 'no'} — ${decision.reason}\n`,
		);
	}
	console.log(JSON.stringify(decision));
}

if (process.argv[1] && /^ci-evidence-reuse\.(?:ts|js)$/u.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
