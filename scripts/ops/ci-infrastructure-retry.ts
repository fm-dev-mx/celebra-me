import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';

export interface WorkflowStepOutcome {
	name: string;
	conclusion: string | null;
}

export interface WorkflowJobOutcome {
	name: string;
	conclusion: string | null;
	steps?: WorkflowStepOutcome[];
}

export function isConfirmedArtifactInfrastructureFailure(jobs: WorkflowJobOutcome[]): boolean {
	const failedJobs = jobs.filter((job) => job.conclusion === 'failure');
	if (
		failedJobs.some(
			(job) =>
				job.name !== 'Application / browser' &&
				job.name !== 'Application Suite' &&
				job.name !== 'Validation metrics',
		)
	) {
		return false;
	}
	const browser = jobs.find((job) => job.name === 'Application / browser');
	if (browser?.conclusion !== 'failure') return false;
	const browserChecks = browser.steps?.find((step) => step.name === 'Browser checks');
	const artifactUpload = browser.steps?.find(
		(step) => step.name === 'Preserve browser results and failure evidence',
	);
	return browserChecks?.conclusion === 'success' && artifactUpload?.conclusion === 'failure';
}

async function main(): Promise<void> {
	const repository = process.env.GITHUB_REPOSITORY;
	const runId = process.env.RUN_ID;
	const attempt = process.env.RUN_ATTEMPT;
	const token = process.env.GH_TOKEN;
	if (!repository || !runId || !attempt || !token) {
		throw new Error('GITHUB_REPOSITORY, RUN_ID, RUN_ATTEMPT, and GH_TOKEN are required.');
	}
	const jobs: WorkflowJobOutcome[] = [];
	for (let page = 1; ; page++) {
		const response = await fetch(
			`https://api.github.com/repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100&page=${page}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28',
				},
			},
		);
		if (!response.ok) throw new Error(`Cannot inspect CI jobs: HTTP ${response.status}.`);
		const body = (await response.json()) as { jobs?: WorkflowJobOutcome[] };
		const pageJobs = body.jobs ?? [];
		jobs.push(...pageJobs);
		if (pageJobs.length < 100) break;
	}
	const shouldRetry = isConfirmedArtifactInfrastructureFailure(jobs);
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `should_retry=${shouldRetry}\n`);
	}
	console.log(
		JSON.stringify({
			shouldRetry,
			reason: shouldRetry
				? 'Browser checks passed and the subsequent evidence upload failed.'
				: 'Run is not a confirmed post-test artifact infrastructure failure.',
		}),
	);
}

if (process.argv[1] && /^ci-infrastructure-retry\.(?:ts|js)$/u.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
