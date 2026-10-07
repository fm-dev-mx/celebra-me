/**
 * Rebuilds the per-suite visual manifests from the capture records written by each test.
 *
 * Records replace module-level accumulation in `afterAll`, which tied each capture suite to one
 * worker. Coverage, PNG geometry and comparison results are asserted here, once, after every
 * worker has finished.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
	readVisualCaptureRecords,
	visualRuntimeSha,
	visualSuiteStarted,
	type VisualCaptureEntry,
	type VisualSuite,
} from '../../tests/e2e/harness/visual-capture-record.ts';
import type { VisualParityMode } from '../../tests/e2e/harness/visual-baseline-policy.ts';
import {
	buildVisualPageCases,
	buildVisualVariantCases,
	computeVisualMatrixHash,
	visualPageCaseFile,
	visualVariantCaseFile,
	VISUAL_VIEWPORTS,
} from './visual-coverage-contract.ts';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const VISUAL_SUITE_MANIFESTS: Record<VisualSuite, string> = {
	variants: 'manifest.json',
	pages: 'pages-manifest.json',
};

export interface ExpectedVisualCapture {
	file: string;
	viewport: string;
}

export interface VisualSuiteAggregation {
	suite: VisualSuite;
	manifestPath: string;
	status: 'FAILED' | 'COMPARED' | 'CANDIDATE';
	totalCaptures: number;
	missing: string[];
	differences: Array<{ file: string; message: string }>;
	/** Captures that mismatched once and passed one in-run re-capture: flakes to fix, not hide. */
	recaptured: string[];
	errors: string[];
}

export function expectedVisualCaptures(suite: VisualSuite): ExpectedVisualCapture[] {
	if (suite === 'variants') {
		return buildVisualVariantCases().map((entry) => ({
			file: visualVariantCaseFile(entry),
			viewport: entry.viewport,
		}));
	}
	return buildVisualPageCases().flatMap((entry) =>
		VISUAL_VIEWPORTS.map((viewport) => ({
			file: visualPageCaseFile(entry, viewport.name),
			viewport: viewport.name,
		})),
	);
}

function assertPngGeometry(
	outputRoot: string,
	capture: VisualCaptureEntry,
	suite: VisualSuite,
): string | undefined {
	const filePath = path.join(outputRoot, capture.file);
	if (!fs.existsSync(filePath)) return `Missing PNG for ${capture.file}.`;
	const header = Buffer.alloc(24);
	const descriptor = fs.openSync(filePath, 'r');
	try {
		fs.readSync(descriptor, header, 0, header.length, 0);
	} finally {
		fs.closeSync(descriptor);
	}
	if (!header.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
		return `Invalid PNG signature for ${capture.file}.`;
	}
	const viewport = VISUAL_VIEWPORTS.find((candidate) => candidate.name === capture.viewport);
	if (!viewport) return `Unknown viewport ${capture.viewport} for ${capture.file}.`;
	const width = header.readUInt32BE(16);
	const height = header.readUInt32BE(20);
	if (width !== viewport.width) {
		return `${capture.file} is ${width}px wide; expected ${viewport.width}px.`;
	}
	// Variant references are viewport captures; complete pages extend below the fold.
	if (suite === 'variants' && height !== viewport.height) {
		return `${capture.file} is ${height}px tall; expected ${viewport.height}px.`;
	}
	return undefined;
}

export function aggregateVisualSuite(options: {
	outputRoot: string;
	suite: VisualSuite;
	runId: string;
	mode: VisualParityMode;
	runtimeFingerprint: Readonly<Record<string, unknown>>;
	expected?: readonly ExpectedVisualCapture[];
	now?: Date;
}): VisualSuiteAggregation | undefined {
	const { outputRoot, suite, runId, mode } = options;
	if (!visualSuiteStarted(outputRoot, suite, runId)) return undefined;

	const expected = options.expected ?? expectedVisualCaptures(suite);
	const records = readVisualCaptureRecords(outputRoot, suite, runId);
	const recordsByFile = new Map(records.map((record) => [record.capture.file, record]));
	const expectedFiles = new Set(expected.map((entry) => entry.file));
	const errors: string[] = [];
	const runtimeSha = visualRuntimeSha(options.runtimeFingerprint);
	for (const record of records) {
		if (record.runtimeSha !== runtimeSha) {
			errors.push(
				`${record.capture.file} was captured with a different runtime fingerprint.`,
			);
		}
	}

	// Keep the declared matrix order so manifests stay comparable with earlier serial runs.
	const ordered = [
		...expected.flatMap((entry) => recordsByFile.get(entry.file) ?? []),
		...records.filter((record) => !expectedFiles.has(record.capture.file)),
	];
	const captures = ordered.map((record) => record.capture);
	const missing =
		mode === 'diagnostic'
			? []
			: expected.filter((entry) => !recordsByFile.has(entry.file)).map((entry) => entry.file);
	if (mode !== 'diagnostic') {
		for (const record of records) {
			if (!expectedFiles.has(record.capture.file)) {
				errors.push(
					`Unexpected visual capture outside the declared matrix: ${record.capture.file}`,
				);
			}
		}
	}
	for (const capture of captures) {
		const error = assertPngGeometry(outputRoot, capture, suite);
		if (error) errors.push(error);
	}
	const differences = ordered
		.filter((record) => record.difference !== undefined)
		.map((record) => ({ file: record.capture.file, message: record.difference ?? '' }));
	const recaptured = ordered
		.filter((record) => record.recapturedDifference !== undefined)
		.map((record) => record.capture.file);

	const status =
		differences.length || missing.length || errors.length
			? 'FAILED'
			: mode === 'compare'
				? 'COMPARED'
				: 'CANDIDATE';
	const manifest = {
		generatedAt: (options.now ?? new Date()).toISOString(),
		runtimeFingerprint: options.runtimeFingerprint,
		status,
		mode,
		totalCaptures: captures.length,
		matrixHash: computeVisualMatrixHash(captures),
		...(suite === 'variants'
			? { baselinePreset: 'jewelry-box', crossPreset: 'celestial-blue' }
			: { cases: expected.length / VISUAL_VIEWPORTS.length }),
		...(missing.length ? { missing } : {}),
		captures,
	};
	const manifestPath = path.join(outputRoot, VISUAL_SUITE_MANIFESTS[suite]);
	fs.mkdirSync(outputRoot, { recursive: true });
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
	if (suite === 'variants' && captures.length) {
		writeVariantContactSheet(outputRoot, manifest.status, manifest.generatedAt, captures);
	}
	return {
		suite,
		manifestPath,
		status,
		totalCaptures: captures.length,
		missing,
		differences,
		recaptured,
		errors,
	};
}

export function describeVisualRecaptures(results: readonly VisualSuiteAggregation[]): string[] {
	return results
		.filter((result) => result.recaptured.length > 0)
		.map(
			(result) =>
				`[${result.suite}] ${result.recaptured.length} captures passed only after one re-capture (nondeterministic, fix the source): ${result.recaptured.join(', ')}`,
		);
}

export function describeVisualAggregationFailures(
	results: readonly VisualSuiteAggregation[],
): string[] {
	return results.flatMap((result) => [
		...result.errors.map((error) => `[${result.suite}] ${error}`),
		...(result.missing.length
			? [
					`[${result.suite}] ${result.missing.length} captures missing: ${result.missing.join(', ')}`,
				]
			: []),
		...(result.differences.length
			? [
					`[${result.suite}] ${result.differences.length} visual comparisons failed: ${result.differences
						.map((difference) => difference.file)
						.join(', ')}`,
				]
			: []),
	]);
}

function escapeHtml(value: unknown): string {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function writeVariantContactSheet(
	outputRoot: string,
	status: string,
	generatedAt: string,
	captures: readonly VisualCaptureEntry[],
): void {
	const cards = captures
		.map(
			(capture) => `<article><header><strong>${escapeHtml(capture.section)}.${escapeHtml(
				capture.variant,
			)}</strong><span>${escapeHtml(capture.preset)} / ${escapeHtml(capture.viewport)}</span></header>
<p>CSS: <code>${escapeHtml(capture.cssOwner)}</code></p>
<a href="${escapeHtml(capture.file)}"><img src="${escapeHtml(capture.file)}" alt="${escapeHtml(
				capture.file,
			)}" loading="lazy"></a><code>${escapeHtml(capture.sha256)}</code></article>`,
		)
		.join('\n');
	fs.writeFileSync(
		path.join(outputRoot, 'contact-sheet.html'),
		`<!doctype html><html lang="es"><meta charset="utf-8"><title>Variantes canónicas</title>
<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;margin:2rem}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:1rem}article{background:#1e293b;padding:1rem;border-radius:8px}header{display:flex;justify-content:space-between;gap:.5rem}img{max-width:100%;height:auto}code{display:block;word-break:break-all;font-size:.7rem;color:#cbd5e1}</style>
<h1>Variantes canónicas</h1><p>Estado: ${escapeHtml(status)} · ${captures.length} capturas · ${escapeHtml(generatedAt)}</p><main>${cards}</main></html>`,
		'utf8',
	);
}
