/** Repository CI job that runs the browser checks, whole or split into named parts. */
export const BROWSER_JOB_NAME = 'Application / browser';

export interface CiJob {
	name: string;
	conclusion: string | null;
}

/**
 * Whether a run proves the named job: it ran and passed. A run that split the browser checks
 * reports `Application / browser (<part>)` jobs, and proves the browser job only when every part
 * exists and passed.
 */
export function jobPassed(jobs: readonly CiJob[], name: string): boolean {
	const matching = jobs.filter(
		(job) =>
			job.name === name || (name === BROWSER_JOB_NAME && job.name.startsWith(`${name} (`)),
	);
	return matching.length > 0 && matching.every((job) => job.conclusion === 'success');
}
