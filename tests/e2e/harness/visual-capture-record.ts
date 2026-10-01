import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Per-capture evidence written by each test. Suite manifests are rebuilt from these files after
 * the run, so capture suites no longer depend on one worker keeping in-memory state.
 */
export type VisualSuite = 'variants' | 'pages';

export interface VisualCaptureEntry {
	[key: string]: unknown;
	file: string;
	sha256: string;
	viewport: string;
	comparisonResult: string;
}

export interface VisualCaptureRecord {
	schema: 1;
	runId: string;
	suite: VisualSuite;
	capture: VisualCaptureEntry;
	/** SHA-256 of the bytes rendered in this run; differs from `capture.sha256` when kept. */
	observedSha256: string;
	/** Identity of the worker's runtime fingerprint; every record of a run must agree. */
	runtimeSha: string;
	captureMs: number;
	difference?: string;
}

export const DEFAULT_VISUAL_OUTPUT_ROOT = 'output/screenshots/variant-portability';

export function resolveVisualOutputRoot(): string {
	return path.resolve(
		process.cwd(),
		process.env.VISUAL_PARITY_OUTPUT_ROOT ?? DEFAULT_VISUAL_OUTPUT_ROOT,
	);
}

export function visualRecordsRoot(outputRoot: string): string {
	return path.join(outputRoot, 'records');
}

/** Called once per Playwright run; records from earlier runs must never fill coverage gaps. */
export function beginVisualRecordRun(outputRoot = resolveVisualOutputRoot()): string {
	const runId = process.env.VISUAL_PARITY_RUN_ID || randomUUID();
	process.env.VISUAL_PARITY_RUN_ID = runId;
	fs.rmSync(visualRecordsRoot(outputRoot), { recursive: true, force: true });
	return runId;
}

export function currentVisualRunId(): string {
	const runId = process.env.VISUAL_PARITY_RUN_ID;
	if (!runId) throw new Error('Visual capture records require VISUAL_PARITY_RUN_ID from setup.');
	return runId;
}

export function sha256(buffer: Buffer): string {
	return createHash('sha256').update(buffer).digest('hex');
}

export function visualRuntimeSha(runtime: Readonly<Record<string, unknown>>): string {
	return createHash('sha256').update(JSON.stringify(runtime)).digest('hex');
}

export function writeVisualCaptureRecord(
	outputRoot: string,
	record: Omit<VisualCaptureRecord, 'schema' | 'runId'>,
): void {
	const directory = path.join(visualRecordsRoot(outputRoot), record.suite);
	fs.mkdirSync(directory, { recursive: true });
	const target = path.join(directory, `${record.capture.file.replace(/[\\/]/gu, '__')}.json`);
	const temporary = `${target}.${process.pid}.tmp`;
	const payload: VisualCaptureRecord = { schema: 1, runId: currentVisualRunId(), ...record };
	fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
	fs.renameSync(temporary, target);
}

/** Marks that a capture suite ran in this run, so zero records still yield a FAILED manifest. */
export function markVisualSuiteStarted(outputRoot: string, suite: VisualSuite): void {
	const directory = path.join(visualRecordsRoot(outputRoot), suite);
	fs.mkdirSync(directory, { recursive: true });
	fs.writeFileSync(path.join(directory, `.started-${currentVisualRunId()}`), '', 'utf8');
}

export function visualSuiteStarted(outputRoot: string, suite: VisualSuite, runId: string): boolean {
	return fs.existsSync(path.join(visualRecordsRoot(outputRoot), suite, `.started-${runId}`));
}

export function readVisualCaptureRecords(
	outputRoot: string,
	suite: VisualSuite,
	runId: string,
): VisualCaptureRecord[] {
	const directory = path.join(visualRecordsRoot(outputRoot), suite);
	if (!fs.existsSync(directory)) return [];
	return fs
		.readdirSync(directory)
		.filter((name) => name.endsWith('.json'))
		.map(
			(name) =>
				JSON.parse(
					fs.readFileSync(path.join(directory, name), 'utf8'),
				) as VisualCaptureRecord,
		)
		.filter(
			(record) => record.schema === 1 && record.runId === runId && record.suite === suite,
		);
}

/** Observed bytes per capture file across both suites of the most recent run under a root. */
export function readVisualRecordObservations(outputRoot: string): Map<string, string> {
	const observations = new Map<string, string>();
	for (const suite of ['variants', 'pages'] as const) {
		const directory = path.join(visualRecordsRoot(outputRoot), suite);
		if (!fs.existsSync(directory)) continue;
		// Setup resets the records directory for every run, so every record under it belongs to
		// the latest run, including a candidate copied out of the certification container.
		for (const name of fs.readdirSync(directory).filter((entry) => entry.endsWith('.json'))) {
			const record = JSON.parse(
				fs.readFileSync(path.join(directory, name), 'utf8'),
			) as VisualCaptureRecord;
			observations.set(record.capture.file, record.observedSha256);
		}
	}
	return observations;
}

/**
 * Byte-identical output is pixel-identical, so it passes the gate without decoding both PNGs.
 * Playwright's comparator otherwise decodes and diffs even identical complete pages.
 */
export function matchesAcceptedBytes(snapshotPath: string, image: Buffer): boolean {
	try {
		return image.equals(fs.readFileSync(snapshotPath));
	} catch {
		return false;
	}
}

/** Capture suites stay serial unless an explicit parallel trial selects otherwise. */
export function visualSuiteMode(): 'parallel' | 'serial' {
	return process.env.VISUAL_PARITY_PARALLEL === '1' ? 'parallel' : 'serial';
}
