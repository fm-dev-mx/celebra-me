import type { FullConfig } from '@playwright/test';
import {
	aggregateVisualSuite,
	describeVisualAggregationFailures,
	type VisualSuiteAggregation,
} from '../../../scripts/screenshot/visual-record-aggregator';
import { resolveVisualParityMode } from './visual-baseline-policy';
import { resolveVisualOutputRoot } from './visual-capture-record';
import { VISUAL_PARITY_RUNTIME } from './visual-parity-metadata';

/**
 * Runs once after every worker has finished. A teardown error fails the Playwright run, which
 * replaces the per-suite `afterAll` assertions that required one serial worker.
 */
export default async function visualRecordTeardown(config: FullConfig): Promise<void> {
	// A shard sees only part of the matrix; shard records are merged by the caller instead.
	if (config.shard) return;
	const runId = process.env.VISUAL_PARITY_RUN_ID;
	if (!runId) return;
	const outputRoot = resolveVisualOutputRoot();
	const mode = resolveVisualParityMode();
	const results = (['variants', 'pages'] as const)
		.map((suite) =>
			aggregateVisualSuite({
				outputRoot,
				suite,
				runId,
				mode,
				runtimeFingerprint: VISUAL_PARITY_RUNTIME,
			}),
		)
		.filter((result): result is VisualSuiteAggregation => result !== undefined);
	const failures = describeVisualAggregationFailures(results);
	if (failures.length) {
		throw new Error(`Visual capture aggregation failed:\n${failures.join('\n')}`);
	}
}
