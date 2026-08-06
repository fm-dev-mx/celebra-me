import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { RecoveryIntegritySnapshot } from './recovery-integrity.ts';

export const CRITICAL_BACKUP_KINDS = [
	'database',
	'auth',
	'storage-metadata',
	'storage-objects',
] as const;
export type CriticalBackupKind = (typeof CRITICAL_BACKUP_KINDS)[number];

/** Why a verified critical backup was created (optional on legacy manifests). */
export type CriticalBackupPurpose = 'migrate-pre' | 'migrate-post' | 'standalone';

export interface BackupArtifactManifest {
	kind: CriticalBackupKind;
	path: string;
	bytes: number;
	sha256: string;
}

export interface CriticalBackupManifest {
	version: 1;
	createdAt: string;
	environment: 'production' | 'disposable-test';
	projectRef: string;
	artifacts: BackupArtifactManifest[];
	integrity?: RecoveryIntegritySnapshot;
	sourceEnvironment?: 'production' | 'disposable-test';
	/** Optional metadata for migrate reuse / operator evidence. */
	purpose?: CriticalBackupPurpose;
	planId?: string;
	pendingVersions?: string[];
	/** SHA-256 of integrity excluding capturedAt — stable equivalence key. */
	stateDigest?: string;
}

export function hashFile(path: string): string {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function createArtifactManifest(
	kind: CriticalBackupKind,
	path: string,
): BackupArtifactManifest {
	const absolutePath = resolve(path);
	const stats = statSync(absolutePath);
	if (!stats.isFile() || stats.size < 32) {
		throw new Error(`Backup artifact is missing, empty, or truncated: ${basename(path)}`);
	}
	return { kind, path: absolutePath, bytes: stats.size, sha256: hashFile(absolutePath) };
}

export function validateCriticalBackupManifest(
	manifest: CriticalBackupManifest,
	options: { requireCompleteSet?: boolean; allowDisposableTest?: boolean } = {},
): void {
	if (
		manifest.version !== 1 ||
		(manifest.environment !== 'production' &&
			!(options.allowDisposableTest && manifest.environment === 'disposable-test'))
	) {
		throw new Error('Unsupported or unauthorized backup manifest environment.');
	}
	if (options.requireCompleteSet !== false) {
		for (const kind of CRITICAL_BACKUP_KINDS) {
			if (!manifest.artifacts.some((artifact) => artifact.kind === kind)) {
				throw new Error(`Critical backup artifact is missing: ${kind}`);
			}
		}
	}
	for (const artifact of manifest.artifacts) {
		const current = createArtifactManifest(artifact.kind, artifact.path);
		if (current.bytes !== artifact.bytes) {
			throw new Error(`Backup artifact size mismatch: ${basename(artifact.path)}`);
		}
		if (current.sha256 !== artifact.sha256) {
			throw new Error(`Backup artifact checksum mismatch: ${basename(artifact.path)}`);
		}
	}
}
