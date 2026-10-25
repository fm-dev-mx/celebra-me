/**
 * Visual capture proof inside one Playwright shard of the browser checks.
 *
 * The Playwright teardown skips the matrix proof inside a shard, because one shard sees only part
 * of each capture suite. This runs after the shard's browser checks and asserts every check the
 * teardown would except coverage. It also writes each started suite's complete matrix beside the
 * capture records, so `scripts/ops/visual-shard-merge.ts` can prove coverage across every shard
 * without installing the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
	readVisualCaptureRecords,
	resolveVisualOutputRoot,
	visualSuiteStarted,
	type VisualSuite,
} from '../../tests/e2e/harness/visual-capture-record.ts';
import {
	resolveVisualParityMode,
	type VisualParityMode,
} from '../../tests/e2e/harness/visual-baseline-policy.ts';
import {
	aggregateVisualSuite,
	describeVisualAggregationFailures,
	describeVisualRecaptures,
	expectedVisualCaptures,
	type ExpectedVisualCapture,
	type VisualSuiteAggregation,
} from './visual-record-aggregator.ts';

const SUITES: readonly VisualSuite[] = ['variants', 'pages'];

/** Complete matrix of a started suite, written beside its records: `records/<suite>/.matrix-<runId>`. */
export const visualMatrixFile = (outputRoot: string, suite: VisualSuite, runId: string): string =>
	path.join(outputRoot, 'records', suite, `.matrix-${runId}`);

/**
 * Asserts runtime, geometry, comparison and matrix membership for the captures this shard recorded.
 * Each suite's expected matrix is narrowed to those captures, so coverage is left to the merge.
 */
export function assertVisualShard(options: {
	outputRoot: string;
	runId: string;
	mode: VisualParityMode;
	runtimeFingerprint: Readonly<Record<string, unknown>>;
	expected?: (suite: VisualSuite) => readonly ExpectedVisualCapture[];
}): { failures: string[]; recaptures: string[] } {
	const results = SUITES.map((suite) => {
		if (!visualSuiteStarted(options.outputRoot, suite, options.runId)) return undefined;
		const matrix = (options.expected ?? expectedVisualCaptures)(suite);
		fs.writeFileSync(
			visualMatrixFile(options.outputRoot, suite, options.runId),
			`${JSON.stringify(matrix.map((entry) => entry.file))}\n`,
			'utf8',
		);
		const recorded = new Set(
			readVisualCaptureRecords(options.outputRoot, suite, options.runId).map(
				(record) => record.capture.file,
			),
		);
		const expected = matrix.filter((entry) => recorded.has(entry.file));
		return aggregateVisualSuite({ ...options, suite, expected });
	}).filter((result): result is VisualSuiteAggregation => result !== undefined);
	return {
		failures: describeVisualAggregationFailures(results),
		recaptures: describeVisualRecaptures(results),
	};
}

async function main(): Promise<void> {
	const runId = process.env.VISUAL_PARITY_RUN_ID;
	if (!runId) throw new Error('Visual shard proof requires the shared VISUAL_PARITY_RUN_ID.');
	const { VISUAL_PARITY_RUNTIME } =
		await import('../../tests/e2e/harness/visual-parity-metadata.ts');
	const result = assertVisualShard({
		outputRoot: resolveVisualOutputRoot(),
		runId,
		mode: resolveVisualParityMode(),
		runtimeFingerprint: VISUAL_PARITY_RUNTIME,
	});
	for (const notice of result.recaptures) console.warn(`VISUAL_RECAPTURE ${notice}`);
	if (result.failures.length)
		throw new Error(`Visual shard proof failed:\n${result.failures.join('\n')}`);
	console.log(`Visual shard proof passed for run ${runId}.`);
}

if (process.argv[1] && /^visual-shard-proof\.(?:ts|js)$/u.test(path.basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
