import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readVisualManifest } from '../../scripts/screenshot/visual-manifest';

const directories: string[] = [];
function fixture() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-manifest-'));
	directories.push(root);
	const variant = {
		status: 'CANDIDATE',
		mode: 'candidate',
		totalCaptures: 1,
		captures: [
			{
				kind: 'variant',
				file: 'variant.png',
				viewport: 'mobile',
				comparisonResult: 'CANDIDATE',
			},
		],
	};
	const page = {
		status: 'CANDIDATE',
		mode: 'candidate',
		totalCaptures: 1,
		captures: [
			{
				kind: 'invitation',
				file: 'page.png',
				viewport: 'mobile',
				comparisonResult: 'CANDIDATE',
			},
		],
	};
	const candidate = {
		...variant,
		totalCaptures: 2,
		captures: [...variant.captures, ...page.captures],
		variantManifest: variant,
		pageManifest: page,
	};
	fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(variant));
	fs.writeFileSync(path.join(root, 'pages-manifest.json'), JSON.stringify(page));
	fs.writeFileSync(path.join(root, 'combined-manifest.json'), JSON.stringify(candidate));
	return { root, candidate };
}
afterEach(() => {
	for (const root of directories.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('visual manifest source selection', () => {
	it('combines an unaccepted candidate without granting acceptance', () => {
		const { root } = fixture();
		const result = readVisualManifest(root, { variants: 1, pages: 1 });
		expect(result.status).toBe('CANDIDATE');
		expect(result.totalCaptures).toBe(2);
	});
	it('prefers the human-accepted primary manifest over the retained candidate', () => {
		const { root, candidate } = fixture();
		const accepted = {
			...candidate,
			status: 'ACCEPTED',
			mode: 'accepted',
			referenceSha: 'reviewed-sha',
			matrixHash: 'reviewed-matrix',
			captures: candidate.captures.map((c) => ({ ...c, comparisonResult: 'ACCEPTED' })),
		};
		fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(accepted));
		const result = readVisualManifest(root, { variants: 1, pages: 1 });
		expect(result.status).toBe('ACCEPTED');
		expect(result.mode).toBe('accepted');
		expect(result.referenceSha).toBe('reviewed-sha');
		expect(result.matrixHash).toBe('reviewed-matrix');
		expect(result.captures).toEqual(accepted.captures);
	});
	it('rejects incomplete page coverage', () => {
		const { root } = fixture();
		expect(() => readVisualManifest(root, { variants: 1, pages: 2 })).toThrow(
			/Expected 2 complete-page captures/,
		);
	});
});
