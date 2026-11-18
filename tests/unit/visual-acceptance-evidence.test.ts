import {
	assertReviewedCoversChanges,
	buildAcceptanceEvidence,
	parseReviewedPaths,
} from '../../scripts/screenshot/visual-acceptance-evidence';
import type { CandidateReview } from '../../scripts/screenshot/visual-candidate-review';

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
