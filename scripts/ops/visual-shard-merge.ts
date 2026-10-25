/**
 * Visual capture coverage across every Playwright shard of the browser checks.
 *
 * Each shard proves its own captures and leaves its records with the complete matrix of every
 * suite it started (`scripts/screenshot/visual-shard-proof.ts`). Repository CI joins the records of
 * all shards under one directory, and this fails when a suite that ran, or one the browser parts
 * require, is not fully covered. It uses Node built-ins only, so CI runs it without installing.
 */
import fs from 'node:fs';
import path from 'node:path';

const SUITES = ['variants', 'pages'] as const;
type VisualSuite = (typeof SUITES)[number];

/** Capture suites the named browser parts must start: `rest` shards and `pages` shards. */
export function requiredVisualSuites(parts: readonly string[]): VisualSuite[] {
	return [
		...(parts.some((part) => part.startsWith('rest-')) ? (['variants'] as const) : []),
		...(parts.some((part) => part.startsWith('pages-')) ? (['pages'] as const) : []),
	];
}

function readJson(file: string): unknown {
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Lists the matrix captures no shard recorded, for every suite some shard started, and every
 * required suite no shard started.
 */
export function visualShardCoverageFailures(options: {
	recordsRoot: string;
	runId: string;
	required: readonly VisualSuite[];
}): string[] {
	const failures: string[] = [];
	for (const suite of SUITES) {
		const directory = path.join(options.recordsRoot, suite);
		if (!fs.existsSync(path.join(directory, `.started-${options.runId}`))) {
			if (options.required.includes(suite))
				failures.push(`[${suite}] no shard recorded this capture suite.`);
			continue;
		}
		const matrixFile = path.join(directory, `.matrix-${options.runId}`);
		if (!fs.existsSync(matrixFile)) {
			failures.push(`[${suite}] no shard wrote the capture matrix.`);
			continue;
		}
		const recorded = new Set(
			fs
				.readdirSync(directory)
				.filter((name) => name.endsWith('.json'))
				.map((name) => readJson(path.join(directory, name)))
				.filter(
					(record): record is { capture: { file: string } } =>
						typeof record === 'object' &&
						record !== null &&
						(record as { schema?: unknown }).schema === 1 &&
						(record as { runId?: unknown }).runId === options.runId &&
						(record as { suite?: unknown }).suite === suite,
				)
				.map((record) => record.capture.file),
		);
		const missing = (readJson(matrixFile) as string[]).filter((file) => !recorded.has(file));
		if (missing.length)
			failures.push(
				`[${suite}] ${missing.length} captures missing across shards: ${missing.join(', ')}`,
			);
	}
	return failures;
}

if (process.argv[1] && /^visual-shard-merge\.(?:ts|js)$/u.test(path.basename(process.argv[1]))) {
	const runId = process.env.VISUAL_PARITY_RUN_ID;
	const recordsRoot = process.argv[2];
	if (!runId || !recordsRoot) {
		console.error('Usage: VISUAL_PARITY_RUN_ID=<id> visual-shard-merge.ts <records-directory>');
		process.exit(1);
	}
	const failures = visualShardCoverageFailures({
		recordsRoot,
		runId,
		required: requiredVisualSuites(JSON.parse(process.env.VISUAL_SHARD_PARTS || '[]')),
	});
	if (failures.length) {
		console.error(`Visual coverage across shards failed:\n${failures.join('\n')}`);
		process.exit(1);
	}
	console.log(`Visual coverage across shards passed for run ${runId}.`);
}
