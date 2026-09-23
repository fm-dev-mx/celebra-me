import type { BrowserCheckOutcome } from './browser-outcome.ts';

export type PrimaryCiCause = 'CODE' | 'VISUAL_DIFF' | 'INFRASTRUCTURE' | null;
export type { BrowserCheckOutcome };

export interface CiJobOutcome {
	name: string;
	conclusion: string;
}

export function classifyPrimaryCiCause(
	jobs: CiJobOutcome[],
	browserCheckOutcome: BrowserCheckOutcome,
): PrimaryCiCause {
	const failed = jobs.filter((job) => job.conclusion === 'failure');
	const hasOtherFailures = failed.some(
		(job) => job.name !== 'Application / browser' && job.name !== 'Application Suite',
	);
	const browserFailed = failed.some((job) => job.name === 'Application / browser');
	if (browserFailed) {
		if (browserCheckOutcome === 'visual_diff') return 'VISUAL_DIFF';
		if (browserCheckOutcome === 'success' && !hasOtherFailures) return 'INFRASTRUCTURE';
		return 'CODE';
	}
	if (hasOtherFailures) return 'CODE';
	return null;
}

export function shouldRetryInfrastructure(cause: PrimaryCiCause, runAttempt: number): boolean {
	return cause === 'INFRASTRUCTURE' && runAttempt === 1;
}
