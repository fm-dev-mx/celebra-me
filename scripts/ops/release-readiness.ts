import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

export const REQUIRED_RELEASE_CHECKS = [
	'Repository Policy',
	'Application Suite',
	'Vercel - celebra-me preview smoke',
] as const;
export interface ReleaseCheck {
	name: string;
	sha: string;
	state: string;
	trusted: boolean;
}
/** Callers must provide the newest result per check, including pending reruns. */
export function requireReleaseChecks(sha: string, checks: ReleaseCheck[]): void {
	if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('An exact release SHA is required.');
	const blocked = REQUIRED_RELEASE_CHECKS.filter((name) => {
		const matching = checks.filter((check) => check.name === name);
		return (
			matching.length !== 1 ||
			matching[0].sha !== sha ||
			matching[0].state !== 'success' ||
			!matching[0].trusted
		);
	});
	if (blocked.length) throw new Error(`Release checks blocked: ${blocked.join(', ')}`);
}

function main(): void {
	const sha = process.argv[2];
	if (!sha || !/^[a-f0-9]{40}$/.test(sha))
		throw new Error('Usage: release-readiness.ts <exact-sha>');
	const repository = execFileSync(
		'gh',
		['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
		{ encoding: 'utf8' },
	).trim();
	const api = (suffix: string): unknown =>
		JSON.parse(
			execFileSync('gh', ['api', `repos/${repository}/commits/${sha}/${suffix}`], {
				encoding: 'utf8',
			}),
		);
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
	if (runs.total_count > 100) throw new Error('Check result page is incomplete.');
	// The combined /status response omits creator. Read the newest-first individual
	// statuses on this exact SHA so the publisher can be verified.
	const statuses = api('statuses?per_page=100') as Array<{
		context: string;
		state: string;
		creator?: { login: string };
	}>;
	if (!Array.isArray(statuses) || statuses.length >= 100)
		throw new Error('Status result page is incomplete.');
	const checks: ReleaseCheck[] = [];
	for (const name of REQUIRED_RELEASE_CHECKS) {
		const run = runs.check_runs
			.filter((entry) => entry.name === name)
			.sort((a, b) => b.id - a.id)[0];
		if (run)
			checks.push({
				name,
				sha: run.head_sha,
				state: run.status === 'completed' ? run.conclusion : run.status,
				trusted: run.app.id === 15368,
			});
		else {
			const status = statuses.find((entry) => entry.context === name);
			if (status)
				checks.push({
					name,
					sha,
					state: status.state,
					trusted: status.creator?.login === 'github-actions[bot]',
				});
		}
	}
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
