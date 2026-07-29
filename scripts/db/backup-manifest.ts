import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export const CRITICAL_BACKUP_KINDS = [
	'database',
	'auth',
	'storage-metadata',
	'storage-objects',
] as const;
export type CriticalBackupKind = (typeof CRITICAL_BACKUP_KINDS)[number];

export interface BackupArtifactManifest {
	kind: CriticalBackupKind;
	path: string;
	bytes: number;
	sha256: string;
}

export interface CriticalBackupManifest {
	version: 1;
	createdAt: string;
	environment: 'production';
	projectRef: string;
	artifacts: BackupArtifactManifest[];
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
	options: { requireCompleteSet?: boolean } = {},
): void {
	if (manifest.version !== 1 || manifest.environment !== 'production') {
		throw new Error('Unsupported or non-production backup manifest.');
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
