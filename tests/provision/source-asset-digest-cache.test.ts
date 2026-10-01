import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
	openSourceAssetDigestCache,
	sourceAssetDigestKey,
} from '../../scripts/provision/source-asset-digest-cache.ts';

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempPath(): string {
	const dir = mkdtempSync(join(tmpdir(), 'asset-digests-'));
	dirs.push(dir);
	return join(dir, 'db-evidence', 'source-asset-digests.json');
}

const base = {
	sourceBytes: new Uint8Array([1, 2, 3]),
	declaredMime: 'image/jpeg',
	optimizationRole: 'hero',
	sourcePolicy: 'optimize',
};

describe('source asset digest cache', () => {
	it('binds the key to source bytes, normalization inputs and the normalizer', () => {
		const key = sourceAssetDigestKey(base, 'normalizer-a');
		expect(sourceAssetDigestKey({ ...base }, 'normalizer-a')).toBe(key);
		for (const changed of [
			sourceAssetDigestKey(
				{ ...base, sourceBytes: new Uint8Array([1, 2, 4]) },
				'normalizer-a',
			),
			sourceAssetDigestKey({ ...base, declaredMime: 'image/png' }, 'normalizer-a'),
			sourceAssetDigestKey({ ...base, optimizationRole: 'gallery' }, 'normalizer-a'),
			sourceAssetDigestKey({ ...base, sourcePolicy: 'preserve' }, 'normalizer-a'),
			sourceAssetDigestKey(base, 'normalizer-b'),
		]) {
			expect(changed).not.toBe(key);
		}
	});

	it('persists entries across opens', () => {
		const path = tempPath();
		const first = openSourceAssetDigestCache(path);
		first.set('k', 'digest');
		first.flush();
		expect(openSourceAssetDigestCache(path).get('k')).toBe('digest');
	});

	it('starts empty when the file is unreadable or from another version', () => {
		const path = tempPath();
		const seed = openSourceAssetDigestCache(path);
		seed.set('k', 'digest');
		seed.flush();
		writeFileSync(path, JSON.stringify({ version: 999, entries: { k: 'digest' } }));
		expect(openSourceAssetDigestCache(path).get('k')).toBeUndefined();
		writeFileSync(path, '{not json');
		expect(openSourceAssetDigestCache(path).get('k')).toBeUndefined();
	});
});
