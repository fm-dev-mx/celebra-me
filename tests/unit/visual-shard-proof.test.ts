import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
	visualShardCoverageFailures,
	requiredVisualSuites,
} from '../../scripts/ops/visual-shard-merge';
import { assertVisualShard, visualMatrixFile } from '../../scripts/screenshot/visual-shard-proof';
import {
	beginVisualRecordRun,
	markVisualSuiteStarted,
	visualRuntimeSha,
	writeVisualCaptureRecord,
} from '../e2e/harness/visual-capture-record';

const runtime = { node: 'v24.14.1', platform: 'linux-x64' };
const matrix = ['a.png', 'b.png', 'c.png'].map((file) => ({ file, viewport: 'mobile' }));
const expected = (suite: string) => (suite === 'variants' ? matrix : []);
const RUN_ID = 'shared-run';

describe('visual proof across browser shards', () => {
	let root: string;
	const previousRunId = process.env.VISUAL_PARITY_RUN_ID;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'visual-shards-'));
		process.env.VISUAL_PARITY_RUN_ID = RUN_ID;
		beginVisualRecordRun(root);
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
		if (previousRunId === undefined) delete process.env.VISUAL_PARITY_RUN_ID;
		else process.env.VISUAL_PARITY_RUN_ID = previousRunId;
	});

	async function record(file: string, height = 844, difference?: string) {
		const png = await sharp({
			create: { width: 390, height, channels: 3, background: { r: 1, g: 2, b: 3 } },
		})
			.png()
			.toBuffer();
		writeFileSync(join(root, file), png);
		writeVisualCaptureRecord(root, {
			suite: 'variants',
			capture: {
				kind: 'variant',
				file,
				sha256: 'stored',
				viewport: 'mobile',
				comparisonResult: difference ? 'FAIL' : 'PASS',
			},
			observedSha256: 'observed',
			runtimeSha: visualRuntimeSha(runtime),
			captureMs: 10,
			...(difference ? { difference } : {}),
		});
	}

	const shard = () =>
		assertVisualShard({
			outputRoot: root,
			runId: RUN_ID,
			mode: 'compare',
			runtimeFingerprint: runtime,
			expected,
		});
	const merge = (required: Array<'variants' | 'pages'> = []) =>
		visualShardCoverageFailures({
			recordsRoot: join(root, 'records'),
			runId: RUN_ID,
			required,
		});

	it('passes a shard that holds part of the matrix and leaves coverage to the merge', async () => {
		markVisualSuiteStarted(root, 'variants');
		await record('a.png');
		expect(shard().failures).toEqual([]);
		expect(
			JSON.parse(readFileSync(visualMatrixFile(root, 'variants', RUN_ID), 'utf8')),
		).toEqual(['a.png', 'b.png', 'c.png']);
		expect(merge()).toEqual(['[variants] 2 captures missing across shards: b.png, c.png']);
	});

	it('fails a shard on differences, geometry and captures outside the matrix', async () => {
		markVisualSuiteStarted(root, 'variants');
		await record('a.png', 844, '12 pixels are different.');
		await record('b.png', 900);
		await record('x.png');
		const failures = shard().failures.join('\n');
		expect(failures).toContain('a.png');
		expect(failures).toContain('b.png is 900px tall');
		expect(failures).toContain('Unexpected visual capture outside the declared matrix');
	});

	it('passes the merge when the joined records cover the matrix', async () => {
		markVisualSuiteStarted(root, 'variants');
		for (const { file } of matrix) await record(file);
		expect(shard().failures).toEqual([]);
		expect(merge(['variants'])).toEqual([]);
	});

	it('fails the merge when a required suite never started or no shard wrote its matrix', () => {
		expect(merge(['variants'])).toEqual(['[variants] no shard recorded this capture suite.']);
		expect(merge()).toEqual([]);
		markVisualSuiteStarted(root, 'variants');
		expect(merge()).toEqual(['[variants] no shard wrote the capture matrix.']);
	});

	it('requires both suites with complete parity and none with deferred parity', () => {
		expect(
			requiredVisualSuites(['pages-1-of-2', 'pages-2-of-2', 'rest-1-of-2', 'rest-2-of-2']),
		).toEqual(['variants', 'pages']);
		expect(requiredVisualSuites(['all-1-of-4', 'all-2-of-4'])).toEqual([]);
		expect(requiredVisualSuites(['all'])).toEqual([]);
	});
});
