import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

export const REQUIRED_RELEASE_CHECKS = [
	'Repository Policy',
	'Application Suite',
	'Vercel - celebra-me preview smoke',
] as const;
export const PRODUCTION_DEPLOYMENT_SMOKE = 'Vercel - celebra-me production smoke';
export interface ReleaseCheck {
	name: string;
	sha: string;
	state: string;
	trusted: boolean;
}
export type RemoteCheckRun = ReleaseCheck;
type GhRunner = (args: string[]) => string;
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

function defaultGhRunner(args: string[]): string {
	return execFileSync('gh', args, { encoding: 'utf8' });
}

function createGitHubClient(run: GhRunner): {
	repository: string;
	api: (suffix: string) => unknown;
} {
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
	const matching = checks.filter((check) => check.name === PRODUCTION_DEPLOYMENT_SMOKE);
	if (
		matching.length !== 1 ||
		matching[0].sha !== sha ||
		matching[0].state !== 'success' ||
		!matching[0].trusted
	)
		throw new RemoteEvidenceError(
			'invalid',
			`Production deployment smoke blocked: ${PRODUCTION_DEPLOYMENT_SMOKE}`,
		);
}
export function loadRemoteChecks(sha: string, run: GhRunner = defaultGhRunner): RemoteCheckRun[] {
	if (!/^[a-f0-9]{40}$/i.test(sha))
		throw new RemoteEvidenceError('invalid', 'An exact release SHA is required.');
	const client = createGitHubClient(run);
	const api = (suffix: string): unknown => client.api(`commits/${sha}/${suffix}`);
	const runs = api('check-runs?filter=latest&per_page=100') as {
		total_count: number;
		check_runs: Array<{
			id: number;
			name: string;
			head_sha: string;
			status: string;
			conclusion: string;
			app: { id: number };
		}>;
	};
	if (!runs || !Array.isArray(runs.check_runs) || typeof runs.total_count !== 'number')
		throw new RemoteEvidenceError('unavailable', 'Check result response is malformed.');
	if (runs.total_count > 100)
		throw new RemoteEvidenceError('unavailable', 'Check result page is incomplete.');
	const statuses = api('statuses?per_page=100') as Array<{
		context: string;
		state: string;
		creator?: { login: string };
	}>;
	if (!Array.isArray(statuses) || statuses.length >= 100)
		throw new RemoteEvidenceError('unavailable', 'Status result page is incomplete.');
	const names = new Set([...REQUIRED_RELEASE_CHECKS, PRODUCTION_DEPLOYMENT_SMOKE]);
	return [...names].flatMap((name) => {
		const run = runs.check_runs
			.filter((entry) => entry.name === name)
			.sort((a, b) => b.id - a.id)[0];
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

export function loadLatestProductionDeployment(
	run: GhRunner = defaultGhRunner,
): ProductionDeploymentEvidence {
	const client = createGitHubClient(run);
	const deployments = client.api('deployments?environment=production&per_page=100') as Array<{
		id?: unknown;
		sha?: unknown;
		environment?: unknown;
	}>;
	const deployment = Array.isArray(deployments)
		? deployments.find((entry) => entry.environment === 'production')
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
/** Callers must provide the newest result per check, including pending reruns. */
export function requireReleaseChecks(sha: string, checks: ReleaseCheck[]): void {
	if (!/^[a-f0-9]{40}$/.test(sha))
		throw new RemoteEvidenceError('invalid', 'An exact release SHA is required.');
	const blocked = REQUIRED_RELEASE_CHECKS.filter((name) => {
		const matching = checks.filter((check) => check.name === name);
		return (
			matching.length !== 1 ||
			matching[0].sha !== sha ||
			matching[0].state !== 'success' ||
			!matching[0].trusted
		);
	});
	if (blocked.length)
		throw new RemoteEvidenceError('invalid', `Release checks blocked: ${blocked.join(', ')}`);
}

function main(): void {
	const sha = process.argv[2];
	if (!sha || !/^[a-f0-9]{40}$/.test(sha))
		throw new Error('Usage: release-readiness.ts <exact-sha>');
	const checks = loadRemoteChecks(sha);
	requireReleaseChecks(sha, checks);
	console.log(
		JSON.stringify(
			{
				sha,
				state: 'CHECKS_PASSED',
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
