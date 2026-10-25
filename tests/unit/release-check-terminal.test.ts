import { describe, expect, it } from '@jest/globals';
import {
	prepareCommandJob,
	runCommandSequencesInParallel,
} from '../../scripts/db/db-workflow-lib.ts';
import { releaseCheckParallelSequences } from '../../scripts/db/release-check.ts';

// On an owner TTY, release-check froze because its parallel children inherited the terminal:
// jest's interactive redraw and astro's output raced on one console and every child stalled.
describe('release-check parallel jobs never share the terminal', () => {
	it('echoes every job instead of inheriting the TTY', () => {
		const jobs = releaseCheckParallelSequences().flat();
		expect(jobs.map((job) => job.args.join(' '))).toEqual(['test', 'type-check', 'build:app']);
		for (const job of jobs) {
			expect(job.options?.echoOutput).toBe(true);
			expect(job.options?.inherit).toBeUndefined();
			const prepared = prepareCommandJob(job.command, job.args, job.options);
			expect(prepared.stdio).toEqual(['ignore', 'pipe', 'pipe']);
			expect(prepared.echoOutput).toBe(true);
		}
	});

	it('keeps stdin piped when an echoed job sends input', () => {
		const prepared = prepareCommandJob(process.execPath, ['-v'], {
			echoOutput: true,
			input: 'x',
		});
		expect(prepared.stdio).toEqual(['pipe', 'pipe', 'pipe']);
	});

	it('gives echoed children a closed stdin, so a read ends at once instead of waiting', () => {
		const waitForStdinEnd =
			'process.stdin.on("end",()=>process.exit(0));process.stdin.resume();setTimeout(()=>process.exit(7),5000)';
		const [[result]] = runCommandSequencesInParallel([
			[
				{
					command: process.execPath,
					args: ['-e', waitForStdinEnd],
					options: { throwOnError: false, echoOutput: true },
				},
			],
		]);
		expect(result?.status).toBe(0);
	});

	it('still captures echoed output for the caller', () => {
		const [[result]] = runCommandSequencesInParallel([
			[
				{
					command: process.execPath,
					args: ['-e', 'process.stderr.write("release-check echo probe\\n")'],
					options: { throwOnError: false, echoOutput: true },
				},
			],
		]);
		expect(result?.status).toBe(0);
		expect(result?.stderr).toBe('release-check echo probe\n');
	});
});
