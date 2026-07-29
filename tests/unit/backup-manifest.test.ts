import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	CRITICAL_BACKUP_KINDS,
	createArtifactManifest,
	validateCriticalBackupManifest,
	type CriticalBackupManifest,
} from '../../scripts/db/backup-manifest';

function fixture(): CriticalBackupManifest {
	const dir = mkdtempSync(join(tmpdir(), 'celebra-backup-'));
	return {
		version: 1,
		createdAt: new Date().toISOString(),
		environment: 'production',
		projectRef: 'ineitkdkyrxqyressllp',
		artifacts: CRITICAL_BACKUP_KINDS.map((kind) => {
			const path = join(dir, `${kind}.backup`);
			writeFileSync(path, `${kind}:${'x'.repeat(64)}`);
			return createArtifactManifest(kind, path);
		}),
	};
}

describe('critical backup manifest', () => {
	it('validates a complete backup set', () =>
		expect(() => validateCriticalBackupManifest(fixture())).not.toThrow());
	it('rejects a missing critical artifact', () => {
		const manifest = fixture();
		manifest.artifacts.pop();
		expect(() => validateCriticalBackupManifest(manifest)).toThrow(/missing/);
	});
	it('rejects empty or truncated artifacts', () => {
		const manifest = fixture();
		writeFileSync(manifest.artifacts[0]!.path, 'tiny');
		expect(() => validateCriticalBackupManifest(manifest)).toThrow(/empty, or truncated/);
	});
	it('rejects checksum mismatch', () => {
		const manifest = fixture();
		writeFileSync(manifest.artifacts[0]!.path, 'changed'.repeat(20));
		expect(() => validateCriticalBackupManifest(manifest)).toThrow(
			/size mismatch|checksum mismatch/,
		);
	});
});
