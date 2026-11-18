import {
	assertReviewedCoversChanges,
	buildAcceptanceEvidence,
	parseReviewedPaths,
} from '../../scripts/screenshot/visual-acceptance-evidence';
import type { CandidateReview } from '../../scripts/screenshot/visual-candidate-review';
import { acceptedManifestSha256 } from '../../scripts/screenshot/visual-demo-manifests';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const review = {
	referenceSha: 'a'.repeat(40),
	matrixHash: 'm1',
	candidateManifestSha256: 'c1',
	items: [
		{ file: 'pages/boda/x-mobile.png', status: 'changed', sha256: 's1', previousSha256: 's0' },
		{ file: 'pages/xv/y-mobile.png', status: 'new', sha256: 's2' },
	],
	renderNoise: ['n.png'],
	removed: [],
} as unknown as CandidateReview;

describe('visual acceptance evidence', () => {
	it('requires an explicit reviewed list', () => {
		expect(() => parseReviewedPaths(undefined)).toThrow(/--reviewed/);
		expect(() => parseReviewedPaths(' , ')).toThrow(/empty/);
		expect(parseReviewedPaths('none')).toEqual([]);
		expect(parseReviewedPaths('a.png, b/')).toEqual(['a.png', 'b/']);
	});

	it('accepts exact paths and directory prefixes that cover every change', () => {
		expect(assertReviewedCoversChanges(review, ['pages/boda/x-mobile.png', 'pages/xv/'])).toBe(
			review,
		);
	});

	it('fails when a change is outside the reviewed list', () => {
		expect(() => assertReviewedCoversChanges(review, ['pages/boda/'])).toThrow(
			/pages\/xv\/y-mobile\.png/,
		);
		expect(() => assertReviewedCoversChanges(review, [])).toThrow(/outside --reviewed/);
	});

	it('fails on reviewed paths without a change, and on a missing review', () => {
		expect(() =>
			assertReviewedCoversChanges(review, ['pages/boda/', 'pages/xv/', 'pages/other/']),
		).toThrow(/no change/);
		expect(() => assertReviewedCoversChanges(null, [])).toThrow(/missing/);
	});

	it('requires removed captures in the reviewed list too', () => {
		const withRemoved = { ...review, removed: ['pages/old/z-mobile.png'] } as CandidateReview;
		const listed = ['pages/boda/x-mobile.png', 'pages/xv/'];
		expect(() => assertReviewedCoversChanges(withRemoved, listed)).toThrow(
			/pages\/old\/z-mobile/,
		);
		expect(
			assertReviewedCoversChanges(withRemoved, [...listed, 'pages/old/z-mobile.png']),
		).toBe(withRemoved);
	});

	it('hashes the demo manifests with the accepted manifest', () => {
		const dir = mkdtempSync(join(tmpdir(), 'accepted-'));
		try {
			const manifest = join(dir, 'manifest.json');
			writeFileSync(manifest, '{"captures":[]}');
			mkdirSync(join(dir, 'demos'));
			writeFileSync(join(dir, 'demos', 'x.json'), '{"a":1}');
			const before = acceptedManifestSha256(manifest);
			writeFileSync(join(dir, 'demos', 'x.json'), '{"a":2}');
			expect(acceptedManifestSha256(manifest)).not.toBe(before);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('records hashes and reviewed paths', () => {
		const evidence = buildAcceptanceEvidence({
			review,
			reviewed: ['pages/'],
			diffsRoot: 'nowhere',
			matrixHash: 'm1',
			candidateManifestSha256: 'c1',
			acceptedManifestSha256: 'a1',
			referenceSha: 'r',
			acceptedAt: 't',
		});
		expect(evidence).toMatchObject({
			matrixHash: 'm1',
			candidateManifestSha256: 'c1',
			acceptedManifestSha256: 'a1',
			reviewedPaths: ['pages/'],
			renderNoise: 1,
		});
		expect(evidence.items).toHaveLength(2);
	});
});
