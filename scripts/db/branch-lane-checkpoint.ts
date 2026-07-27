/**
 * branch-lane-checkpoint.ts — Partial read-only progress for branch-lane.
 *
 * Distinct from clearance:
 *   - Checkpoint = reusable evidence from completed discovery/audits (may still have blockers)
 *   - Clearance  = validated evidence that permits the next authorized write
 *
 * Never stores credentials, connection strings, dumps, or PII.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
	AUDIT_CONTRACT_VERSION,
	type BranchLaneMode,
	type BranchLaneStatus,
	type Finding,
} from './branch-lane-status.ts';
import {
	fingerprintSensitiveFileSet,
	resolveRepoIdentityFingerprint,
	defaultGitIdentityRunner,
	type GitIdentityRunner,
} from './branch-lane-clearance.ts';

export const CHECKPOINT_FILE_RELATIVE = '.agent/tmp/branch-lane-checkpoint.json';

export interface CheckpointCheckResult {
	id: string;
	status: BranchLaneStatus;
	/** Short non-secret summary of what was observed. */
	summary: string;
}

export interface CheckpointDiagnosisSnapshot {
	localDriftClassification?: string;
	gitOnlyPromotionStatus?: BranchLaneStatus;
	backupRequirementSummary?: string;
	laneDirectionSummary?: string;
}

export interface BranchLaneCheckpoint {
	kind: 'checkpoint';
	mode: BranchLaneMode;
	baseSha: string;
	headSha: string;
	workingTreeFingerprint: string;
	sensitiveFileSetFingerprint: string;
	repoIdentityFingerprint: string;
	auditContractVersion: string;
	updatedAt: string;
	completedChecks: CheckpointCheckResult[];
	unresolvedFindings: Finding[];
	diagnosis?: CheckpointDiagnosisSnapshot;
}

export interface CheckpointMatchResult {
	valid: boolean;
	reason: string;
	stored: BranchLaneCheckpoint | null;
	/** Check ids from a valid checkpoint that may be skipped on resume. */
	reusableCheckIds: string[];
}

export function hashStable(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertNoSecrets(serialized: string): void {
	if (/postgres(ql)?:\/\//i.test(serialized) || /password\s*[:=]/i.test(serialized)) {
		throw new Error('Refusing to write checkpoint that appears to contain secrets.');
	}
}

function isCheckpointShape(value: unknown): value is BranchLaneCheckpoint {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return (
		v.kind === 'checkpoint' &&
		typeof v.mode === 'string' &&
		typeof v.baseSha === 'string' &&
		typeof v.headSha === 'string' &&
		typeof v.workingTreeFingerprint === 'string' &&
		typeof v.sensitiveFileSetFingerprint === 'string' &&
		typeof v.repoIdentityFingerprint === 'string' &&
		typeof v.auditContractVersion === 'string' &&
		typeof v.updatedAt === 'string' &&
		Array.isArray(v.completedChecks) &&
		Array.isArray(v.unresolvedFindings)
	);
}

export function buildCheckpoint(input: {
	mode: BranchLaneMode;
	baseSha: string;
	headSha: string;
	workingTreeFingerprint: string;
	sensitiveFiles: readonly string[];
	repoIdentityFingerprint: string;
	completedChecks: CheckpointCheckResult[];
	unresolvedFindings: Finding[];
	diagnosis?: CheckpointDiagnosisSnapshot;
	now?: Date;
}): BranchLaneCheckpoint {
	return {
		kind: 'checkpoint',
		mode: input.mode,
		baseSha: input.baseSha,
		headSha: input.headSha,
		workingTreeFingerprint: input.workingTreeFingerprint,
		sensitiveFileSetFingerprint: fingerprintSensitiveFileSet(input.sensitiveFiles),
		repoIdentityFingerprint: input.repoIdentityFingerprint,
		auditContractVersion: AUDIT_CONTRACT_VERSION,
		updatedAt: (input.now ?? new Date()).toISOString(),
		completedChecks: input.completedChecks,
		unresolvedFindings: input.unresolvedFindings,
		diagnosis: input.diagnosis,
	};
}

export function compareCheckpointFingerprint(
	stored: BranchLaneCheckpoint | null,
	current: {
		mode: BranchLaneMode;
		baseSha: string;
		headSha: string;
		workingTreeFingerprint: string;
		sensitiveFileSetFingerprint: string;
		repoIdentityFingerprint: string;
		auditContractVersion: string;
	},
): CheckpointMatchResult {
	if (!stored) {
		return {
			valid: false,
			reason: 'No stored checkpoint.',
			stored: null,
			reusableCheckIds: [],
		};
	}
	if (stored.auditContractVersion !== current.auditContractVersion) {
		return {
			valid: false,
			reason: 'Audit contract version changed; checkpoint invalidated.',
			stored,
			reusableCheckIds: [],
		};
	}
	if (stored.repoIdentityFingerprint !== current.repoIdentityFingerprint) {
		return {
			valid: false,
			reason: 'Repository/worktree identity changed; checkpoint invalidated.',
			stored,
			reusableCheckIds: [],
		};
	}
	if (stored.mode !== current.mode) {
		return {
			valid: false,
			reason: 'Operation mode changed; checkpoint invalidated.',
			stored,
			reusableCheckIds: [],
		};
	}
	if (stored.baseSha !== current.baseSha || stored.headSha !== current.headSha) {
		return {
			valid: false,
			reason: 'Base/head SHA changed; checkpoint invalidated.',
			stored,
			reusableCheckIds: [],
		};
	}
	if (stored.workingTreeFingerprint !== current.workingTreeFingerprint) {
		return {
			valid: false,
			reason: 'Working-tree fingerprint changed; checkpoint invalidated.',
			stored,
			reusableCheckIds: [],
		};
	}
	if (stored.sensitiveFileSetFingerprint !== current.sensitiveFileSetFingerprint) {
		return {
			valid: false,
			reason: 'Database-sensitive file-set fingerprint changed; checkpoint invalidated.',
			stored,
			reusableCheckIds: [],
		};
	}
	return {
		valid: true,
		reason: 'Checkpoint fingerprint matches current state.',
		stored,
		reusableCheckIds: stored.completedChecks.map((c) => c.id),
	};
}

export function checkpointFilePath(projectRoot = process.cwd()): string {
	return resolve(projectRoot, CHECKPOINT_FILE_RELATIVE);
}

export function readCheckpoint(projectRoot = process.cwd()): BranchLaneCheckpoint | null {
	const path = checkpointFilePath(projectRoot);
	if (!existsSync(path)) return null;
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
		if (!isCheckpointShape(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function writeCheckpoint(
	checkpoint: BranchLaneCheckpoint,
	projectRoot = process.cwd(),
): string {
	if (!isCheckpointShape(checkpoint)) {
		throw new Error('Refusing to write malformed checkpoint.');
	}
	const serialized = `${JSON.stringify(checkpoint, null, 2)}\n`;
	assertNoSecrets(serialized);

	const path = checkpointFilePath(projectRoot);
	const dir = dirname(path);
	mkdirSync(dir, { recursive: true });
	const tempPath = resolve(
		dir,
		`branch-lane-checkpoint.${process.pid}.${randomBytes(6).toString('hex')}.tmp`,
	);
	try {
		writeFileSync(tempPath, serialized, 'utf8');
		renameSync(tempPath, path);
	} catch (err) {
		if (existsSync(tempPath)) {
			try {
				unlinkSync(tempPath);
			} catch {
				// ignore cleanup failure
			}
		}
		throw err;
	}
	return path;
}

export function clearCheckpoint(projectRoot = process.cwd()): void {
	const path = checkpointFilePath(projectRoot);
	if (existsSync(path)) {
		unlinkSync(path);
	}
}

export function evaluateResumeCheckpoint(input: {
	mode: BranchLaneMode;
	baseSha: string;
	headSha: string;
	workingTreeFingerprint: string;
	sensitiveFiles: readonly string[];
	projectRoot?: string;
	repoIdentityFingerprint?: string;
	git?: GitIdentityRunner;
}): CheckpointMatchResult {
	const projectRoot = input.projectRoot ?? process.cwd();
	const repoIdentityFingerprint =
		input.repoIdentityFingerprint ??
		resolveRepoIdentityFingerprint(projectRoot, input.git ?? defaultGitIdentityRunner);
	const stored = readCheckpoint(projectRoot);
	return compareCheckpointFingerprint(stored, {
		mode: input.mode,
		baseSha: input.baseSha,
		headSha: input.headSha,
		workingTreeFingerprint: input.workingTreeFingerprint,
		sensitiveFileSetFingerprint: fingerprintSensitiveFileSet(input.sensitiveFiles),
		auditContractVersion: AUDIT_CONTRACT_VERSION,
		repoIdentityFingerprint,
	});
}

/** Merge new check results into an existing checkpoint (same fingerprint assumed). */
export function mergeCheckpointProgress(
	base: BranchLaneCheckpoint,
	updates: {
		completedChecks?: CheckpointCheckResult[];
		unresolvedFindings?: Finding[];
		diagnosis?: CheckpointDiagnosisSnapshot;
		now?: Date;
	},
): BranchLaneCheckpoint {
	const byId = new Map(base.completedChecks.map((c) => [c.id, c]));
	for (const check of updates.completedChecks ?? []) {
		byId.set(check.id, check);
	}
	return {
		...base,
		completedChecks: [...byId.values()],
		unresolvedFindings: updates.unresolvedFindings ?? base.unresolvedFindings,
		diagnosis: updates.diagnosis ? { ...base.diagnosis, ...updates.diagnosis } : base.diagnosis,
		updatedAt: (updates.now ?? new Date()).toISOString(),
	};
}

/** Stable id helper for tests / callers that need a non-git repo identity. */
export function syntheticRepoIdentity(label: string): string {
	return hashStable(`synthetic:${label}`);
}
