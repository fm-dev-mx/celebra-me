/**
 * Critical backup coverage / reuse for Production migrate.
 *
 * Mirrors release-check evidence reuse: validate cached recovery point against live
 * Production integrity; fail closed to a full capture when equivalence cannot be proven.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	validateCriticalBackupManifest,
	type CriticalBackupManifest,
} from './backup-manifest.ts';
import {
	assertWindowsEfsEncrypted,
	listCriticalBackups,
	type RetentionCandidate,
} from './local-backup-operations.ts';
import {
	captureRecoveryIntegrity,
	compareRecoveryIntegrity,
	computeRecoveryStateDigest,
	type RecoveryIntegritySnapshot,
} from './recovery-integrity.ts';

export const DEFAULT_CRITICAL_BACKUP_ROOT = resolve('.backups', 'prod');

/** How many recent critical directories to inspect for reuse. */
const MAX_CANDIDATES = 12;

export type CriticalBackupReuseReason =
	| 'equivalent'
	| 'no_candidate'
	| 'integrity_mismatch'
	| 'artifact_invalid'
	| 'efs_failed'
	| 'missing_integrity'
	| 'project_mismatch';

export interface CriticalBackupReuseEvaluation {
	reusable: boolean;
	reason: CriticalBackupReuseReason;
	manifestPath?: string;
	manifest?: CriticalBackupManifest;
	liveIntegrity?: RecoveryIntegritySnapshot;
	failures?: string[];
}

export interface EvaluateCriticalBackupReuseInput {
	prodDbUrl: string;
	projectRef?: string;
	backupRoot?: string;
	/** Cap candidate scan; defaults to MAX_CANDIDATES. */
	maxCandidates?: number;
	captureIntegrity?: (dbUrl: string) => RecoveryIntegritySnapshot;
	validateManifest?: (manifest: CriticalBackupManifest) => void;
	assertEncrypted?: (paths: string[]) => void;
	listBackups?: (root: string) => RetentionCandidate[];
	readManifest?: (manifestPath: string) => CriticalBackupManifest | null;
}

interface CandidateScanFlags {
	integrityMismatch: boolean;
	artifactInvalid: boolean;
	efsFailed: boolean;
	missingIntegrity: boolean;
	projectMismatch: boolean;
}

function defaultReadManifest(manifestPath: string): CriticalBackupManifest | null {
	if (!existsSync(manifestPath)) return null;
	try {
		return JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
	} catch {
		return null;
	}
}

function candidateManifestPaths(
	backupRoot: string,
	listBackups: (root: string) => RetentionCandidate[],
	maxCandidates: number,
	readManifest: (path: string) => CriticalBackupManifest | null,
): Array<{ manifestPath: string; createdAtMs: number; manifest: CriticalBackupManifest }> {
	if (!existsSync(backupRoot)) return [];
	const dirs = listBackups(backupRoot).slice(0, maxCandidates);
	const loaded: Array<{ manifestPath: string; createdAtMs: number; manifest: CriticalBackupManifest }> = [];
	for (const dir of dirs) {
		const manifestPath = join(dir.path, 'manifest.json');
		const manifest = readManifest(manifestPath);
		if (!manifest) continue;
		const createdAtMs = Date.parse(manifest.createdAt);
		loaded.push({
			manifestPath,
			createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : dir.createdAt.getTime(),
			manifest,
		});
	}
	loaded.sort((a, b) => b.createdAtMs - a.createdAtMs);
	return loaded;
}

function isProductionManifest(
	manifest: CriticalBackupManifest,
	projectRef: string,
): boolean {
	return manifest.environment === 'production' && manifest.projectRef === projectRef;
}

function artifactsAndEfsOk(
	manifest: CriticalBackupManifest,
	manifestPath: string,
	validateManifest: (manifest: CriticalBackupManifest) => void,
	assertEncrypted: (paths: string[]) => void,
	flags: CandidateScanFlags,
): boolean {
	try {
		validateManifest(manifest);
	} catch {
		flags.artifactInvalid = true;
		return false;
	}
	try {
		assertEncrypted([manifestPath, ...manifest.artifacts.map((artifact) => artifact.path)]);
	} catch {
		flags.efsFailed = true;
		return false;
	}
	return true;
}

function integrityMatchesLive(
	manifest: CriticalBackupManifest,
	liveIntegrity: RecoveryIntegritySnapshot,
	liveDigest: string,
): boolean {
	if (!manifest.integrity) return false;
	const storedDigest = manifest.stateDigest ?? computeRecoveryStateDigest(manifest.integrity);
	if (storedDigest === liveDigest) return true;
	return compareRecoveryIntegrity(manifest.integrity, liveIntegrity, {
		requireValidInvariants: false,
	}).ok;
}

function reasonFromFlags(flags: CandidateScanFlags): CriticalBackupReuseReason {
	if (flags.integrityMismatch) return 'integrity_mismatch';
	if (flags.artifactInvalid) return 'artifact_invalid';
	if (flags.efsFailed) return 'efs_failed';
	if (flags.missingIntegrity) return 'missing_integrity';
	if (flags.projectMismatch) return 'project_mismatch';
	return 'no_candidate';
}

/**
 * Decide whether an existing verified critical backup still covers live Production.
 * Fail-closed: any doubt yields reusable=false (caller must capture).
 */
export function evaluateCriticalBackupReuse(
	input: EvaluateCriticalBackupReuseInput,
): CriticalBackupReuseEvaluation {
	const projectRef = input.projectRef ?? SUPABASE_PROJECT_REFS.production;
	const backupRoot = resolve(input.backupRoot ?? DEFAULT_CRITICAL_BACKUP_ROOT);
	const maxCandidates = input.maxCandidates ?? MAX_CANDIDATES;
	const captureIntegrity = input.captureIntegrity ?? captureRecoveryIntegrity;
	const validateManifest = input.validateManifest ?? ((m) => validateCriticalBackupManifest(m));
	const assertEncrypted = input.assertEncrypted ?? assertWindowsEfsEncrypted;
	const listBackups = input.listBackups ?? listCriticalBackups;
	const readManifest = input.readManifest ?? defaultReadManifest;

	const candidates = candidateManifestPaths(
		backupRoot,
		listBackups,
		maxCandidates,
		readManifest,
	);
	if (candidates.length === 0) {
		return { reusable: false, reason: 'no_candidate' };
	}

	let liveIntegrity: RecoveryIntegritySnapshot;
	try {
		liveIntegrity = captureIntegrity(input.prodDbUrl);
	} catch (error: unknown) {
		return {
			reusable: false,
			reason: 'integrity_mismatch',
			failures: [
				error instanceof Error
					? error.message
					: 'No se pudo capturar la integridad viva de Production.',
			],
		};
	}

	const liveDigest = computeRecoveryStateDigest(liveIntegrity);
	const flags: CandidateScanFlags = {
		integrityMismatch: false,
		artifactInvalid: false,
		efsFailed: false,
		missingIntegrity: false,
		projectMismatch: false,
	};

	for (const candidate of candidates) {
		const manifest = candidate.manifest;
		if (!isProductionManifest(manifest, projectRef)) {
			flags.projectMismatch = true;
			continue;
		}
		if (!manifest.integrity) {
			flags.missingIntegrity = true;
			continue;
		}
		if (
			!artifactsAndEfsOk(
				manifest,
				candidate.manifestPath,
				validateManifest,
				assertEncrypted,
				flags,
			)
		) {
			continue;
		}
		if (integrityMatchesLive(manifest, liveIntegrity, liveDigest)) {
			return {
				reusable: true,
				reason: 'equivalent',
				manifestPath: candidate.manifestPath,
				manifest,
				liveIntegrity,
			};
		}
		flags.integrityMismatch = true;
	}

	const reason = reasonFromFlags(flags);
	return {
		reusable: false,
		reason,
		liveIntegrity,
		failures:
			reason === 'integrity_mismatch'
				? ['Ningún respaldo crítico reciente coincide con el estado vivo de Production.']
				: undefined,
	};
}

/**
 * Re-check that Production still matches a previously accepted backup integrity snapshot.
 * Used after plan revalidation and before owner authorization when a backup was reused.
 */
export function assertProductionUnchangedSinceBackup(input: {
	prodDbUrl: string;
	expectedIntegrity: RecoveryIntegritySnapshot;
	captureIntegrity?: (dbUrl: string) => RecoveryIntegritySnapshot;
}): RecoveryIntegrityComparisonResult {
	const captureIntegrity = input.captureIntegrity ?? captureRecoveryIntegrity;
	const live = captureIntegrity(input.prodDbUrl);
	const comparison = compareRecoveryIntegrity(input.expectedIntegrity, live, {
		requireValidInvariants: false,
	});
	return {
		ok: comparison.ok,
		failures: comparison.failures,
		liveIntegrity: live,
	};
}

export interface RecoveryIntegrityComparisonResult {
	ok: boolean;
	failures: string[];
	liveIntegrity: RecoveryIntegritySnapshot;
}
