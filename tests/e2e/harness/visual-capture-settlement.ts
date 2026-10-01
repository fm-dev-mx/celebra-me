import { expect, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { recordVisualComparison } from './deferred-visual-comparison';
import {
	shouldCompareVisualSnapshots,
	visualComparisonResult,
	type VisualParityMode,
} from './visual-baseline-policy';
import {
	matchesAcceptedBytes,
	resolveVisualOutputRoot,
	sha256,
	visualRuntimeSha,
	writeVisualCaptureRecord,
	type VisualCaptureEntry,
	type VisualSuite,
} from './visual-capture-record';
import { VISUAL_PARITY_RUNTIME } from './visual-parity-metadata';

const RUNTIME_SHA = visualRuntimeSha(VISUAL_PARITY_RUNTIME);

export interface VisualCaptureSettlement {
	comparisonResult: 'PASS' | 'FAIL' | 'CANDIDATE';
	/** SHA-256 of the PNG stored under the output root for this capture. */
	storedSha256: string;
	observedSha256: string;
	difference?: string;
}

/**
 * Compares one capture with the gate's tolerance and stores its PNG under the output root.
 * In compare mode, byte-identical output passes without decoding; pixel mismatches are deferred
 * to aggregation. When candidate snapshots and output share a root, `toMatchSnapshot` keeps the
 * existing bytes for gate-passing captures, so the stored PNG is read back instead of rewritten.
 */
export function settleVisualCapture(options: {
	testInfo: TestInfo;
	mode: VisualParityMode;
	file: string;
	image: Buffer;
}): VisualCaptureSettlement {
	const { testInfo, mode, file, image } = options;
	const segments = file.split('/');
	const snapshotName = segments.length > 1 ? segments : file;
	const snapshotPath = testInfo.snapshotPath(...segments);
	let comparisonResult: VisualCaptureSettlement['comparisonResult'] =
		visualComparisonResult(mode);
	let difference: string | undefined;
	if (shouldCompareVisualSnapshots(mode)) {
		const compare = () =>
			expect(image).toMatchSnapshot(snapshotName, { maxDiffPixelRatio: 0.001 });
		if (mode !== 'compare') compare();
		else if (!matchesAcceptedBytes(snapshotPath, image)) {
			const differences: Array<{ file: string; message: string }> = [];
			comparisonResult = recordVisualComparison(compare, file, differences);
			difference = differences[0]?.message;
		}
	}

	const observedSha256 = sha256(image);
	const outputPath = path.join(resolveVisualOutputRoot(), file);
	let storedSha256 = observedSha256;
	if (path.resolve(outputPath) === path.resolve(snapshotPath)) {
		storedSha256 = sha256(fs.readFileSync(outputPath));
	} else {
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, image);
	}
	return {
		comparisonResult,
		storedSha256,
		observedSha256,
		...(difference ? { difference } : {}),
	};
}

export function recordVisualCapture(
	suite: VisualSuite,
	capture: VisualCaptureEntry,
	settlement: VisualCaptureSettlement,
	captureMs: number,
): void {
	writeVisualCaptureRecord(resolveVisualOutputRoot(), {
		suite,
		capture,
		observedSha256: settlement.observedSha256,
		runtimeSha: RUNTIME_SHA,
		captureMs,
		...(settlement.difference ? { difference: settlement.difference } : {}),
	});
}
