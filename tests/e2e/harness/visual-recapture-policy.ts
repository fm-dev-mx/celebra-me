import type { VisualParityMode } from './visual-baseline-policy';

export interface VisualCaptureSettlement {
	comparisonResult: 'PASS' | 'FAIL' | 'CANDIDATE';
	/** SHA-256 of the PNG stored under the output root for this capture. */
	storedSha256: string;
	observedSha256: string;
	difference?: string;
	/** First-attempt mismatch that a single in-run re-capture resolved; reported, never hidden. */
	recapturedDifference?: string;
}

/**
 * Compare mode only: a pixel mismatch gets exactly one re-capture of the same, already settled
 * page. It passes only when the re-capture is within the unchanged gate tolerance; otherwise the
 * re-capture's difference fails the run. Candidate and diagnostic modes never re-capture.
 */
export async function settleWithOneRecapture(
	mode: VisualParityMode,
	image: Buffer,
	settle: (image: Buffer) => VisualCaptureSettlement,
	recapture: () => Promise<Buffer>,
): Promise<VisualCaptureSettlement> {
	const first = settle(image);
	if (mode !== 'compare' || first.comparisonResult !== 'FAIL') return first;
	const second = settle(await recapture());
	if (second.comparisonResult !== 'PASS') return second;
	return { ...second, recapturedDifference: first.difference ?? 'pixel mismatch' };
}
