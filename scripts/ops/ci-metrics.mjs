import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

// Read job timestamps, never logs or application data. Queue time and runner time
// are different quantities; these metrics do not claim to measure token usage.
const {
	GITHUB_API_URL = 'https://api.github.com',
	GITHUB_REPOSITORY,
	GITHUB_RUN_ID,
	GITHUB_RUN_ATTEMPT,
	GITHUB_SHA,
	GH_TOKEN,
	GITHUB_STEP_SUMMARY,
} = process.env;
const jobs = [];
for (let page = 1; ; page++) {
	const response = await fetch(
		`${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT}/jobs?per_page=100&page=${page}`,
		{
			headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
		},
	);
	if (!response.ok) throw new Error(`Cannot read validation metrics: HTTP ${response.status}`);
	const body = await response.json();
	jobs.push(...body.jobs);
	if (body.jobs.length < 100) break;
}
const completed = jobs.filter(
	(job) =>
		job.name !== 'Validation metrics' &&
		job.started_at &&
		job.completed_at &&
		job.conclusion !== 'skipped',
);
const durations = completed.map((job) => ({
	name: job.name,
	conclusion: job.conclusion,
	seconds: (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000,
}));
const wallSeconds = completed.length
	? (Math.max(...completed.map((job) => Date.parse(job.completed_at))) -
			Math.min(...completed.map((job) => Date.parse(job.started_at)))) /
		1000
	: null;
const evidence = {
	sha: GITHUB_SHA,
	mode: process.env.VISUAL_PARITY_MODE,
	runId: GITHUB_RUN_ID,
	attempt: Number(GITHUB_RUN_ATTEMPT),
	wallSeconds,
	runnerMinutes: durations.reduce((sum, job) => sum + job.seconds, 0) / 60,
	completeApplicationExecution:
		[
			'Application / static',
			'Application / unit',
			'Application / database',
			'Application / browser',
		].every((name) =>
			completed.some((job) => job.name === name && job.conclusion === 'success'),
		) && process.env.VISUAL_PARITY_MODE === 'compare',
	jobs: durations,
	excludes: ['queue time', 'metrics job', 'billing multipliers', 'token usage'],
};
mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/validation-metrics.json', `${JSON.stringify(evidence, null, 2)}\n`);
if (GITHUB_STEP_SUMMARY)
	appendFileSync(
		GITHUB_STEP_SUMMARY,
		`Validation evidence\n\n\`\`\`json\n${JSON.stringify(evidence, null, 2)}\n\`\`\`\n`,
	);
