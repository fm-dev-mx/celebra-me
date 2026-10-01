import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
	archiveCandidate,
	canSeedCandidateFromAccepted,
	readPreviousAccepted,
	assertCoverageMatrix,
	seedCandidateWithAccepted,
	writeCombinedCandidateArtifacts,
} from '../../scripts/screenshot/visual-parity-cli';
import { assertManifestIntegrity } from '../../scripts/screenshot/visual-manifest-integrity';
import type { CaptureManifest } from '../../scripts/screenshot/visual-manifest';
import type { CandidateReview } from '../../scripts/screenshot/visual-candidate-review';

const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

function solidPng(red: number, height = 30): Promise<Buffer> {
	return sharp({
		create: { width: 40, height, channels: 4, background: { r: red, g: 10, b: 10, alpha: 1 } },
	})
		.png()
		.toBuffer();
}

function capture(file: string, bytes: Buffer) {
	return {
		file,
		sha256: sha(bytes),
		viewport: 'mobile',
		preset: 'test',
		section: 'hero',
		variant: file.replace('.png', ''),
	};
}

it('lists only gate failures for review and keeps prior bundles on rerun', async () => {
	const root = mkdtempSync(join(tmpdir(), 'candidate-review-'));
	const candidate = join(root, 'candidate');
	const accepted = join(root, 'accepted');
	mkdirSync(candidate);
	mkdirSync(accepted);
	const red = await solidPng(200);
	const blue = await solidPng(10);
	const taller = await solidPng(200, 31);
	const reencodedRed = await sharp(red).png({ compressionLevel: 0 }).toBuffer();
	const acceptedFiles = {
		'changed.png': red,
		'taller.png': red,
		'reencoded.png': red,
		'kept.png': red,
		'removed.png': red,
	};
	const candidateFiles = {
		'changed.png': blue,
		'taller.png': taller,
		'reencoded.png': reencodedRed,
		'kept.png': red,
		'new.png': blue,
	};
	const previous: CaptureManifest = {
		status: 'ACCEPTED',
		totalCaptures: 5,
		captures: Object.entries(acceptedFiles).map(([file, bytes]) => capture(file, bytes)),
	};
	const current: CaptureManifest = {
		status: 'CANDIDATE',
		totalCaptures: 5,
		captures: Object.entries(candidateFiles).map(([file, bytes]) => capture(file, bytes)),
	};
	try {
		for (const [file, bytes] of Object.entries(acceptedFiles))
			writeFileSync(join(accepted, file), bytes);
		writeFileSync(join(accepted, 'manifest.json'), JSON.stringify(previous));
		// Old accepted coverage is valid input for candidate generation, never for compare.
		expect(readPreviousAccepted(accepted)).toEqual(previous);
		expect(() => assertCoverageMatrix(previous)).toThrow();
		for (const [file, bytes] of Object.entries(candidateFiles))
			writeFileSync(join(candidate, file), bytes);
		// `kept.png` kept the accepted bytes although this run rendered different bytes.
		mkdirSync(join(candidate, 'records', 'variants'), { recursive: true });
		writeFileSync(
			join(candidate, 'records', 'variants', 'kept.png.json'),
			JSON.stringify({ capture: { file: 'kept.png' }, observedSha256: sha(blue) }),
		);
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
		expect(html.length).toBeLessThan(20_000);
		expect(html).not.toContain('base64');
		expect(html).toContain('../candidate-references/changed.png');
		expect(html).toContain('../candidate-diffs/changed.png');
		expect(html).not.toContain('../candidate-references/reencoded.png');
		const review = JSON.parse(
			readFileSync(join(candidate, 'review.json'), 'utf8'),
		) as CandidateReview;
		expect(review.items.map((item) => [item.file, item.status])).toEqual([
			['taller.png', 'changed'],
			['changed.png', 'changed'],
			['new.png', 'new'],
		]);
		expect(review.items[0].heightDelta).toBe(1);
		expect(review.items[1].differentPixels).toBe(1200);
		expect(review.renderNoise.sort()).toEqual(['kept.png', 'reencoded.png']);
		expect(review.removed).toEqual(['removed.png']);
		expect(readFileSync(join(root, 'candidate-references', 'changed.png'))).toEqual(red);
		expect(existsSync(join(root, 'candidate-diffs', 'changed.png'))).toBe(true);
		expect(() => assertManifestIntegrity(current, candidate)).not.toThrow();

		const first = archiveCandidate(candidate)!;
		expect(existsSync(join(first, 'candidate', 'combined-manifest.json'))).toBe(true);
		expect(readFileSync(join(first, 'candidate-references', 'changed.png'))).toEqual(red);
		expect(existsSync(join(first, 'candidate-diffs', 'changed.png'))).toBe(true);
		mkdirSync(candidate);
		writeFileSync(join(candidate, 'partial.txt'), 'failed capture');
		const second = archiveCandidate(candidate)!;
		expect(first).not.toBe(second);
		expect(existsSync(join(first, 'candidate', 'kept.png'))).toBe(true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

describe('candidate seeding', () => {
	const runtime = {
		node: 'v24.14.1',
		pnpm: '11.23.0',
		playwright: '1.62.1',
		browser: 'chromium',
		browserRevision: '1',
		browserVersion: '1.0',
		platform: 'linux-x64',
		locale: 'en-US',
		timezone: 'UTC',
		deviceScaleFactor: 1,
		osImageDigest: 'sha256:abc',
		fontSha256: 'f',
		cssSha256: 'css-a',
	};

	it('requires the same rendering runtime but not the same sources', () => {
		expect(canSeedCandidateFromAccepted(runtime, { ...runtime, cssSha256: 'css-b' })).toBe(
			true,
		);
		expect(canSeedCandidateFromAccepted(runtime, { ...runtime, fontSha256: 'g' })).toBe(false);
		expect(canSeedCandidateFromAccepted(undefined, runtime)).toBe(false);
	});

	it('copies accepted bytes only for cases in the current matrix', () => {
		const root = mkdtempSync(join(tmpdir(), 'candidate-seed-'));
		const accepted = join(root, 'accepted');
		const candidate = join(root, 'candidate');
		mkdirSync(join(accepted, 'pages'), { recursive: true });
		writeFileSync(join(accepted, 'a.png'), 'a');
		writeFileSync(join(accepted, 'pages', 'b.png'), 'b');
		writeFileSync(join(accepted, 'retired.png'), 'r');
		const previous: CaptureManifest = {
			status: 'ACCEPTED',
			totalCaptures: 3,
			runtimeFingerprint: runtime,
			captures: ['a.png', 'pages/b.png', 'retired.png'].map((file) => ({
				file,
				sha256: '',
				viewport: 'mobile',
				preset: '',
				section: '',
				variant: '',
			})),
		};
		try {
			expect(
				seedCandidateWithAccepted(previous, candidate, accepted, runtime, [
					'a.png',
					'pages/b.png',
					'new.png',
				]),
			).toBe(2);
			expect(readFileSync(join(candidate, 'pages', 'b.png'), 'utf8')).toBe('b');
			expect(existsSync(join(candidate, 'retired.png'))).toBe(false);
			// A copy, not a link: rewriting the candidate never touches the accepted bytes.
			writeFileSync(join(candidate, 'a.png'), 'changed');
			expect(readFileSync(join(accepted, 'a.png'), 'utf8')).toBe('a');
			expect(
				seedCandidateWithAccepted(
					previous,
					join(root, 'other'),
					accepted,
					{ ...runtime, browserRevision: '2' },
					['a.png'],
				),
			).toBeNull();
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
