import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { assertManifestIntegrity } from '../../scripts/screenshot/visual-manifest-integrity';
import { assertPinnedVisualRuntime } from '../../scripts/screenshot/visual-parity-cli';

describe('certified capture preflight', () => {
	it('rejects missing digest before candidate capture', () => {
		const runtime = {
			node: 'v24.14.1',
			pnpm: '11.23.0',
			playwright: '1.62.1',
			browser: 'chromium',
			platform: 'linux-x64',
			locale: 'en-US',
			timezone: 'UTC',
			deviceScaleFactor: 1,
		};
		expect(() =>
			assertPinnedVisualRuntime({ runtimeFingerprint: runtime }, 'candidate'),
		).toThrow('verified Linux image digest');
	});
	it('rejects missing files, LFS pointers and altered bytes before capture', () => {
		const root = mkdtempSync(join(tmpdir(), 'visual-integrity-'));
		try {
			const bytes = Buffer.from('expected image bytes');
			const manifest = {
				captures: [
					{ file: 'case.png', sha256: createHash('sha256').update(bytes).digest('hex') },
				],
			};
			expect(() => assertManifestIntegrity(manifest, root)).toThrow('missing');
			writeFileSync(join(root, 'case.png'), 'version https://git-lfs.github.com/spec/v1\n');
			expect(() => assertManifestIntegrity(manifest, root)).toThrow('hash mismatch');
			writeFileSync(join(root, 'case.png'), bytes);
			expect(() => assertManifestIntegrity(manifest, root)).not.toThrow();
			writeFileSync(join(root, 'case.png'), 'changed pixels');
			expect(() => assertManifestIntegrity(manifest, root)).toThrow('hash mismatch');
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
