import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
	aggregateVisualSuite,
	describeVisualAggregationFailures,
	describeVisualRecaptures,
} from '../../scripts/screenshot/visual-record-aggregator';
import {
	beginVisualRecordRun,
	markVisualSuiteStarted,
	matchesAcceptedBytes,
	readVisualRecordObservations,
	visualRuntimeSha,
	writeVisualCaptureRecord,
} from '../e2e/harness/visual-capture-record';

const runtime = { node: 'v24.14.1', platform: 'linux-x64' };

function mobilePng(height = 844): Promise<Buffer> {
	return sharp({
		create: { width: 390, height, channels: 3, background: { r: 1, g: 2, b: 3 } },
	})
		.png()
		.toBuffer();
}

describe('visual capture records', () => {
	let root: string;
	const previousRunId = process.env.VISUAL_PARITY_RUN_ID;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'visual-records-'));
		delete process.env.VISUAL_PARITY_RUN_ID;
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
		if (previousRunId === undefined) delete process.env.VISUAL_PARITY_RUN_ID;
		else process.env.VISUAL_PARITY_RUN_ID = previousRunId;
	});

	async function record(
		file: string,
		options: { difference?: string; height?: number; recapturedDifference?: string } = {},
	) {
		writeFileSync(join(root, file), await mobilePng(options.height));
		writeVisualCaptureRecord(root, {
			suite: 'variants',
			capture: {
				kind: 'variant',
				file,
				sha256: 'stored',
				viewport: 'mobile',
				comparisonResult: options.difference ? 'FAIL' : 'PASS',
			},
			observedSha256: 'observed',
			runtimeSha: visualRuntimeSha(runtime),
			captureMs: 10,
			...(options.difference ? { difference: options.difference } : {}),
			...(options.recapturedDifference
				? { recapturedDifference: options.recapturedDifference }
				: {}),
		});
	}

	const expected = ['a.png', 'b.png', 'c.png'].map((file) => ({ file, viewport: 'mobile' }));

	it('rebuilds the manifest in matrix order and fails on differences and gaps', async () => {
		beginVisualRecordRun(root);
		const runId = process.env.VISUAL_PARITY_RUN_ID!;
		markVisualSuiteStarted(root, 'variants');
		await record('b.png', { difference: '12 pixels (ratio 0.01) are different.' });
		await record('a.png');
		const result = aggregateVisualSuite({
			outputRoot: root,
			suite: 'variants',
			runId,
			mode: 'compare',
			runtimeFingerprint: runtime,
			expected,
		})!;
		expect(result.status).toBe('FAILED');
		expect(result.missing).toEqual(['c.png']);
		expect(result.differences).toEqual([
			{ file: 'b.png', message: '12 pixels (ratio 0.01) are different.' },
		]);
		const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
		expect(manifest.captures.map((capture: { file: string }) => capture.file)).toEqual([
			'a.png',
			'b.png',
		]);
		expect(manifest.matrixHash).toMatch(/^[0-9a-f]{64}$/u);
		expect(existsSync(join(root, 'contact-sheet.html'))).toBe(true);
		expect(describeVisualAggregationFailures([result])).toHaveLength(2);
		expect(readVisualRecordObservations(root).get('a.png')).toBe('observed');
	});

	it('passes a complete compare run and ignores records from earlier runs', async () => {
		beginVisualRecordRun(root);
		markVisualSuiteStarted(root, 'variants');
		for (const { file } of expected) await record(file);
		const staleDirectory = join(root, 'records', 'variants');
		writeFileSync(
			join(staleDirectory, 'stale.json'),
			JSON.stringify({ schema: 1, runId: 'old', suite: 'variants', capture: { file: 'x' } }),
		);
		const result = aggregateVisualSuite({
			outputRoot: root,
			suite: 'variants',
			runId: process.env.VISUAL_PARITY_RUN_ID!,
			mode: 'compare',
			runtimeFingerprint: runtime,
			expected,
		})!;
		expect(result.status).toBe('COMPARED');
		expect(describeVisualAggregationFailures([result])).toEqual([]);
	});

	it('passes a recaptured capture but reports it as a flake', async () => {
		beginVisualRecordRun(root);
		markVisualSuiteStarted(root, 'variants');
		await record('a.png', { recapturedDifference: '9120 pixels (ratio 0.03) are different.' });
		await record('b.png');
		await record('c.png');
		const result = aggregateVisualSuite({
			outputRoot: root,
			suite: 'variants',
			runId: process.env.VISUAL_PARITY_RUN_ID!,
			mode: 'compare',
			runtimeFingerprint: runtime,
			expected,
		})!;
		expect(result.status).toBe('COMPARED');
		expect(result.recaptured).toEqual(['a.png']);
		expect(describeVisualAggregationFailures([result])).toEqual([]);
		expect(describeVisualRecaptures([result])).toEqual([
			expect.stringContaining('[variants] 1 captures passed only after one re-capture'),
		]);
	});

	it('resets earlier records when a new run begins', async () => {
		beginVisualRecordRun(root);
		markVisualSuiteStarted(root, 'variants');
		await record('a.png');
		delete process.env.VISUAL_PARITY_RUN_ID;
		beginVisualRecordRun(root);
		expect(existsSync(join(root, 'records'))).toBe(false);
	});

	it('rejects mixed runtimes and wrong viewport geometry', async () => {
		beginVisualRecordRun(root);
		markVisualSuiteStarted(root, 'variants');
		await record('a.png', { height: 900 });
		const result = aggregateVisualSuite({
			outputRoot: root,
			suite: 'variants',
			runId: process.env.VISUAL_PARITY_RUN_ID!,
			mode: 'diagnostic',
			runtimeFingerprint: { ...runtime, node: 'v22.0.0' },
			expected,
		})!;
		expect(result.missing).toEqual([]);
		expect(result.errors).toEqual([
			'a.png was captured with a different runtime fingerprint.',
			'a.png is 900px tall; expected 844px.',
		]);
	});

	it('skips suites that did not run', () => {
		beginVisualRecordRun(root);
		expect(
			aggregateVisualSuite({
				outputRoot: root,
				suite: 'pages',
				runId: process.env.VISUAL_PARITY_RUN_ID!,
				mode: 'compare',
				runtimeFingerprint: runtime,
				expected,
			}),
		).toBeUndefined();
	});

	it('treats only byte-identical accepted files as a fast pass', () => {
		mkdirSync(join(root, 'pages'));
		writeFileSync(join(root, 'pages', 'a.png'), 'same');
		expect(matchesAcceptedBytes(join(root, 'pages', 'a.png'), Buffer.from('same'))).toBe(true);
		expect(matchesAcceptedBytes(join(root, 'pages', 'a.png'), Buffer.from('other'))).toBe(
			false,
		);
		expect(matchesAcceptedBytes(join(root, 'missing.png'), Buffer.from('same'))).toBe(false);
	});
});
