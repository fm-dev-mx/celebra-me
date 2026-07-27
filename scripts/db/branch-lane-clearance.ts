/**
 * branch-lane-clearance.ts — Resumable clearance fingerprint for branch-lane.
 *
 * Stores temporary evidence under .agent/tmp/ (gitignored). Never stores credentials
 * or personal data. Stale fingerprints invalidate automatically; staleness alone is
 * not a user-facing failure — re-run affected checks.
 *
 * Writes are atomic (temp file + rename). Fingerprints bind to repository identity
 * (toplevel + git common dir) so clearance cannot be reused across unrelated
 * repositories or worktrees.
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
import { spawnSync } from 'node:child_process';
import {
	AUDIT_CONTRACT_VERSION,
	type BranchLaneMode,
	type BranchLaneStatus,
} from './branch-lane-status.ts';

export const CLEARANCE_FILE_RELATIVE = '.agent/tmp/branch-lane-clearance.json';

export interface ClearanceFingerprint {
	mode: BranchLaneMode;
	baseSha: string;
	headSha: string;
	workingTreeFingerprint: string;
	sensitiveFileSetFingerprint: string;
	auditContractVersion: string;
	clearanceStatus: BranchLaneStatus;
	updatedAt: string;
	/** Binds clearance to a specific repo + worktree; never a credential. */
	repoIdentityFingerprint: string;
	/** Optional completed step ids that may be skipped on valid resume. */
	completedSteps?: string[];
}

export interface ClearanceMatchResult {
	valid: boolean;
	reason: string;
	stored: ClearanceFingerprint | null;
}

export type GitIdentityRunner = (
	args: string[],
	cwd: string,
) => {
	status: number;
	stdout: string;
	stderr: string;
};

export function hashStable(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function fingerprintWorkingTree(statusShortOutput: string): string {
	return hashStable(statusShortOutput.replaceAll('\r\n', '\n').trim());
}

export function fingerprintSensitiveFileSet(files: readonly string[]): string {
	return hashStable(
		[...files]
			.map((f) => f.replaceAll('\\', '/'))
			.sort()
			.join('\n'),
	);
}

export function defaultGitIdentityRunner(
	args: string[],
	cwd: string,
): { status: number; stdout: string; stderr: string } {
	const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
	if (result.error) {
		throw result.error;
	}
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
	};
}

/**
 * Stable non-secret identity for the current repository/worktree.
 * Uses absolute toplevel + git common dir so sibling worktrees do not share clearance.
 */
export function resolveRepoIdentityFingerprint(
	projectRoot = process.cwd(),
	git: GitIdentityRunner = defaultGitIdentityRunner,
): string {
	const toplevel = git(['rev-parse', '--show-toplevel'], projectRoot);
	const commonDir = git(['rev-parse', '--git-common-dir'], projectRoot);
	if (toplevel.status !== 0 || commonDir.status !== 0) {
		// Fail closed: unique per-call salt so a broken git identity never matches stored clearance.
		return hashStable(`unresolved:${projectRoot}:${randomBytes(16).toString('hex')}`);
	}
	const top = resolve(toplevel.stdout.trim());
	let common = commonDir.stdout.trim().replaceAll('\\', '/');
	if (!common.startsWith('/') && !/^[A-Za-z]:\//.test(common)) {
		common = resolve(projectRoot, common).replaceAll('\\', '/');
	} else {
		common = resolve(common).replaceAll('\\', '/');
	}
	return hashStable(`${top.replaceAll('\\', '/')}::${common}`);
}

export function buildClearanceFingerprint(input: {
	mode: BranchLaneMode;
	baseSha: string;
	headSha: string;
	workingTreeFingerprint: string;
	sensitiveFiles: readonly string[];
	clearanceStatus: BranchLaneStatus;
	repoIdentityFingerprint: string;
	completedSteps?: string[];
	now?: Date;
}): ClearanceFingerprint {
	return {
		mode: input.mode,
		baseSha: input.baseSha,
		headSha: input.headSha,
		workingTreeFingerprint: input.workingTreeFingerprint,
		sensitiveFileSetFingerprint: fingerprintSensitiveFileSet(input.sensitiveFiles),
		auditContractVersion: AUDIT_CONTRACT_VERSION,
		clearanceStatus: input.clearanceStatus,
		updatedAt: (input.now ?? new Date()).toISOString(),
		repoIdentityFingerprint: input.repoIdentityFingerprint,
		completedSteps: input.completedSteps,
	};
}

function isClearanceShape(value: unknown): value is ClearanceFingerprint {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.mode === 'string' &&
		typeof v.baseSha === 'string' &&
		typeof v.headSha === 'string' &&
		typeof v.workingTreeFingerprint === 'string' &&
		typeof v.sensitiveFileSetFingerprint === 'string' &&
		typeof v.auditContractVersion === 'string' &&
		typeof v.clearanceStatus === 'string' &&
		typeof v.updatedAt === 'string' &&
		typeof v.repoIdentityFingerprint === 'string'
	);
}

export function compareClearanceFingerprint(
	stored: ClearanceFingerprint | null,
	current: Omit<ClearanceFingerprint, 'updatedAt' | 'completedSteps' | 'clearanceStatus'> & {
		clearanceStatus?: BranchLaneStatus;
	},
): ClearanceMatchResult {
	if (!stored) {
		return { valid: false, reason: 'No stored clearance fingerprint.', stored: null };
	}
	if (stored.auditContractVersion !== current.auditContractVersion) {
		return {
			valid: false,
			reason: 'Audit contract version changed; clearance invalidated.',
			stored,
		};
	}
	if (stored.repoIdentityFingerprint !== current.repoIdentityFingerprint) {
		return {
			valid: false,
			reason: 'Repository/worktree identity changed; clearance invalidated.',
			stored,
		};
	}
	if (stored.mode !== current.mode) {
		return { valid: false, reason: 'Operation mode changed; clearance invalidated.', stored };
	}
	if (stored.baseSha !== current.baseSha || stored.headSha !== current.headSha) {
		return {
			valid: false,
			reason: 'Base/head SHA changed; clearance invalidated.',
			stored,
		};
	}
	if (stored.workingTreeFingerprint !== current.workingTreeFingerprint) {
		return {
			valid: false,
			reason: 'Working-tree fingerprint changed; clearance invalidated.',
			stored,
		};
	}
	if (stored.sensitiveFileSetFingerprint !== current.sensitiveFileSetFingerprint) {
		return {
			valid: false,
			reason: 'Database-sensitive file-set fingerprint changed; clearance invalidated.',
			stored,
		};
	}
	return { valid: true, reason: 'Clearance fingerprint matches current state.', stored };
}

export function clearanceFilePath(projectRoot = process.cwd()): string {
	return resolve(projectRoot, CLEARANCE_FILE_RELATIVE);
}

export function readClearanceFingerprint(projectRoot = process.cwd()): ClearanceFingerprint | null {
	const path = clearanceFilePath(projectRoot);
	if (!existsSync(path)) return null;
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
		if (!isClearanceShape(parsed)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function writeClearanceFingerprint(
	fingerprint: ClearanceFingerprint,
	projectRoot = process.cwd(),
): string {
	if (!isClearanceShape(fingerprint)) {
		throw new Error('Refusing to write malformed clearance fingerprint.');
	}
	// Defense in depth: never persist obvious secret material if a caller adds fields later.
	const serialized = `${JSON.stringify(fingerprint, null, 2)}\n`;
	if (/postgres(ql)?:\/\//i.test(serialized) || /password\s*[:=]/i.test(serialized)) {
		throw new Error('Refusing to write clearance fingerprint that appears to contain secrets.');
	}

	const path = clearanceFilePath(projectRoot);
	const dir = dirname(path);
	mkdirSync(dir, { recursive: true });
	const tempPath = resolve(
		dir,
		`branch-lane-clearance.${process.pid}.${randomBytes(6).toString('hex')}.tmp`,
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

export function clearClearanceFingerprint(projectRoot = process.cwd()): void {
	const path = clearanceFilePath(projectRoot);
	if (existsSync(path)) {
		unlinkSync(path);
	}
}

export function evaluateResumeClearance(input: {
	mode: BranchLaneMode;
	baseSha: string;
	headSha: string;
	workingTreeFingerprint: string;
	sensitiveFiles: readonly string[];
	projectRoot?: string;
	repoIdentityFingerprint?: string;
	git?: GitIdentityRunner;
}): ClearanceMatchResult {
	const projectRoot = input.projectRoot ?? process.cwd();
	const repoIdentityFingerprint =
		input.repoIdentityFingerprint ??
		resolveRepoIdentityFingerprint(projectRoot, input.git ?? defaultGitIdentityRunner);
	const stored = readClearanceFingerprint(projectRoot);
	return compareClearanceFingerprint(stored, {
		mode: input.mode,
		baseSha: input.baseSha,
		headSha: input.headSha,
		workingTreeFingerprint: input.workingTreeFingerprint,
		sensitiveFileSetFingerprint: fingerprintSensitiveFileSet(input.sensitiveFiles),
		auditContractVersion: AUDIT_CONTRACT_VERSION,
		repoIdentityFingerprint,
	});
}
