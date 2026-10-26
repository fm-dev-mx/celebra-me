import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { assessExactEvidence } from './operational-evidence.ts';

export const STATIC_CAPABILITY_CHECK = 'Application / static';
/** Commit statuses published by `.github/workflows/deploy.yml` for the Cloudflare Workers. */
export const CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE = 'Cloudflare - celebra-me production smoke';
export const CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE = 'Cloudflare - celebra-me preview smoke';
/**
 * Smoke of a Production Worker version that serves no traffic yet
 * (`.github/workflows/deploy-production.yml`). Deliberately not a Production deployment smoke:
 * no release gate accepts it, because it proves a candidate, not what the domain serves.
 */
export const CLOUDFLARE_PRODUCTION_CANDIDATE_SMOKE =
	'Cloudflare - celebra-me production candidate smoke';
/** The Cloudflare smoke proves the deployed SHA for its environment. */
export const PRODUCTION_DEPLOYMENT_SMOKES = [CLOUDFLARE_PRODUCTION_DEPLOYMENT_SMOKE] as const;
export const PREVIEW_DEPLOYMENT_SMOKES = [CLOUDFLARE_PREVIEW_DEPLOYMENT_SMOKE] as const;
export const REQUIRED_RELEASE_CHECKS = [
	'Repository Policy',
	'Application Suite',
	STATIC_CAPABILITY_CHECK,
] as const;
export interface ReleaseCheck {
	name: string;
	sha: string;
	state: string;
	trusted: boolean;
}
export type RemoteCheckRun = ReleaseCheck;
export type GhRunner = (args: string[]) => string;
export type RemoteEvidenceIssue = 'unavailable' | 'invalid';

export class RemoteEvidenceError extends Error {
	constructor(
		readonly issue: RemoteEvidenceIssue,
		message: string,
	) {
		super(message);
		this.name = 'RemoteEvidenceError';
	}
}

export function isRemoteEvidenceUnavailable(error: unknown): boolean {
	return error instanceof RemoteEvidenceError && error.issue === 'unavailable';
}

/** A stalled `gh` call must surface as unavailable evidence instead of hanging the operator. */
const GH_TIMEOUT_MS = 30_000;

export function defaultGhRunner(args: string[]): string {
	return execFileSync('gh', args, { encoding: 'utf8', timeout: GH_TIMEOUT_MS });
}

// Repository identity cannot change within one process; resolve it once per runner.
const repositoryByRunner = new WeakMap<GhRunner, string>();

function resolveRepository(run: GhRunner): string {
	const cached = repositoryByRunner.get(run);
	if (cached) return cached;
	let repository: string;
	try {
		repository = run([
			'repo',
			'view',
			'--json',
			'nameWithOwner',
			'--jq',
			'.nameWithOwner',
		]).trim();
	} catch {
		throw new RemoteEvidenceError('unavailable', 'GitHub repository identity is unavailable.');
	}
	if (!repository)
		throw new RemoteEvidenceError('unavailable', 'GitHub repository identity is unavailable.');
	repositoryByRunner.set(run, repository);
	return repository;
}

export function createGitHubClient(run: GhRunner): {
	repository: string;
	api: (suffix: string) => unknown;
} {
	const repository = resolveRepository(run);
	return {
		repository,
		api: (suffix) => {
			try {
				return JSON.parse(run(['api', `repos/${repository}/${suffix}`]));
			} catch {
				throw new RemoteEvidenceError(
					'unavailable',
					'GitHub remote evidence is unavailable.',
				);
			}
		},
	};
}
export function requireProductionDeploymentSmoke(sha: string, checks: RemoteCheckRun[]): void {
	if (!/^[a-f0-9]{40}$/.test(sha))
		throw new RemoteEvidenceError('invalid', 'An exact deployed SHA is required.');
	const verified = PRODUCTION_DEPLOYMENT_SMOKES.some(
		(name) =>
			assessExactEvidence({
				sha,
				environment: 'production',
				records: checks.filter((check) => check.name === name),
				missingAction:
					'Collect the trusted Production smoke result for the exact deployed SHA.',
			}).status === 'VERIFIED',
	);
	if (!verified)
		throw new RemoteEvidenceError(
			'invalid',
			`Production deployment smoke blocked: ${PRODUCTION_DEPLOYMENT_SMOKES.join(' or ')}`,
		);
}

/** Proves the versioned deployed-app capability manifest passed its static validator. */
export function requireStaticCapabilityCheck(sha: string, checks: RemoteCheckRun[]): void {
	if (!/^[a-f0-9]{40}$/.test(sha))
		throw new RemoteEvidenceError('invalid', 'An exact deployed SHA is required.');
	const assessment = assessExactEvidence({
		sha,
		environment: 'repository',
		records: checks.filter((check) => check.name === STATIC_CAPABILITY_CHECK),
		missingAction: 'Collect the trusted static capability result for the exact SHA.',
	});
	if (assessment.status !== 'VERIFIED') {
		throw new RemoteEvidenceError(
			'invalid',
			`Static capability evidence blocked: ${STATIC_CAPABILITY_CHECK}`,
		);
	}
}
interface RemoteCheckRunRecord {
	id: number;
	name: string;
	head_sha: string;
	status: string;
	conclusion: string;
	app?: { id: number };
}
interface RemoteCommitStatus {
	context: string;
	state: string;
	creator?: { login: string };
}
/** GitHub caps one page at 100 entries; scheduled smokes keep adding runs to long-lived SHAs. */
const PAGE_SIZE = 100;
/** Bounds pagination so a misbehaving API cannot loop forever; beyond it evidence is unavailable. */
const MAX_PAGES = 20;

function pageSuffix(path: string, page: number): string {
	return page === 1 ? path : `${path}&page=${page}`;
}

/** Collects every check run reported for the commit, deduplicated by id across pages. */
function loadAllCheckRuns(api: (suffix: string) => unknown): RemoteCheckRunRecord[] {
	const byId = new Map<number, RemoteCheckRunRecord>();
	let total = 0;
	for (let page = 1; page <= MAX_PAGES; page += 1) {
		const response = api(
			pageSuffix(`check-runs?filter=latest&per_page=${PAGE_SIZE}`, page),
		) as { total_count: number; check_runs: RemoteCheckRunRecord[] };
		if (
			!response ||
			!Array.isArray(response.check_runs) ||
			typeof response.total_count !== 'number'
		)
			throw new RemoteEvidenceError('unavailable', 'Check result response is malformed.');
		total = Math.max(total, response.total_count);
		for (const run of response.check_runs) byId.set(run.id, run);
		if (byId.size >= total) return [...byId.values()];
		if (response.check_runs.length < PAGE_SIZE) break;
	}
	throw new RemoteEvidenceError('unavailable', 'Check result page is incomplete.');
}

/** Collects every commit status; the endpoint has no total, so a short page ends the list. */
function loadAllStatuses(api: (suffix: string) => unknown): RemoteCommitStatus[] {
	const statuses: RemoteCommitStatus[] = [];
	for (let page = 1; page <= MAX_PAGES; page += 1) {
		const response = api(pageSuffix(`statuses?per_page=${PAGE_SIZE}`, page));
		if (!Array.isArray(response))
			throw new RemoteEvidenceError('unavailable', 'Status result page is incomplete.');
		statuses.push(...(response as RemoteCommitStatus[]));
		if (response.length < PAGE_SIZE) return statuses;
	}
	throw new RemoteEvidenceError('unavailable', 'Status result page is incomplete.');
}

export function loadRemoteChecks(sha: string, run: GhRunner = defaultGhRunner): RemoteCheckRun[] {
	if (!/^[a-f0-9]{40}$/i.test(sha))
		throw new RemoteEvidenceError('invalid', 'An exact release SHA is required.');
	const client = createGitHubClient(run);
	const api = (suffix: string): unknown => client.api(`commits/${sha}/${suffix}`);
	const checkRuns = loadAllCheckRuns(api);
	const statuses = loadAllStatuses(api);
	const names = new Set([
		...REQUIRED_RELEASE_CHECKS,
		...PRODUCTION_DEPLOYMENT_SMOKES,
		...PREVIEW_DEPLOYMENT_SMOKES,
	]);
	return [...names].flatMap((name) => {
		const run = checkRuns.filter((entry) => entry.name === name).sort((a, b) => b.id - a.id)[0];
		if (run)
			return [
				{
					name,
					sha: run.head_sha,
					state: run.status === 'completed' ? run.conclusion : run.status,
					trusted: run.app?.id === 15368,
				},
			];
		const status = statuses.find((entry) => entry.context === name);
		return status
			? [
					{
						name,
						sha,
						state: status.state,
						trusted: status.creator?.login === 'github-actions[bot]',
					},
				]
			: [];
	});
}
export interface ProductionDeploymentEvidence {
	id: number;
	sha: string;
}

/**
 * GitHub environment that `.github/workflows/deploy-production.yml` records for each Production
 * Worker upload. An upload serves no traffic by itself; the contract gate pairs it with the
 * Production domain smoke on the same SHA, which passes only once the domain serves that build.
 */
export const CLOUDFLARE_PRODUCTION_DEPLOYMENT_ENVIRONMENT = 'Cloudflare Production';

function isProductionDeploymentEnvironment(value: unknown): boolean {
	return (
		typeof value === 'string' &&
		value.trim().toLowerCase() === CLOUDFLARE_PRODUCTION_DEPLOYMENT_ENVIRONMENT.toLowerCase()
	);
}

export function loadLatestProductionDeployment(
	run: GhRunner = defaultGhRunner,
): ProductionDeploymentEvidence {
	const client = createGitHubClient(run);
	const deployments = client.api(
		`deployments?environment=${encodeURIComponent(CLOUDFLARE_PRODUCTION_DEPLOYMENT_ENVIRONMENT)}&per_page=100`,
	) as Array<{
		id?: unknown;
		sha?: unknown;
		environment?: unknown;
	}>;
	const deployment = Array.isArray(deployments)
		? deployments.find((entry) => isProductionDeploymentEnvironment(entry.environment))
		: undefined;
	const id = typeof deployment?.id === 'number' ? deployment.id : null;
	const sha = typeof deployment?.sha === 'string' ? deployment.sha.toLowerCase() : '';
	if (!Array.isArray(deployments) || !id || !sha || !/^[a-f0-9]{40}$/.test(sha))
		throw new RemoteEvidenceError(
			'unavailable',
			'Production deployment history is unavailable or incomplete.',
		);
	const statuses = client.api(`deployments/${id}/statuses?per_page=100`) as Array<{
		state?: unknown;
	}>;
	if (!Array.isArray(statuses) || statuses.length === 0 || statuses.length >= 100)
		throw new RemoteEvidenceError(
			'unavailable',
			'Production deployment status is unavailable or incomplete.',
		);
	if (statuses[0]?.state !== 'success')
		throw new RemoteEvidenceError('invalid', 'Latest Production deployment did not succeed.');
	return { id, sha };
}
/** GitHub check-run statuses and commit-status states that mean "not finished yet". */
const PENDING_CHECK_STATES: ReadonlySet<string> = new Set([
	'queued',
	'in_progress',
	'waiting',
	'requested',
	'pending',
	'expected',
]);

function describeCheck(sha: string, checks: ReleaseCheck[], name: string): string {
	const record = checks.find((check) => check.name === name && check.sha.toLowerCase() === sha);
	if (!record) return 'not reported';
	return record.trusted ? record.state : `${record.state}, untrusted`;
}

function isPendingCheck(sha: string, checks: ReleaseCheck[], name: string): boolean {
	const record = checks.find((check) => check.name === name && check.sha.toLowerCase() === sha);
	return !record || (record.trusted && PENDING_CHECK_STATES.has(record.state));
}

/** Callers must provide the newest result per check, including pending reruns. */
export function requireReleaseChecks(sha: string, checks: ReleaseCheck[]): void {
	if (!/^[a-f0-9]{40}$/.test(sha))
		throw new RemoteEvidenceError('invalid', 'An exact release SHA is required.');
	const blocked = REQUIRED_RELEASE_CHECKS.filter(
		(name) =>
			assessExactEvidence({
				sha,
				environment: name.includes('preview') ? 'preview' : 'repository',
				records: checks.filter((check) => check.name === name),
				missingAction: `Collect trusted ${name} evidence for the exact SHA.`,
			}).status !== 'VERIFIED',
	);
	if (!blocked.length) return;
	const detail = blocked
		.map((name) => `${name} (${describeCheck(sha, checks, name)})`)
		.join(', ');
	// Separate "wait and retry" from "something failed": the operator acts differently.
	if (blocked.every((name) => isPendingCheck(sha, checks, name))) {
		throw new RemoteEvidenceError(
			'invalid',
			`Release checks pending for ${sha.slice(0, 9)}: ${detail}. Repository CI has not finished ` +
				'for this commit (push it if it is not on origin); retry when it completes.',
		);
	}
	throw new RemoteEvidenceError('invalid', `Release checks blocked: ${detail}`);
}

export const RELEASE_CANDIDATE_BRANCH = /^candidate\/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export interface ReleaseCandidateGeometry {
	sha: string;
	branch: string;
	/** `origin/<branch>` tip, or null when the branch is not on origin. */
	branchTip: string | null;
	/** The SHA is an ancestor of (or equal to) `origin/develop`. */
	onDevelop: boolean;
	/** `origin/main` is an ancestor of the SHA: the previous release reached develop first. */
	containsMain: boolean;
}

/**
 * A release leaves from a `candidate/vX.Y.Z` branch fixed on one develop SHA, so develop keeps
 * receiving merges during the release. The candidate must still point at that SHA, the SHA must be
 * develop history (its develop push carries CI and the Preview deployment), and it must contain
 * main so the release pull request adds commits without dropping the previous back-merge.
 */
export function requireReleaseCandidate(geometry: ReleaseCandidateGeometry): void {
	const { sha, branch, branchTip } = geometry;
	if (!RELEASE_CANDIDATE_BRANCH.test(branch))
		throw new RemoteEvidenceError(
			'invalid',
			`Release candidate branch must be candidate/vX.Y.Z, got ${branch}.`,
		);
	if (!branchTip)
		throw new RemoteEvidenceError(
			'unavailable',
			`origin/${branch} is unavailable. Push the candidate branch and fetch origin.`,
		);
	if (branchTip.toLowerCase() !== sha)
		throw new RemoteEvidenceError(
			'invalid',
			`origin/${branch} moved to ${branchTip.slice(0, 9)}; the release is fixed on ${sha.slice(0, 9)}. ` +
				'Cut a new candidate instead of moving this one.',
		);
	if (!geometry.onDevelop)
		throw new RemoteEvidenceError(
			'invalid',
			`${sha.slice(0, 9)} is not on origin/develop. A candidate is cut from a develop SHA only.`,
		);
	if (!geometry.containsMain)
		throw new RemoteEvidenceError(
			'invalid',
			`${sha.slice(0, 9)} does not contain origin/main. Merge the previous release back into ` +
				'develop through its pull request, then cut the candidate from develop.',
		);
}

export type GitRunner = (args: string[]) => { status: number; stdout: string };

function defaultGitRunner(args: string[]): { status: number; stdout: string } {
	try {
		return { status: 0, stdout: execFileSync('git', args, { encoding: 'utf8' }) };
	} catch (error) {
		const status = (error as { status?: unknown }).status;
		return { status: typeof status === 'number' ? status : 1, stdout: '' };
	}
}

/** Reads the candidate geometry from local remote-tracking refs; run `git fetch origin` first. */
export function readReleaseCandidateGeometry(
	sha: string,
	branch: string,
	git: GitRunner = defaultGitRunner,
): ReleaseCandidateGeometry {
	const tip = git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`]);
	const isAncestor = (ancestor: string, descendant: string): boolean =>
		git(['merge-base', '--is-ancestor', ancestor, descendant]).status === 0;
	return {
		sha,
		branch,
		branchTip: tip.status === 0 && tip.stdout.trim() ? tip.stdout.trim() : null,
		onDevelop: isAncestor(sha, 'refs/remotes/origin/develop'),
		containsMain: isAncestor('refs/remotes/origin/main', sha),
	};
}

export function parseReleaseChecksArgs(argv: readonly string[]): {
	sha: string;
	candidate: string | null;
} {
	const usage = 'Usage: release-readiness.ts <exact-sha> [--candidate candidate/vX.Y.Z]';
	const positional: string[] = [];
	let candidate: string | null = null;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--') continue;
		if (argument === '--candidate') {
			candidate = argv[index + 1] ?? '';
			index += 1;
		} else if (argument.startsWith('--candidate=')) {
			candidate = argument.slice('--candidate='.length);
		} else if (argument.startsWith('--')) {
			throw new Error(usage);
		} else {
			positional.push(argument);
		}
	}
	const sha = positional[0] ?? '';
	if (positional.length !== 1 || !/^[a-f0-9]{40}$/.test(sha) || candidate === '')
		throw new Error(usage);
	return { sha, candidate };
}

function main(): void {
	const { sha, candidate } = parseReleaseChecksArgs(process.argv.slice(2));
	if (candidate) requireReleaseCandidate(readReleaseCandidateGeometry(sha, candidate));
	const checks = loadRemoteChecks(sha);
	requireReleaseChecks(sha, checks);
	console.log(
		JSON.stringify(
			{
				sha,
				state: 'CHECKS_PASSED',
				...(candidate ? { candidate } : {}),
				checks,
				note: 'Database compatibility and deployment authorization remain required.',
			},
			null,
			2,
		),
	);
}

if (process.argv[1] && /^release-readiness\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
