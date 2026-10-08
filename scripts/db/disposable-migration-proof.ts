/**
 * Disposable migration proof receipt.
 *
 * Full disposable applies write a receipt bound to the ordered migration file digests, the exact
 * disposable container instance, and that container's live migration history. The receipt lives in
 * the common Git directory because every worktree shares the same disposable container.
 *
 * Local / Preview / Production schema actions require a current receipt that still matches the live
 * container before authorization, backup, or write. Anything unverifiable fails closed.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { gitCommonPath } from '../shared/git-paths.ts';
import { getValidatedMigrationFiles } from './apply-migrations.ts';
import { DISPOSABLE_DB_URL, DISPOSABLE_TEST } from './db-target-config.ts';
import { runCommand, runPsql } from './db-workflow-lib.ts';
import { computeMigrationFileDigests, computeMigrationSetDigest } from './migration-sql-risk.ts';
import { readGitWorktreeState } from './release-check.ts';

export const DISPOSABLE_MIGRATION_PROOF_COMMON_RELATIVE =
	'db-evidence/disposable-migration-proof.json';

/**
 * v3: per-file digests are line-ending normalized (see `normalizeSqlForDigest`). v2 receipts
 * hashed one worktree's checkout bytes, so they are treated as missing rather than compared.
 */
export const DISPOSABLE_MIGRATION_PROOF_VERSION = 3;

const DISPOSABLE_APPLY_COMMAND = 'pnpm db:migrate -- --target disposable-test --apply';

export interface DisposableContainerIdentity {
	name: string;
	id: string;
	createdAt: string;
}

export interface DisposableMigrationProof {
	version: typeof DISPOSABLE_MIGRATION_PROOF_VERSION;
	createdAt: string;
	sourceHead: string | null;
	migrationSetDigest: string;
	/** Content digest per migration version at proof time. */
	migrationDigests: Record<string, string>;
	/** Versions read from the container's live schema_migrations after the apply. */
	appliedVersions: string[];
	target: 'disposable-test';
	maxVersion: string | null;
	container: DisposableContainerIdentity;
}

/** Live disposable state; `error` is set whenever the container or its history is unreadable. */
export interface DisposableLiveState {
	container: DisposableContainerIdentity | null;
	appliedVersions: string[] | null;
	error?: string;
}

export interface DisposableProofValidation {
	ok: boolean;
	reason: string;
	proof: DisposableMigrationProof | null;
	expectedDigest: string;
}

export interface DisposableProofOptions {
	/** Receipt location override (tests). Defaults to the common Git directory. */
	path?: string;
	/** Live state reader override (tests). Defaults to docker inspect + psql. */
	readLive?: () => DisposableLiveState;
}

function proofPath(options: DisposableProofOptions = {}): string {
	return options.path ?? gitCommonPath(DISPOSABLE_MIGRATION_PROOF_COMMON_RELATIVE);
}

const migrationSetDigestCache = new Map<
	string,
	{
		digest: string;
		versions: string[];
		files: { version: string; filename: string }[];
		fileDigests: Record<string, string>;
	}
>();

export function computeCurrentMigrationSetDigest(maxVersion?: string): {
	digest: string;
	versions: string[];
	files: { version: string; filename: string }[];
	fileDigests: Record<string, string>;
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
		fileDigests: computeMigrationFileDigests(files),
	};
	migrationSetDigestCache.set(cacheKey, computed);
	return computed;
}

let liveStateCache: DisposableLiveState | null = null;

/** Drop the memoized live state and cached migration set digests. */
export function resetDisposableLiveStateCache(): void {
	liveStateCache = null;
	migrationSetDigestCache.clear();
}

/** Read the disposable container identity and live migration history once per process. */
export function readDisposableLiveState(): DisposableLiveState {
	if (liveStateCache) return liveStateCache;
	const inspect = runCommand(
		'docker',
		['inspect', '--format', '{{.Id}} {{.Created}}', DISPOSABLE_TEST.containerName],
		{ throwOnError: false },
	);
	const [id, createdAt] = inspect.stdout.trim().split(/\s+/);
	if (inspect.status !== 0 || !id || !createdAt) {
		liveStateCache = {
			container: null,
			appliedVersions: null,
			error: `Disposable container ${DISPOSABLE_TEST.containerName} is not available. Start it with: pnpm db:disposable:start`,
		};
		return liveStateCache;
	}
	const container = { name: DISPOSABLE_TEST.containerName, id, createdAt };
	const history = runPsql(
		'select version from supabase_migrations.schema_migrations order by version',
		DISPOSABLE_DB_URL,
		{ tuplesOnly: true, throwOnError: false },
	);
	if (history.status !== 0) {
		liveStateCache = {
			container,
			appliedVersions: null,
			error: `Unable to read the disposable migration history: ${(history.stderr || history.stdout).trim()}`,
		};
		return liveStateCache;
	}
	liveStateCache = {
		container,
		appliedVersions: history.stdout
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean),
	};
	return liveStateCache;
}

/** Versions recorded on the shared container that this checkout's migration set does not contain. */
export function foreignAppliedVersions(
	appliedVersions: readonly string[],
	fileVersions: readonly string[],
): string[] {
	const known = new Set(fileVersions);
	return appliedVersions.filter((version) => !known.has(version));
}

function foreignVersionsReason(foreign: readonly string[]): string {
	return (
		`The shared disposable database contains migrations absent from this checkout (${foreign.join(', ')}), ` +
		'likely applied from another worktree. Reset it before re-applying: pnpm db:disposable:reset'
	);
}

function sameVersions(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((version, index) => version === right[index]);
}

/**
 * Versions whose migration file changed after it was applied on the disposable container.
 * Re-applying cannot re-run them, so only a disposable reset restores a trustworthy reference.
 */
export function findEditedAppliedMigrations(
	previousDigests: Record<string, string>,
	currentDigests: Record<string, string>,
	appliedVersions: readonly string[],
): string[] {
	return appliedVersions.filter(
		(version) =>
			previousDigests[version] !== undefined &&
			currentDigests[version] !== undefined &&
			previousDigests[version] !== currentDigests[version],
	);
}

export function readDisposableMigrationProof(
	options: DisposableProofOptions = {},
): DisposableMigrationProof | null {
	const path = proofPath(options);
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as DisposableMigrationProof;
		if (parsed?.version !== DISPOSABLE_MIGRATION_PROOF_VERSION) return null;
		if (typeof parsed.migrationSetDigest !== 'string') return null;
		if (!Array.isArray(parsed.appliedVersions)) return null;
		if (!parsed.migrationDigests || typeof parsed.migrationDigests !== 'object') return null;
		if (typeof parsed.container?.id !== 'string') return null;
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Retire the receipt after the disposable history was dropped. A reset re-applies every
 * migration, so the previous digests no longer describe what the container ran; keeping them
 * would block the re-apply with a stale "edited in place" finding. The last retired receipt is
 * kept next to the live one for diagnosis.
 */
export function invalidateDisposableMigrationProof(
	options: Pick<DisposableProofOptions, 'path'> = {},
): boolean {
	const path = proofPath(options);
	resetDisposableLiveStateCache();
	if (!existsSync(path)) return false;
	renameSync(path, `${path}.superseded`);
	return true;
}

export function writeDisposableMigrationProof(
	options: {
		appliedVersions: readonly string[];
		maxVersion?: string | null;
	} & DisposableProofOptions,
): DisposableMigrationProof {
	resetDisposableLiveStateCache();
	const live = (options.readLive ?? readDisposableLiveState)();
	if (!live.container) {
		throw new Error(live.error ?? 'Disposable container identity is unavailable.');
	}
	const { digest, fileDigests, versions } = computeCurrentMigrationSetDigest(
		options.maxVersion ?? undefined,
	);
	const foreign = foreignAppliedVersions(options.appliedVersions, versions);
	if (foreign.length > 0) {
		throw new Error(foreignVersionsReason(foreign));
	}
	const previous = readDisposableMigrationProof(options);
	if (previous && previous.container.id === live.container.id) {
		const edited = findEditedAppliedMigrations(
			previous.migrationDigests,
			fileDigests,
			options.appliedVersions,
		);
		if (edited.length > 0) {
			throw new Error(
				`Applied migrations were edited in place (${edited.join(', ')}). ` +
					'Reset the disposable database and re-apply: pnpm db:disposable:reset',
			);
		}
	}
	const worktree = readGitWorktreeState();
	const proof: DisposableMigrationProof = {
		version: DISPOSABLE_MIGRATION_PROOF_VERSION,
		createdAt: new Date().toISOString(),
		sourceHead: worktree.sha,
		migrationSetDigest: digest,
		migrationDigests: fileDigests,
		appliedVersions: [...options.appliedVersions],
		target: 'disposable-test',
		maxVersion: options.maxVersion ?? null,
		container: live.container,
	};

	const path = proofPath(options);
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

function invalid(
	reason: string,
	proof: DisposableMigrationProof | null,
	expectedDigest: string,
): DisposableProofValidation {
	return { ok: false, reason, proof, expectedDigest };
}

/**
 * Validate that a full (non-cutoff) disposable proof matches the current migration set and the
 * live disposable container. Cutoff/baseline proofs never authorize Local/Hosted schema actions.
 */
export function assertCurrentDisposableMigrationProof(
	options: DisposableProofOptions = {},
): DisposableProofValidation {
	const { digest, fileDigests, versions } = computeCurrentMigrationSetDigest();
	const proof = readDisposableMigrationProof(options);
	if (!proof) {
		return invalid(
			'Missing disposable migration proof. Apply the full migration set on disposable-test first: ' +
				DISPOSABLE_APPLY_COMMAND,
			null,
			digest,
		);
	}
	if (proof.maxVersion) {
		return invalid(
			'Disposable proof was produced by a baseline/max-version cutoff apply and cannot authorize Local/Hosted schema actions. ' +
				'Re-run a full disposable apply without --max-version.',
			proof,
			digest,
		);
	}
	const live = (options.readLive ?? readDisposableLiveState)();
	if (!live.container || !live.appliedVersions) {
		return invalid(
			`Disposable proof cannot be verified against the live container. ${live.error ?? ''}`.trim(),
			proof,
			digest,
		);
	}
	if (live.container.id !== proof.container.id) {
		return invalid(
			'Disposable proof belongs to a different disposable container instance. ' +
				`Re-apply on disposable-test: ${DISPOSABLE_APPLY_COMMAND}`,
			proof,
			digest,
		);
	}
	const foreign = foreignAppliedVersions(live.appliedVersions, versions);
	if (foreign.length > 0) {
		return invalid(foreignVersionsReason(foreign), proof, digest);
	}
	const edited = findEditedAppliedMigrations(
		proof.migrationDigests,
		fileDigests,
		live.appliedVersions,
	);
	if (edited.length > 0) {
		return invalid(
			`Applied migrations were edited in place (${edited.join(', ')}). ` +
				'Reset the disposable database and re-apply: pnpm db:disposable:reset',
			proof,
			digest,
		);
	}
	if (proof.migrationSetDigest !== digest) {
		return invalid(
			'Disposable migration proof is stale relative to the current migration file set. ' +
				`Re-apply on disposable-test: ${DISPOSABLE_APPLY_COMMAND}`,
			proof,
			digest,
		);
	}
	if (!sameVersions(live.appliedVersions, proof.appliedVersions)) {
		return invalid(
			'Live disposable migration history no longer matches the proof. ' +
				`Re-apply on disposable-test: ${DISPOSABLE_APPLY_COMMAND}`,
			proof,
			digest,
		);
	}
	return {
		ok: true,
		reason: 'Disposable migration proof matches the current migration set and live container.',
		proof,
		expectedDigest: digest,
	};
}

export function requireCurrentDisposableMigrationProof(
	failFn: (message: string) => never,
	options: DisposableProofOptions = {},
): DisposableMigrationProof {
	const result = assertCurrentDisposableMigrationProof(options);
	if (!result.ok) {
		failFn(`Disposable migration proof required:\n- ${result.reason}`);
	}
	return result.proof!;
}
