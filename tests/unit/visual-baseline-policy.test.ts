import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	assertVisualComparisonReady,
	shouldCompareVisualSnapshots,
	visualComparisonResult,
} from '../e2e/harness/visual-baseline-policy';

describe('visual baseline policy', () => {
	it('keeps diagnostic runs non-comparative', () => {
		expect(() => assertVisualComparisonReady('diagnostic', 'missing.json')).not.toThrow();
		expect(shouldCompareVisualSnapshots('diagnostic')).toBe(false);
		expect(visualComparisonResult('diagnostic')).toBe('CANDIDATE');
	});

	it('requires an accepted manifest for compare mode', () => {
		expect(() => assertVisualComparisonReady('compare', 'missing.json')).toThrow(
			/accepted baseline manifest/,
		);
	});

	it('accepts a non-empty accepted capture set', () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-baseline-policy-'));
		const manifestPath = path.join(directory, 'manifest.json');
		fs.writeFileSync(
			manifestPath,
			JSON.stringify({
				status: 'ACCEPTED',
				mode: 'accepted',
				totalCaptures: 1,
				matrixHash: 'a'.repeat(64),
				captures: [{ file: 'page.png', sha256: 'b'.repeat(64), viewport: 'mobile' }],
			}),
		);

		expect(() => assertVisualComparisonReady('compare', manifestPath)).not.toThrow();
		expect(shouldCompareVisualSnapshots('compare')).toBe(true);
		expect(visualComparisonResult('compare')).toBe('PASS');

		fs.rmSync(directory, { recursive: true, force: true });
	});
	it('rejects incomplete accepted capture integrity', () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-baseline-policy-'));
		const manifestPath = path.join(directory, 'manifest.json');
		fs.writeFileSync(
			manifestPath,
			JSON.stringify({
				status: 'ACCEPTED',
				mode: 'accepted',
				totalCaptures: 1,
				matrixHash: 'a'.repeat(64),
				captures: [{ file: 'page.png', sha256: 'invalid', viewport: 'mobile' }],
			}),
		);

		expect(() => assertVisualComparisonReady('compare', manifestPath)).toThrow(/SHA-256/);

		fs.rmSync(directory, { recursive: true, force: true });
	});

	it('rejects candidate or empty manifests in compare mode', () => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-baseline-policy-'));
		const manifestPath = path.join(directory, 'manifest.json');
		fs.writeFileSync(
			manifestPath,
			JSON.stringify({ status: 'CANDIDATE', mode: 'candidate', captures: [] }),
		);

		expect(() => assertVisualComparisonReady('compare', manifestPath)).toThrow(
			/status=ACCEPTED/,
		);

		fs.rmSync(directory, { recursive: true, force: true });
	});
});
