import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
	archiveCandidate,
	readPreviousAccepted,
	assertCoverageMatrix,
	writeCombinedCandidateArtifacts,
} from '../../scripts/screenshot/visual-parity-cli';
import { assertManifestIntegrity } from '../../scripts/screenshot/visual-manifest-integrity';
import type { CaptureManifest } from '../../scripts/screenshot/visual-manifest';

it('keeps review HTML small, references exact prior bytes, and preserves both bundles on rerun', () => {
	const root = mkdtempSync(join(tmpdir(), 'candidate-review-'));
	const candidate = join(root, 'candidate');
	const accepted = join(root, 'accepted');
	mkdirSync(candidate);
	mkdirSync(accepted);
	const oldBytes = Buffer.alloc(1024 * 1024, 7);
	const bytes = Buffer.from('candidate');
	const capture = {
		file: 'case.png',
		sha256: createHash('sha256').update(bytes).digest('hex'),
		viewport: 'mobile',
		preset: 'test',
		section: 'hero',
		variant: 'standard',
	};
	const previous: CaptureManifest = {
		status: 'ACCEPTED',
		totalCaptures: 1,
		captures: [{ ...capture, sha256: createHash('sha256').update(oldBytes).digest('hex') }],
	};
	const current: CaptureManifest = { status: 'CANDIDATE', totalCaptures: 1, captures: [capture] };
	try {
		writeFileSync(join(accepted, capture.file), oldBytes);
		writeFileSync(join(accepted, 'manifest.json'), JSON.stringify(previous));
		// Old accepted coverage is valid input for candidate generation, never for compare.
		expect(readPreviousAccepted(accepted)).toEqual(previous);
		expect(() => assertCoverageMatrix(previous)).toThrow();
		writeFileSync(join(candidate, capture.file), bytes);
		writeCombinedCandidateArtifacts(
			candidate,
			{
				...current,
				variantManifest: current,
				pageManifest: { status: 'CANDIDATE', totalCaptures: 0, captures: [] },
			},
			previous,
			accepted,
		);
		const html = readFileSync(join(candidate, 'changes.html'), 'utf8');
		expect(html.length).toBeLessThan(5000);
		expect(html).not.toContain('base64');
		expect(html).toContain('../candidate-references/case.png');
		expect(readFileSync(join(root, 'candidate-references', capture.file))).toEqual(oldBytes);
		expect(() => assertManifestIntegrity(current, candidate)).not.toThrow();
		const first = archiveCandidate(candidate)!;
		expect(existsSync(join(first, 'candidate', 'combined-manifest.json'))).toBe(true);
		expect(readFileSync(join(first, 'candidate-references', capture.file))).toEqual(oldBytes);
		mkdirSync(candidate);
		writeFileSync(join(candidate, 'partial.txt'), 'failed capture');
		const second = archiveCandidate(candidate)!;
		expect(first).not.toBe(second);
		expect(existsSync(join(first, 'candidate', capture.file))).toBe(true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
