import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import {
	CRITICAL_BACKUP_KINDS,
	createArtifactManifest,
	type CriticalBackupManifest,
} from '../../scripts/db/backup-manifest.ts';
import {
	assertProductionUnchangedSinceBackup,
	evaluateCriticalBackupReuse,
} from '../../scripts/db/critical-backup-reuse.ts';
import {
	computeRecoveryStateDigest,
	type RecoveryIntegritySnapshot,
} from '../../scripts/db/recovery-integrity.ts';

function integrity(
	overrides: Partial<RecoveryIntegritySnapshot> = {},
): RecoveryIntegritySnapshot {
	return {
		version: 1,
		profile: 'phase3',
		capturedAt: '2026-08-06T12:00:00.000Z',
		migrationCount: 70,
		migrationVersions: ['20260805143000'],
		migrationSha256: 'a'.repeat(64),
		tables: {
			'public.guest_invitations': { rowCount: 3, sha256: 'b'.repeat(64) },
		},
		businessStateSha256: 'c'.repeat(64),
		invariants: { orphanGuests: 0 },
		...overrides,
	};
}

function writeManifest(
	root: string,
	dirName: string,
	manifestOverrides: Partial<CriticalBackupManifest> = {},
	integritySnapshot: RecoveryIntegritySnapshot = integrity(),
): string {
	const dir = join(root, dirName);
	mkdirSync(dir, { recursive: true });
	const artifacts = CRITICAL_BACKUP_KINDS.map((kind) => {
		const path = join(dir, `${kind}.backup`);
		writeFileSync(path, `${kind}:${'x'.repeat(64)}`);
		return createArtifactManifest(kind, path);
	});
	const manifest: CriticalBackupManifest = {
		version: 1,
		createdAt: '2026-08-06T12:00:00.000Z',
		environment: 'production',
		projectRef: 'ineitkdkyrxqyressllp',
		artifacts,
		integrity: integritySnapshot,
		stateDigest: computeRecoveryStateDigest(integritySnapshot),
		purpose: 'migrate-pre',
		...manifestOverrides,
	};
	const manifestPath = join(dir, 'manifest.json');
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	return manifestPath;
}

describe('computeRecoveryStateDigest', () => {
	it('ignores capturedAt when computing the digest', () => {
		const a = integrity({ capturedAt: '2026-08-06T12:00:00.000Z' });
		const b = integrity({ capturedAt: '2026-08-06T13:00:00.000Z' });
		expect(computeRecoveryStateDigest(a)).toBe(computeRecoveryStateDigest(b));
	});

	it('changes when migration checksum changes', () => {
		const a = integrity();
		const b = integrity({ migrationSha256: 'f'.repeat(64) });
		expect(computeRecoveryStateDigest(a)).not.toBe(computeRecoveryStateDigest(b));
	});
});

describe('evaluateCriticalBackupReuse', () => {
	it('reuses a verified manifest when live integrity matches', () => {
		const root = mkdtempSync(join(tmpdir(), 'critical-reuse-'));
		const manifestPath = writeManifest(root, 'critical-2026-08-06T120000Z');
		const live = integrity({ capturedAt: '2026-08-06T14:00:00.000Z' });
		const result = evaluateCriticalBackupReuse({
			prodDbUrl: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
			backupRoot: root,
			captureIntegrity: () => live,
			assertEncrypted: () => undefined,
			listBackups: () => [
				{ path: join(root, 'critical-2026-08-06T120000Z'), createdAt: new Date() },
			],
		});
		expect(result.reusable).toBe(true);
		expect(result.reason).toBe('equivalent');
		expect(result.manifestPath).toBe(manifestPath);
	});

	it('rejects reuse when live integrity drifts', () => {
		const root = mkdtempSync(join(tmpdir(), 'critical-reuse-'));
		writeManifest(root, 'critical-2026-08-06T120000Z');
		const result = evaluateCriticalBackupReuse({
			prodDbUrl: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
			backupRoot: root,
			captureIntegrity: () =>
				integrity({
					migrationSha256: 'd'.repeat(64),
					capturedAt: '2026-08-06T14:00:00.000Z',
				}),
			assertEncrypted: () => undefined,
			listBackups: () => [
				{ path: join(root, 'critical-2026-08-06T120000Z'), createdAt: new Date() },
			],
		});
		expect(result.reusable).toBe(false);
		expect(result.reason).toBe('integrity_mismatch');
	});

	it('rejects manifests without integrity', () => {
		const root = mkdtempSync(join(tmpdir(), 'critical-reuse-'));
		writeManifest(root, 'critical-2026-08-06T120000Z', { integrity: undefined, stateDigest: undefined });
		const result = evaluateCriticalBackupReuse({
			prodDbUrl: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
			backupRoot: root,
			captureIntegrity: () => integrity(),
			assertEncrypted: () => undefined,
			listBackups: () => [
				{ path: join(root, 'critical-2026-08-06T120000Z'), createdAt: new Date() },
			],
		});
		expect(result.reusable).toBe(false);
		expect(result.reason).toBe('missing_integrity');
	});

	it('rejects wrong project refs', () => {
		const root = mkdtempSync(join(tmpdir(), 'critical-reuse-'));
		writeManifest(root, 'critical-2026-08-06T120000Z', {
			projectRef: 'iwipdvisoyerfdytuhwi',
		});
		const result = evaluateCriticalBackupReuse({
			prodDbUrl: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
			backupRoot: root,
			captureIntegrity: () => integrity(),
			assertEncrypted: () => undefined,
			listBackups: () => [
				{ path: join(root, 'critical-2026-08-06T120000Z'), createdAt: new Date() },
			],
		});
		expect(result.reusable).toBe(false);
		expect(result.reason).toBe('project_mismatch');
	});

	it('returns no_candidate when the backup root is empty', () => {
		const root = mkdtempSync(join(tmpdir(), 'critical-reuse-'));
		const result = evaluateCriticalBackupReuse({
			prodDbUrl: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
			backupRoot: root,
			captureIntegrity: () => {
				throw new Error('should not capture without candidates');
			},
			listBackups: () => [],
		});
		expect(result).toEqual({ reusable: false, reason: 'no_candidate' });
	});

	it('prefers the newest matching candidate by createdAt', () => {
		const root = mkdtempSync(join(tmpdir(), 'critical-reuse-'));
		writeManifest(root, 'critical-2026-08-05T120000Z', {
			createdAt: '2026-08-05T12:00:00.000Z',
		});
		const newer = writeManifest(root, 'critical-2026-08-06T150000Z', {
			createdAt: '2026-08-06T15:00:00.000Z',
		});
		const result = evaluateCriticalBackupReuse({
			prodDbUrl: 'postgresql://postgres:secret@db.ineitkdkyrxqyressllp.supabase.co:5432/postgres',
			backupRoot: root,
			captureIntegrity: () => integrity(),
			assertEncrypted: () => undefined,
			listBackups: () => [
				{ path: join(root, 'critical-2026-08-05T120000Z'), createdAt: new Date('2026-08-05') },
				{ path: join(root, 'critical-2026-08-06T150000Z'), createdAt: new Date('2026-08-06') },
			],
		});
		expect(result.reusable).toBe(true);
		expect(result.manifestPath).toBe(newer);
	});
});

describe('assertProductionUnchangedSinceBackup', () => {
	it('accepts an unchanged live snapshot', () => {
		const expected = integrity();
		const result = assertProductionUnchangedSinceBackup({
			prodDbUrl: 'postgresql://example',
			expectedIntegrity: expected,
			captureIntegrity: () => integrity({ capturedAt: 'later' }),
		});
		expect(result.ok).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it('fails closed when business state drifts', () => {
		const expected = integrity();
		const result = assertProductionUnchangedSinceBackup({
			prodDbUrl: 'postgresql://example',
			expectedIntegrity: expected,
			captureIntegrity: () => integrity({ businessStateSha256: 'e'.repeat(64) }),
		});
		expect(result.ok).toBe(false);
		expect(result.failures.join('\n')).toMatch(/business-state/);
	});
});
