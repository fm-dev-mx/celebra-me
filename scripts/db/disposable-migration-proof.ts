/**
 * Disposable migration proof receipt.
 *
 * Full disposable applies write a receipt bound to ordered migration file digests.
 * Local / Preview / Production schema actions require a current matching receipt
 * before authorization, backup, or write.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getValidatedMigrationFiles } from './apply-migrations.ts';
import { computeMigrationSetDigest } from './migration-sql-risk.ts';
import { readGitWorktreeState } from './release-check.ts';

export const DISPOSABLE_MIGRATION_PROOF_RELATIVE = '.agent/tmp/disposable-migration-proof.json';

export const DISPOSABLE_MIGRATION_PROOF_VERSION = 1;

export interface DisposableMigrationProof {
	version: typeof DISPOSABLE_MIGRATION_PROOF_VERSION;
	createdAt: string;
	sourceHead: string | null;
	migrationSetDigest: string;
	appliedVersions: string[];
	target: 'disposable-test';
	maxVersion: string | null;
}

export interface DisposableProofValidation {
	ok: boolean;
	reason: string;
	proof: DisposableMigrationProof | null;
	expectedDigest: string;
}

function proofPath(cwd: string = process.cwd()): string {
	return resolve(cwd, DISPOSABLE_MIGRATION_PROOF_RELATIVE);
}

const migrationSetDigestCache = new Map<
	string,
	{
		digest: string;
		versions: string[];
		files: { version: string; filename: string }[];
	}
>();

export function computeCurrentMigrationSetDigest(maxVersion?: string): {
	digest: string;
	versions: string[];
	files: { version: string; filename: string }[];
} {
	const cacheKey = maxVersion ?? '';
	const cached = migrationSetDigestCache.get(cacheKey);
	if (cached) return cached;
	const files = getValidatedMigrationFiles(maxVersion).map((f) => ({
		version: f.version,
		filename: f.filename,
	}));
	const computed = {
		digest: computeMigrationSetDigest(files),
		versions: files.map((f) => f.version),
		files,
	};
	migrationSetDigestCache.set(cacheKey, computed);
	return computed;
}

export function readDisposableMigrationProof(
	cwd: string = process.cwd(),
): DisposableMigrationProof | null {
	const path = proofPath(cwd);
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as DisposableMigrationProof;
		if (parsed?.version !== DISPOSABLE_MIGRATION_PROOF_VERSION) return null;
		if (typeof parsed.migrationSetDigest !== 'string') return null;
		if (!Array.isArray(parsed.appliedVersions)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function writeDisposableMigrationProof(options: {
	appliedVersions: readonly string[];
	maxVersion?: string | null;
	cwd?: string;
}): DisposableMigrationProof {
	const cwd = options.cwd ?? process.cwd();
	const { digest, versions } = computeCurrentMigrationSetDigest(options.maxVersion ?? undefined);
	const worktree = readGitWorktreeState();
	const proof: DisposableMigrationProof = {
		version: DISPOSABLE_MIGRATION_PROOF_VERSION,
		createdAt: new Date().toISOString(),
		sourceHead: worktree.sha,
		migrationSetDigest: digest,
		appliedVersions: [...versions],
		target: 'disposable-test',
		maxVersion: options.maxVersion ?? null,
	};

	const path = proofPath(cwd);
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
	try {
		renameSync(tmp, path);
	} catch {
		try {
			unlinkSync(tmp);
		} catch {
			/* ignore */
		}
		throw new Error(`Failed to write disposable migration proof at ${path}`);
	}
	return proof;
}

/**
 * Validate that a full (non-cutoff) disposable proof matches the current migration set.
 * Cutoff/baseline proofs never authorize Local/Hosted schema actions.
 */
export function assertCurrentDisposableMigrationProof(
	cwd: string = process.cwd(),
): DisposableProofValidation {
	const { digest } = computeCurrentMigrationSetDigest();
	const proof = readDisposableMigrationProof(cwd);
	if (!proof) {
		return {
			ok: false,
			reason:
				'Missing disposable migration proof. Apply the full migration set on disposable-test first: ' +
				'pnpm db:migrate -- --target disposable-test --apply',
			proof: null,
			expectedDigest: digest,
		};
	}
	if (proof.maxVersion) {
		return {
			ok: false,
			reason:
				'Disposable proof was produced by a baseline/max-version cutoff apply and cannot authorize Local/Hosted schema actions. ' +
				'Re-run a full disposable apply without --max-version.',
			proof,
			expectedDigest: digest,
		};
	}
	if (proof.migrationSetDigest !== digest) {
		return {
			ok: false,
			reason:
				'Disposable migration proof is stale relative to the current migration file set. ' +
				'Re-apply on disposable-test: pnpm db:migrate -- --target disposable-test --apply',
			proof,
			expectedDigest: digest,
		};
	}
	return {
		ok: true,
		reason: 'Disposable migration proof matches the current migration set.',
		proof,
		expectedDigest: digest,
	};
}

export function requireCurrentDisposableMigrationProof(
	failFn: (message: string) => never,
	cwd: string = process.cwd(),
): DisposableMigrationProof {
	const result = assertCurrentDisposableMigrationProof(cwd);
	if (!result.ok) {
		failFn(`Disposable migration proof required:\n- ${result.reason}`);
	}
	return result.proof!;
}
