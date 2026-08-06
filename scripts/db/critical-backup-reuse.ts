/**
 * Critical backup coverage for Production migrate (online, bounded RPO).
 *
 * A verified backup remains valid when normal business rows change after capture.
 * Coverage fails closed on identity/project mismatch, missing integrity, invalid
 * artifacts/EFS, recovery-profile mismatch, migration-history drift, or RPO expiry.
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
	type RecoveryIntegritySnapshot,
} from './recovery-integrity.ts';

export const DEFAULT_CRITICAL_BACKUP_ROOT = resolve('.backups', 'prod');

/** Maximum age of a reusable pre-migration critical backup (bounded RPO). */
export const CRITICAL_BACKUP_RPO_MS = 15 * 60 * 1000;

/** How many recent critical directories to inspect for coverage. */
const MAX_CANDIDATES = 12;

export type CriticalBackupCoverageReason =
	| 'covered'
	| 'no_candidate'
	| 'expired'
	| 'structural_drift'
	| 'artifact_invalid'
	| 'efs_failed'
	| 'missing_integrity'
	| 'project_mismatch'
	| 'profile_mismatch';

export interface CriticalBackupCoverage {
	covered: boolean;
	reason: CriticalBackupCoverageReason;
	manifestPath?: string;
	manifest?: CriticalBackupManifest;
	liveIntegrity?: RecoveryIntegritySnapshot;
	ageMs?: number;
	maxAgeMs: number;
	/** True when business-table fingerprints differ but structural coverage holds. */
	businessActivityDetected?: boolean;
	failures?: string[];
}

export interface EvaluateCriticalBackupCoverageInput {
	prodDbUrl: string;
	projectRef?: string;
	backupRoot?: string;
	maxAgeMs?: number;
	nowMs?: number;
	/** Cap candidate scan; defaults to MAX_CANDIDATES. */
	maxCandidates?: number;
	/** When set, evaluate only this manifest (pre-authorize re-check). */
	preferredManifestPath?: string;
	captureIntegrity?: (dbUrl: string) => RecoveryIntegritySnapshot;
	validateManifest?: (manifest: CriticalBackupManifest) => void;
	assertEncrypted?: (paths: string[]) => void;
	listBackups?: (root: string) => RetentionCandidate[];
	readManifest?: (manifestPath: string) => CriticalBackupManifest | null;
}

interface CandidateScanFlags {
	expired: boolean;
	structuralDrift: boolean;
	artifactInvalid: boolean;
	efsFailed: boolean;
	missingIntegrity: boolean;
	projectMismatch: boolean;
	profileMismatch: boolean;
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
	preferredManifestPath?: string,
): Array<{ manifestPath: string; createdAtMs: number; manifest: CriticalBackupManifest }> {
	if (preferredManifestPath) {
		const manifest = readManifest(preferredManifestPath);
		if (!manifest) return [];
		const createdAtMs = Date.parse(manifest.createdAt);
		return [
			{
				manifestPath: preferredManifestPath,
				createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
				manifest,
			},
		];
	}
	if (!existsSync(backupRoot)) return [];
	const dirs = listBackups(backupRoot).slice(0, maxCandidates);
	const loaded: Array<{
		manifestPath: string;
		createdAtMs: number;
		manifest: CriticalBackupManifest;
	}> = [];
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

function migrationHistoryMatches(
	stored: RecoveryIntegritySnapshot,
	live: RecoveryIntegritySnapshot,
): boolean {
	if (stored.migrationSha256 !== live.migrationSha256) return false;
	if (stored.migrationCount !== live.migrationCount) return false;
	const storedVersions = stored.migrationVersions ?? [];
	const liveVersions = live.migrationVersions ?? [];
	if (storedVersions.length !== liveVersions.length) return false;
	return storedVersions.every((version, index) => version === liveVersions[index]);
}

function businessTablesDiffer(
	stored: RecoveryIntegritySnapshot,
	live: RecoveryIntegritySnapshot,
): boolean {
	if (stored.businessStateSha256 !== live.businessStateSha256) return true;
	const keys = new Set([...Object.keys(stored.tables), ...Object.keys(live.tables)]);
	for (const key of keys) {
		const left = stored.tables[key];
		const right = live.tables[key];
		if (!left || !right) return true;
		if (left.rowCount !== right.rowCount || left.sha256 !== right.sha256) return true;
	}
	return false;
}

function reasonFromFlags(flags: CandidateScanFlags): CriticalBackupCoverageReason {
	if (flags.structuralDrift) return 'structural_drift';
	if (flags.expired) return 'expired';
	if (flags.profileMismatch) return 'profile_mismatch';
	if (flags.artifactInvalid) return 'artifact_invalid';
	if (flags.efsFailed) return 'efs_failed';
	if (flags.missingIntegrity) return 'missing_integrity';
	if (flags.projectMismatch) return 'project_mismatch';
	return 'no_candidate';
}

function failuresForReason(
	reason: CriticalBackupCoverageReason,
	maxAgeMs: number,
): string[] | undefined {
	if (reason === 'structural_drift') {
		return [
			'El historial o perfil de migraciones ya no coincide con el respaldo crítico reciente.',
		];
	}
	if (reason === 'expired') {
		return [
			`Ningún respaldo crítico reciente está dentro del RPO máximo (${formatBackupAge(maxAgeMs)}).`,
		];
	}
	return undefined;
}

export function formatBackupAge(ageMs: number): string {
	const minutes = Math.max(0, Math.floor(ageMs / 60_000));
	if (minutes < 1) return '<1 min';
	if (minutes === 1) return '1 min';
	return `${minutes} min`;
}

function evaluateCandidateCoverage(input: {
	candidate: { manifestPath: string; createdAtMs: number; manifest: CriticalBackupManifest };
	projectRef: string;
	liveIntegrity: RecoveryIntegritySnapshot;
	nowMs: number;
	maxAgeMs: number;
	validateManifest: (manifest: CriticalBackupManifest) => void;
	assertEncrypted: (paths: string[]) => void;
	flags: CandidateScanFlags;
}): CriticalBackupCoverage | null {
	const { candidate, projectRef, liveIntegrity, nowMs, maxAgeMs, flags } = input;
	const manifest = candidate.manifest;
	if (!isProductionManifest(manifest, projectRef)) {
		flags.projectMismatch = true;
		return null;
	}
	if (!manifest.integrity) {
		flags.missingIntegrity = true;
		return null;
	}
	if (
		!artifactsAndEfsOk(
			manifest,
			candidate.manifestPath,
			input.validateManifest,
			input.assertEncrypted,
			flags,
		)
	) {
		return null;
	}

	const storedProfile = manifest.integrity.profile ?? 'phase3';
	const liveProfile = liveIntegrity.profile ?? 'phase3';
	if (storedProfile !== liveProfile) {
		flags.profileMismatch = true;
		return null;
	}

	const ageMs = Math.max(0, nowMs - candidate.createdAtMs);
	if (ageMs > maxAgeMs) {
		flags.expired = true;
		return null;
	}

	if (!migrationHistoryMatches(manifest.integrity, liveIntegrity)) {
		flags.structuralDrift = true;
		return null;
	}

	return {
		covered: true,
		reason: 'covered',
		manifestPath: candidate.manifestPath,
		manifest,
		liveIntegrity,
		ageMs,
		maxAgeMs,
		businessActivityDetected: businessTablesDiffer(manifest.integrity, liveIntegrity),
	};
}

/**
 * Decide whether an existing verified critical backup still covers Production for migrate.
 * Business-row drift inside the RPO does not invalidate coverage.
 */
export function evaluateCriticalBackupCoverage(
	input: EvaluateCriticalBackupCoverageInput,
): CriticalBackupCoverage {
	const projectRef = input.projectRef ?? SUPABASE_PROJECT_REFS.production;
	const backupRoot = resolve(input.backupRoot ?? DEFAULT_CRITICAL_BACKUP_ROOT);
	const maxAgeMs = input.maxAgeMs ?? CRITICAL_BACKUP_RPO_MS;
	const nowMs = input.nowMs ?? Date.now();
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
		input.preferredManifestPath,
	);
	if (candidates.length === 0) {
		return { covered: false, reason: 'no_candidate', maxAgeMs };
	}

	let liveIntegrity: RecoveryIntegritySnapshot;
	try {
		liveIntegrity = captureIntegrity(input.prodDbUrl);
	} catch (error: unknown) {
		return {
			covered: false,
			reason: 'structural_drift',
			maxAgeMs,
			failures: [
				error instanceof Error
					? error.message
					: 'No se pudo capturar la integridad viva de Production.',
			],
		};
	}

	const flags: CandidateScanFlags = {
		expired: false,
		structuralDrift: false,
		artifactInvalid: false,
		efsFailed: false,
		missingIntegrity: false,
		projectMismatch: false,
		profileMismatch: false,
	};

	for (const candidate of candidates) {
		const covered = evaluateCandidateCoverage({
			candidate,
			projectRef,
			liveIntegrity,
			nowMs,
			maxAgeMs,
			validateManifest,
			assertEncrypted,
			flags,
		});
		if (covered) return covered;
	}

	const reason = reasonFromFlags(flags);
	return {
		covered: false,
		reason,
		liveIntegrity,
		maxAgeMs,
		failures: failuresForReason(reason, maxAgeMs),
	};
}

/** @deprecated Prefer evaluateCriticalBackupCoverage — kept as a thin alias for transitional imports. */
export function evaluateCriticalBackupReuse(
	input: EvaluateCriticalBackupCoverageInput,
): CriticalBackupCoverage & { reusable: boolean } {
	const coverage = evaluateCriticalBackupCoverage(input);
	return { ...coverage, reusable: coverage.covered };
}

/**
 * Structural pre-authorize coverage check for a previously selected backup.
 * Does not require exact business-table equality.
 */
export function assertCriticalBackupStructuralCoverage(input: {
	prodDbUrl: string;
	manifestPath: string;
	maxAgeMs?: number;
	nowMs?: number;
	captureIntegrity?: (dbUrl: string) => RecoveryIntegritySnapshot;
	validateManifest?: (manifest: CriticalBackupManifest) => void;
	assertEncrypted?: (paths: string[]) => void;
	readManifest?: (manifestPath: string) => CriticalBackupManifest | null;
}): CriticalBackupCoverage {
	return evaluateCriticalBackupCoverage({
		prodDbUrl: input.prodDbUrl,
		preferredManifestPath: input.manifestPath,
		maxAgeMs: input.maxAgeMs,
		nowMs: input.nowMs,
		captureIntegrity: input.captureIntegrity,
		validateManifest: input.validateManifest,
		assertEncrypted: input.assertEncrypted,
		readManifest: input.readManifest,
		listBackups: () => [],
	});
}
