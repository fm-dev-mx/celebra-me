/**
 * One blocking release status command: required CI checks, the provider deployment recorded on
 * GitHub, the deployment smoke check and the serving build identity, for one exact SHA.
 * Read-only: it never pushes, redeploys or reruns anything.
 */
import { basename } from 'node:path';
import {
	buildVercelProtectionHeaders,
	IMMUTABLE_PREVIEW_HOST_PATTERN,
	loadPlaywrightEnvironment,
} from '../playwright/preview-environment.ts';
import {
	createGitHubClient,
	defaultGhRunner,
	type GhRunner,
	loadRemoteChecks,
	PREVIEW_DEPLOYMENT_SMOKE,
	PRODUCTION_DEPLOYMENT_SMOKE,
	REQUIRED_RELEASE_CHECKS,
	type ReleaseCheck,
} from './release-readiness.ts';

export type ReleaseTarget = 'preview' | 'production';
export type SmokeMode = 'ci' | 'skip';
export type Progress = 'passed' | 'pending' | 'failed';

export const PRODUCTION_ALIAS_URL = 'https://www.celebra-me.com';
const PENDING_STATES = new Set([
	'queued',
	'in_progress',
	'pending',
	'waiting',
	'requested',
	'expected',
]);
const DEPLOYMENT_FAILED_STATES = new Set(['failure', 'error', 'inactive']);

export function classifyCheck(sha: string, check: ReleaseCheck | undefined): Progress {
	if (!check) return 'pending';
	if (check.sha.toLowerCase() !== sha || !check.trusted) return 'failed';
	if (check.state === 'success') return 'passed';
	return PENDING_STATES.has(check.state) ? 'pending' : 'failed';
}

export interface DeploymentEvidence {
	id: number;
	environment: string;
	state: string;
	url: string | null;
}

/**
 * Provider deployment recorded on GitHub for this SHA and environment, with its latest status.
 * A workflow job declaring `environment:` (e.g. the post-deploy smoke) adds a newer deployment
 * record for the same SHA whose statuses carry an empty `environment_url`; GitHub attributes it to
 * `vercel[bot]` as well, so neither the newest id nor the creator identifies the provider
 * deployment. Candidates are inspected newest first and the first whose latest status carries an
 * `environment_url` wins. Until one does, the newest record is reported and classifies as pending.
 */
export function loadDeploymentForSha(
	sha: string,
	target: ReleaseTarget,
	run: GhRunner = defaultGhRunner,
): DeploymentEvidence | null {
	const client = createGitHubClient(run);
	const deployments = client.api(`deployments?sha=${sha}&per_page=100`) as Array<{
		id?: unknown;
		sha?: unknown;
		environment?: unknown;
	}>;
	if (!Array.isArray(deployments)) return null;
	const candidates = deployments
		.filter(
			(entry) =>
				typeof entry.id === 'number' &&
				typeof entry.sha === 'string' &&
				entry.sha.toLowerCase() === sha &&
				typeof entry.environment === 'string' &&
				entry.environment.trim().toLowerCase() === target,
		)
		.sort((left, right) => (right.id as number) - (left.id as number));
	let newest: DeploymentEvidence | null = null;
	for (const candidate of candidates) {
		const statuses = client.api(`deployments/${candidate.id}/statuses?per_page=100`) as Array<{
			state?: unknown;
			environment_url?: unknown;
		}>;
		const latest = Array.isArray(statuses) ? statuses[0] : undefined;
		const evidence: DeploymentEvidence = {
			id: candidate.id as number,
			environment: candidate.environment as string,
			state: typeof latest?.state === 'string' ? latest.state : 'pending',
			url:
				typeof latest?.environment_url === 'string' && latest.environment_url !== ''
					? latest.environment_url
					: null,
		};
		if (evidence.url !== null) return evidence;
		newest ??= evidence;
	}
	return newest;
}

export function classifyDeployment(
	target: ReleaseTarget,
	deployment: DeploymentEvidence | null,
): Progress {
	if (!deployment) return 'pending';
	if (DEPLOYMENT_FAILED_STATES.has(deployment.state)) return 'failed';
	if (deployment.state !== 'success' || !deployment.url) return 'pending';
	if (target === 'preview') {
		const host = new URL(deployment.url).hostname;
		if (!IMMUTABLE_PREVIEW_HOST_PATTERN.test(host)) return 'failed';
	}
	return 'passed';
}

export interface HealthEvidence {
	url: string;
	status: number | null;
	commitSha: string | null;
	deploymentId: string | null;
	environment: string | null;
	/** `unreported` means the serving build predates build identity in `/api/health`. */
	result: 'match' | 'mismatch' | 'unreported' | 'unreachable';
}

type FetchLike = (
	url: string,
	init?: { headers?: Record<string, string> },
) => Promise<{
	status: number;
	json: () => Promise<unknown>;
}>;

export async function probeHealth(
	origin: string,
	sha: string,
	fetchImpl: FetchLike,
	headers?: Record<string, string>,
): Promise<HealthEvidence> {
	const url = `${origin.replace(/\/$/, '')}/api/health`;
	try {
		const response = await fetchImpl(url, headers ? { headers } : undefined);
		const body = (await response.json().catch(() => ({}))) as {
			status?: unknown;
			build?: Record<string, unknown>;
		};
		const read = (key: string) =>
			typeof body.build?.[key] === 'string' ? (body.build[key] as string) : null;
		const commitSha = read('commitSha');
		const healthy = response.status === 200 && body.status === 'healthy';
		return {
			url,
			status: response.status,
			commitSha,
			deploymentId: read('deploymentId'),
			environment: read('environment'),
			result: !healthy
				? 'unreachable'
				: commitSha === null
					? 'unreported'
					: commitSha.toLowerCase() === sha
						? 'match'
						: 'mismatch',
		};
	} catch {
		return {
			url,
			status: null,
			commitSha: null,
			deploymentId: null,
			environment: null,
			result: 'unreachable',
		};
	}
}

export interface IgnoredBuildEvidence {
	description: string;
}

/**
 * Vercel records a successful commit status "Canceled by Ignored Build Step" when
 * `scripts/ops/vercel-ignore-build.mjs` skips a Preview build because no application input
 * changed. The latest `Vercel` status from `vercel[bot]` decides: a newer "deploying" status means
 * a build did start, so the skip no longer applies.
 */
export function loadIgnoredPreviewBuild(
	sha: string,
	run: GhRunner = defaultGhRunner,
): IgnoredBuildEvidence | null {
	const client = createGitHubClient(run);
	const statuses = client.api(`commits/${sha}/statuses?per_page=100`) as Array<{
		context?: unknown;
		state?: unknown;
		description?: unknown;
		creator?: { login?: unknown };
	}>;
	if (!Array.isArray(statuses)) return null;
	const latest = statuses.find((entry) => entry.context === 'Vercel');
	if (
		latest?.creator?.login !== 'vercel[bot]' ||
		latest.state !== 'success' ||
		typeof latest.description !== 'string' ||
		!/ignored build step/iu.test(latest.description)
	)
		return null;
	return { description: latest.description };
}

export interface SmokeRerunEvidence {
	runId: number;
	attempt: number | null;
	status: string;
}

const SMOKE_STATUS_CREATOR = 'github-actions[bot]';
const WORKFLOW_RUN_URL_PATTERN = /\/actions\/runs\/(\d+)(?:\/|$)/u;

/**
 * The smoke commit status keeps the failed attempt's `failure` until a re-run's job publishes
 * `pending` again, which happens only after the new attempt leaves the queue and reaches that step.
 * The latest smoke status links to its workflow run (`target_url`); the dispatch workflow runs on
 * the default branch, so the run's own `head_sha` cannot identify the release SHA. A run that is
 * not completed means a newer attempt for this exact status is queued or running.
 */
export function loadSmokeRerun(
	sha: string,
	name: string,
	run: GhRunner = defaultGhRunner,
): SmokeRerunEvidence | null {
	const client = createGitHubClient(run);
	const statuses = client.api(`commits/${sha}/statuses?per_page=100`) as Array<{
		context?: unknown;
		target_url?: unknown;
		creator?: { login?: unknown };
	}>;
	if (!Array.isArray(statuses)) return null;
	const latest = statuses.find((entry) => entry.context === name);
	if (latest?.creator?.login !== SMOKE_STATUS_CREATOR || typeof latest.target_url !== 'string')
		return null;
	const runId = WORKFLOW_RUN_URL_PATTERN.exec(latest.target_url)?.[1];
	if (!runId) return null;
	const workflowRun = client.api(`actions/runs/${runId}`) as {
		id?: unknown;
		status?: unknown;
		run_attempt?: unknown;
	} | null;
	if (typeof workflowRun?.status !== 'string' || workflowRun.status === 'completed') return null;
	return {
		runId: Number(runId),
		attempt: typeof workflowRun.run_attempt === 'number' ? workflowRun.run_attempt : null,
		status: workflowRun.status,
	};
}

export interface ReleaseStatus {
	sha: string;
	target: ReleaseTarget;
	/** `SKIPPED`: CI passed and Vercel intentionally skipped the Preview build (no app inputs). */
	state: 'VERIFIED' | 'SKIPPED' | 'FAILED' | 'PENDING';
	checks: Array<{ name: string; state: string; progress: Progress }>;
	deployment: (DeploymentEvidence & { progress: Progress }) | null;
	smoke: {
		name: string;
		mode: SmokeMode;
		state: string;
		progress: Progress;
		/** Set while a re-run of the failed smoke workflow run is queued or in progress. */
		rerun?: SmokeRerunEvidence;
	};
	health: HealthEvidence[];
	ignoredBuild: IgnoredBuildEvidence | null;
	blockers: string[];
}

export interface StatusDependencies {
	run?: GhRunner;
	fetchImpl?: FetchLike;
	/** Sent to the immutable deployment URL only; Vercel Authentication guards it on both targets. */
	protectionHeaders?: Record<string, string>;
}

function describeSmoke(
	sha: string,
	target: ReleaseTarget,
	mode: SmokeMode,
	remote: ReleaseCheck[],
	run: GhRunner,
): ReleaseStatus['smoke'] {
	const name = target === 'preview' ? PREVIEW_DEPLOYMENT_SMOKE : PRODUCTION_DEPLOYMENT_SMOKE;
	if (mode === 'skip') return { name, mode, state: 'skipped', progress: 'passed' };
	const check = remote.find((entry) => entry.name === name);
	const smoke = {
		name,
		mode,
		state: check?.state ?? 'missing',
		progress: classifyCheck(sha, check),
	};
	// A failed attempt being re-run is not terminal: wait for the new attempt's result.
	if (smoke.progress === 'failed' && check?.trusted && check.sha.toLowerCase() === sha) {
		const rerun = loadSmokeRerun(sha, name, run);
		if (rerun) return { ...smoke, state: `rerun ${rerun.status}`, progress: 'pending', rerun };
	}
	return smoke;
}

function listBlockers(status: Omit<ReleaseStatus, 'state' | 'blockers'>): string[] {
	const checkBlockers = status.checks
		.filter((check) => check.progress !== 'passed')
		.map((check) => `${check.name}: ${check.state}`);
	if (status.ignoredBuild) return checkBlockers;
	return [
		...checkBlockers,
		...(status.deployment?.progress === 'passed'
			? []
			: [`${status.target} deployment: ${status.deployment?.state ?? 'missing'}`]),
		...(status.smoke.progress === 'passed'
			? []
			: [`${status.smoke.name}: ${status.smoke.state}`]),
		...status.health
			.filter((entry) => entry.result === 'mismatch' || entry.result === 'unreachable')
			.map((entry) => `${entry.url}: ${entry.result}`),
	];
}

function deriveState(status: Omit<ReleaseStatus, 'state' | 'blockers'>): ReleaseStatus['state'] {
	const checkProgresses = status.checks.map((check) => check.progress);
	if (status.ignoredBuild) {
		if (checkProgresses.includes('failed')) return 'FAILED';
		return checkProgresses.includes('pending') ? 'PENDING' : 'SKIPPED';
	}
	const progresses = [
		...checkProgresses,
		status.deployment?.progress ?? 'pending',
		status.smoke.progress,
	];
	if (progresses.includes('failed') || status.health.some((entry) => entry.result === 'mismatch'))
		return 'FAILED';
	if (
		progresses.includes('pending') ||
		status.health.some((entry) => entry.result === 'unreachable')
	)
		return 'PENDING';
	return 'VERIFIED';
}

export async function collectReleaseStatus(
	sha: string,
	target: ReleaseTarget,
	smokeMode: SmokeMode,
	dependencies: StatusDependencies = {},
): Promise<ReleaseStatus> {
	const run = dependencies.run ?? defaultGhRunner;
	const fetchImpl = dependencies.fetchImpl ?? (fetch as unknown as FetchLike);
	const remote = loadRemoteChecks(sha, run);
	const checks = REQUIRED_RELEASE_CHECKS.map((name) => {
		const check = remote.find((entry) => entry.name === name);
		return { name, state: check?.state ?? 'missing', progress: classifyCheck(sha, check) };
	});
	const evidence = loadDeploymentForSha(sha, target, run);
	const deployment = evidence
		? { ...evidence, progress: classifyDeployment(target, evidence) }
		: null;

	const health: HealthEvidence[] = [];
	if (deployment?.progress === 'passed' && deployment.url) {
		health.push(
			await probeHealth(deployment.url, sha, fetchImpl, dependencies.protectionHeaders),
		);
		if (target === 'production')
			health.push(await probeHealth(PRODUCTION_ALIAS_URL, sha, fetchImpl));
	}

	const ignoredBuild =
		target === 'preview' && deployment?.progress !== 'passed'
			? loadIgnoredPreviewBuild(sha, run)
			: null;

	const status = {
		sha,
		target,
		checks,
		deployment,
		smoke: describeSmoke(sha, target, smokeMode, remote, run),
		health,
		ignoredBuild,
	};
	return { ...status, state: deriveState(status), blockers: listBlockers(status) };
}

export interface WaitOptions {
	timeoutMs: number;
	intervalMs: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
}

/** Polls silently until a terminal state; a timeout is reported as PENDING, never success. */
export async function waitForReleaseStatus(
	collect: () => Promise<ReleaseStatus>,
	options: WaitOptions,
): Promise<ReleaseStatus> {
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const now = options.now ?? Date.now;
	const deadline = now() + options.timeoutMs;
	for (;;) {
		let status: ReleaseStatus | null = null;
		try {
			status = await collect();
		} catch {
			// Transient GitHub unavailability is retried until the deadline.
		}
		if (status && status.state !== 'PENDING') return status;
		if (now() + options.intervalMs > deadline) {
			if (status) return status;
			return collect();
		}
		await sleep(options.intervalMs);
	}
}

function parseArgs(argv: string[]): {
	sha: string;
	target: ReleaseTarget;
	smoke: SmokeMode;
	wait: boolean;
	timeoutMs: number;
} {
	const value = (name: string) => {
		const inline = argv.find((arg) => arg.startsWith(`${name}=`));
		if (inline) return inline.slice(name.length + 1);
		const index = argv.indexOf(name);
		return index >= 0 ? argv[index + 1] : undefined;
	};
	const sha = value('--sha')?.toLowerCase() ?? '';
	const target = value('--target');
	const smoke = value('--smoke') ?? 'ci';
	const timeoutMinutes = Number(value('--timeout-minutes') ?? '20');
	if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('--sha must be the exact 40-hex commit SHA.');
	if (target !== 'preview' && target !== 'production')
		throw new Error('--target must be preview or production.');
	if (smoke !== 'ci' && smoke !== 'skip') throw new Error('--smoke must be ci or skip.');
	if (target === 'production' && smoke === 'skip')
		throw new Error('Production status always requires the deployment smoke.');
	if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0 || timeoutMinutes > 20)
		throw new Error('--timeout-minutes must be between 0 and 20.');
	return {
		sha,
		target,
		smoke,
		wait: argv.includes('--wait'),
		timeoutMs: timeoutMinutes * 60_000,
	};
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
	loadPlaywrightEnvironment();
	// The set-cookie variant answers with a redirect; a single probe needs only the bypass header.
	const bypass = buildVercelProtectionHeaders(process.env)?.['x-vercel-protection-bypass'];
	const protectionHeaders = bypass ? { 'x-vercel-protection-bypass': bypass } : undefined;
	const collect = () =>
		collectReleaseStatus(options.sha, options.target, options.smoke, { protectionHeaders });
	const status = options.wait
		? await waitForReleaseStatus(collect, { timeoutMs: options.timeoutMs, intervalMs: 30_000 })
		: await collect();
	console.log(JSON.stringify(status, null, 2));
	if (status.state !== 'VERIFIED' && status.state !== 'SKIPPED') process.exitCode = 1;
}

if (process.argv[1] && /^release-status\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
