import { describe, expect, it } from '@jest/globals';
import {
	buildManifest,
	compareManifests,
	type ParityManifest,
} from '../../../scripts/screenshot/css-visual-parity.ts';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('css visual parity harness', () => {
	it('compares equal manifests as ok', () => {
		const baseline: ParityManifest = {
			slug: 'demo',
			route: '/xv/demo',
			phase: 'baseline',
			viewport: 'mobile-standard',
			createdAt: '2026-08-17T00:00:00.000Z',
			files: { 'a.png': 'abc', 'b.png': 'def' },
		};
		const compare: ParityManifest = {
			...baseline,
			phase: 'compare',
			createdAt: '2026-08-17T00:01:00.000Z',
		};
		expect(compareManifests(baseline, compare)).toEqual({ ok: true });
	});

	it('reports missing, unexpected, and hash mismatches', () => {
		const baseline: ParityManifest = {
			slug: 'demo',
			route: '/xv/demo',
			phase: 'baseline',
			viewport: 'mobile-standard',
			createdAt: '2026-08-17T00:00:00.000Z',
			files: { 'a.png': 'abc', 'b.png': 'def' },
		};
		const compare: ParityManifest = {
			...baseline,
			phase: 'compare',
			files: { 'a.png': 'zzz', 'c.png': 'ghi' },
		};
		const result = compareManifests(baseline, compare);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reasons).toEqual(
			expect.arrayContaining([
				'Hash mismatch: a.png',
				'Missing in compare: b.png',
				'Unexpected in compare: c.png',
			]),
		);
	});

	it('builds digests from PNG files on disk', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-parity-'));
		const nested = path.join(dir, 'mobile-standard');
		fs.mkdirSync(nested);
		fs.writeFileSync(path.join(nested, 'hero.png'), 'png-bytes-a');
		fs.writeFileSync(path.join(dir, 'full.png'), 'png-bytes-b');

		const manifest = buildManifest({
			slug: 'demo',
			route: '/xv/demo',
			phase: 'baseline',
			viewport: 'mobile-standard',
			captureDir: dir,
		});

		expect(Object.keys(manifest.files).sort()).toEqual([
			'full.png',
			'mobile-standard/hero.png',
		]);
		expect(manifest.files['full.png']).toMatch(/^[a-f0-9]{64}$/);
		expect(manifest.files['mobile-standard/hero.png']).toMatch(/^[a-f0-9]{64}$/);
		expect(manifest.files['full.png']).not.toEqual(manifest.files['mobile-standard/hero.png']);

		fs.rmSync(dir, { recursive: true, force: true });
	});
});
