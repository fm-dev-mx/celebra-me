#!/usr/bin/env node

/**
 * Interactive Agent OS Git Safety lifecycle.
 *
 * Commands:
 *   start   — establish a mutable-session baseline (fails if one already exists)
 *   finish  — verify protected state, then clean up on PASS (preserve on FAIL)
 *
 * Authorization remains Task Contract / current-task user authority.
 * Optional `--authorized-operation=` only communicates that authority to the
 * detector for one invocation; it is never persisted and never proves human consent.
 */

import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

export const BASELINE_VERSION = 2;
export const LEGACY_ALLOW_FILE_NAME = 'allow-git-write';
export const BASELINE_FILE_NAME = 'git-safety-baseline.json';

/** @typedef {'stage' | 'unstage' | 'commit' | 'branch-switch'} AuthorizedOperation */

const SUPPORTED_OPERATIONS = new Set(['stage', 'unstage', 'commit', 'branch-switch']);

/**
 * @param {string} [repoRoot]
 */
export function resolvePaths(repoRoot = process.env.CELEBRA_GIT_SAFETY_ROOT || defaultRepoRoot()) {
	const root = resolve(repoRoot);
	const tmpDir = join(root, '.agent', 'tmp');
	return {
		repoRoot: root,
		tmpDir,
		baselineFile: join(tmpDir, BASELINE_FILE_NAME),
		legacyAllowFile: join(tmpDir, LEGACY_ALLOW_FILE_NAME),
	};
}

function defaultRepoRoot() {
	return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/**
 * @param {string} repoRoot
 * @param {string[]} args
 * @param {{ allowFailure?: boolean }} [options]
 */
export function git(repoRoot, args, options = {}) {
	const result = spawnSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8',
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.error) throw result.error;
	const status = result.status ?? 1;
	if (!options.allowFailure && status !== 0) {
		const detail = String(result.stderr || result.stdout || '').trim();
		throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
	}
	return {
		status,
		stdout: String(result.stdout || '').replace(/\r\n/g, '\n').trimEnd(),
		stderr: String(result.stderr || '').replace(/\r\n/g, '\n').trimEnd(),
	};
}

/**
 * @param {string} text
 */
function sha256(text) {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Semantic index fingerprint from `git ls-files --stage` metadata.
 * Uses blob OIDs / modes / paths — never buffers staged binary contents.
 * @param {string} repoRoot
 */
export function indexFingerprint(repoRoot) {
	const { stdout } = git(repoRoot, ['ls-files', '--stage']);
	const lines = stdout
		? stdout
				.split('\n')
				.filter(Boolean)
				.sort((a, b) => a.localeCompare(b))
		: [];
	return {
		fingerprint: sha256(lines.join('\n')),
		entries: lines,
	};
}

/**
 * @param {string} repoRoot
 */
export function captureHeadState(repoRoot) {
	const headResult = git(repoRoot, ['rev-parse', 'HEAD'], { allowFailure: true });
	const head = headResult.status === 0 ? headResult.stdout.trim() || null : null;

	const symbolic = git(repoRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
		allowFailure: true,
	});
	const branch = symbolic.status === 0 ? symbolic.stdout.trim() || null : null;
	const detached = head !== null && branch === null;

	return { head, branch, detached };
}

/**
 * Diagnostic-only fingerprints for repository-global refs.
 * Not used for hard-fail comparison (multi-worktree concurrency).
 * @param {string} repoRoot
 */
export function captureDiagnosticRefs(repoRoot) {
	const heads = git(repoRoot, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'], {
		allowFailure: true,
	});
	const tags = git(repoRoot, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/tags'], {
		allowFailure: true,
	});
	const stash = git(repoRoot, ['rev-parse', '-q', '--verify', 'refs/stash'], {
		allowFailure: true,
	});

	const sortLines = (text) =>
		text
			? text
					.split('\n')
					.filter(Boolean)
					.sort((a, b) => a.localeCompare(b))
					.join('\n')
			: '';

	return {
		localHeadsFingerprint: sha256(sortLines(heads.status === 0 ? heads.stdout : '')),
		tagsFingerprint: sha256(sortLines(tags.status === 0 ? tags.stdout : '')),
		stashFingerprint: sha256(stash.status === 0 ? stash.stdout.trim() : ''),
	};
}

/**
 * @param {string} repoRoot
 */
export function captureProtectedState(repoRoot) {
	const headState = captureHeadState(repoRoot);
	const index = indexFingerprint(repoRoot);
	return {
		...headState,
		indexFingerprint: index.fingerprint,
		indexEntries: index.entries,
		diagnosticRefs: captureDiagnosticRefs(repoRoot),
	};
}

/**
 * @param {string[]} entries
 */
export function indexEntryMap(entries) {
	/** @type {Map<string, string>} */
	const map = new Map();
	for (const line of entries) {
		const tab = line.indexOf('\t');
		if (tab === -1) continue;
		const meta = line.slice(0, tab);
		const path = line.slice(tab + 1);
		map.set(path, meta);
	}
	return map;
}

/**
 * @param {string[]} before
 * @param {string[]} after
 */
export function differingIndexPaths(before, after) {
	const a = indexEntryMap(before);
	const b = indexEntryMap(after);
	const paths = new Set([...a.keys(), ...b.keys()]);
	/** @type {string[]} */
	const changed = [];
	for (const path of paths) {
		if (a.get(path) !== b.get(path)) changed.push(path);
	}
	return changed.sort((x, y) => x.localeCompare(y));
}

/**
 * @param {string} value
 */
function parsePathsOption(value) {
	return value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

/**
 * @param {string[]} argv
 */
export function parseFinishArgs(argv) {
	/** @type {{ operation: AuthorizedOperation | null, paths: string[], branch: string | null }} */
	const result = { operation: null, paths: [], branch: null };

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith('--authorized-operation=')) {
			const value = arg.slice('--authorized-operation='.length);
			if (!SUPPORTED_OPERATIONS.has(value)) {
				throw new Error(
					`Unknown authorized operation "${value}". Supported: ${[...SUPPORTED_OPERATIONS].join(', ')}`,
				);
			}
			result.operation = /** @type {AuthorizedOperation} */ (value);
			continue;
		}
		if (arg === '--authorized-operation') {
			const value = argv[++i];
			if (!value || !SUPPORTED_OPERATIONS.has(value)) {
				throw new Error(
					`Unknown or missing authorized operation. Supported: ${[...SUPPORTED_OPERATIONS].join(', ')}`,
				);
			}
			result.operation = /** @type {AuthorizedOperation} */ (value);
			continue;
		}
		if (arg.startsWith('--paths=')) {
			result.paths = parsePathsOption(arg.slice('--paths='.length));
			continue;
		}
		if (arg === '--paths') {
			const value = argv[++i];
			if (!value) throw new Error('--paths requires a comma-separated path list.');
			result.paths = parsePathsOption(value);
			continue;
		}
		if (arg.startsWith('--branch=')) {
			result.branch = arg.slice('--branch='.length);
			continue;
		}
		if (arg === '--branch') {
			const value = argv[++i];
			if (!value) throw new Error('--branch requires a branch name.');
			result.branch = value;
			continue;
		}
		throw new Error(`Unexpected argument: ${arg}`);
	}

	return result;
}

/**
 * @param {{
 *   head: string | null,
 *   branch: string | null,
 *   detached: boolean,
 *   indexFingerprint: string,
 *   indexEntries: string[],
 *   diagnosticRefs: { localHeadsFingerprint: string, tagsFingerprint: string, stashFingerprint: string },
 * }} baseline
 * @param {ReturnType<typeof captureProtectedState>} current
 * @param {{ operation: AuthorizedOperation | null, paths: string[], branch: string | null }} auth
 */
export function evaluateProtectedDrift(baseline, current, auth) {
	const headChanged = baseline.head !== current.head;
	const branchChanged = baseline.branch !== current.branch;
	const detachedChanged = baseline.detached !== current.detached;
	const indexChanged = baseline.indexFingerprint !== current.indexFingerprint;
	const changedPaths = differingIndexPaths(baseline.indexEntries, current.indexEntries);
	/** @type {string[]} */
	const notes = [];

	if (diagnosticRefsChanged(baseline.diagnosticRefs, current.diagnosticRefs)) {
		notes.push(
			'diagnostic global refs (other heads/tags/stash) changed — reported only; not a hard failure',
		);
	}

	const failures = auth.operation
		? evaluateAuthorizedOperation(auth, {
				baseline,
				current,
				headChanged,
				branchChanged,
				detachedChanged,
				indexChanged,
				changedPaths,
			})
		: evaluateUnauthorizedDrift({
				baseline,
				current,
				headChanged,
				branchChanged,
				detachedChanged,
				indexChanged,
				changedPaths,
			});

	return { failures, notes, headChanged, branchChanged, indexChanged, changedPaths };
}

/**
 * @param {{ localHeadsFingerprint: string, tagsFingerprint: string, stashFingerprint: string }} before
 * @param {{ localHeadsFingerprint: string, tagsFingerprint: string, stashFingerprint: string }} after
 */
function diagnosticRefsChanged(before, after) {
	return (
		before.localHeadsFingerprint !== after.localHeadsFingerprint ||
		before.tagsFingerprint !== after.tagsFingerprint ||
		before.stashFingerprint !== after.stashFingerprint
	);
}

/**
 * @param {{
 *   baseline: { head: string | null, branch: string | null, detached: boolean },
 *   current: { head: string | null, branch: string | null, detached: boolean },
 *   headChanged: boolean,
 *   branchChanged: boolean,
 *   detachedChanged: boolean,
 *   indexChanged: boolean,
 *   changedPaths: string[],
 * }} state
 */
function evaluateUnauthorizedDrift(state) {
	/** @type {string[]} */
	const failures = [];
	if (state.headChanged) {
		failures.push(
			`HEAD changed from ${state.baseline.head ?? '(unborn)'} to ${state.current.head ?? '(unborn)'} without authorization`,
		);
	}
	if (state.branchChanged || state.detachedChanged) {
		failures.push(
			`branch/detached state changed from ${formatBranch(state.baseline)} to ${formatBranch(state.current)} without authorization`,
		);
	}
	if (state.indexChanged) {
		failures.push('index (staged) state changed without authorization');
		if (state.changedPaths.length > 0) {
			failures.push(`changed index paths: ${state.changedPaths.join(', ')}`);
		}
	}
	return failures;
}

/**
 * @param {{ operation: AuthorizedOperation, paths: string[], branch: string | null }} auth
 * @param {{
 *   baseline: { head: string | null, branch: string | null, detached: boolean },
 *   current: { head: string | null, branch: string | null, detached: boolean },
 *   headChanged: boolean,
 *   branchChanged: boolean,
 *   detachedChanged: boolean,
 *   indexChanged: boolean,
 *   changedPaths: string[],
 * }} state
 */
function evaluateAuthorizedOperation(auth, state) {
	/** @type {string[]} */
	const failures = [];
	if (auth.operation === 'stage' || auth.operation === 'unstage') {
		return evaluateStageLikeAuthorization(auth, state);
	}
	if (auth.operation === 'commit') {
		if (auth.paths.length > 0) {
			failures.push('--authorized-operation=commit does not accept --paths');
		}
		if (!state.headChanged) {
			failures.push(
				'authorized commit requires HEAD to change (index-only drift is staging, not commit)',
			);
		}
		if (state.branchChanged || state.detachedChanged) {
			failures.push(
				'authorized commit must not change branch/detached state (adjacent unauthorized drift)',
			);
		}
		return failures;
	}
	if (auth.operation === 'branch-switch') {
		return evaluateBranchSwitchAuthorization(auth, state);
	}
	failures.push(`Unsupported authorized operation: ${auth.operation}`);
	return failures;
}

/**
 * @param {{ operation: AuthorizedOperation, paths: string[] }} auth
 * @param {{
 *   headChanged: boolean,
 *   branchChanged: boolean,
 *   detachedChanged: boolean,
 *   indexChanged: boolean,
 *   changedPaths: string[],
 * }} state
 */
function evaluateStageLikeAuthorization(auth, state) {
	/** @type {string[]} */
	const failures = [];
	if (auth.paths.length === 0) {
		failures.push(`--authorized-operation=${auth.operation} requires --paths`);
		return failures;
	}
	if (state.headChanged || state.branchChanged || state.detachedChanged) {
		failures.push(
			`authorized ${auth.operation} must not change HEAD/branch (adjacent unauthorized drift)`,
		);
	}
	const allowed = new Set(auth.paths);
	const outside = state.changedPaths.filter((path) => !allowed.has(path));
	if (outside.length > 0) {
		failures.push(
			`index paths outside authorized scope for ${auth.operation}: ${outside.join(', ')}`,
		);
	}
	return failures;
}

/**
 * @param {{ branch: string | null, paths: string[] }} auth
 * @param {{
 *   current: { head: string | null, branch: string | null, detached: boolean },
 *   indexChanged: boolean,
 *   changedPaths: string[],
 * }} state
 */
function evaluateBranchSwitchAuthorization(auth, state) {
	/** @type {string[]} */
	const failures = [];
	if (!auth.branch) {
		failures.push('--authorized-operation=branch-switch requires --branch');
		return failures;
	}
	if (auth.paths.length > 0) {
		failures.push('--authorized-operation=branch-switch does not accept --paths');
	}
	if (state.current.branch !== auth.branch) {
		failures.push(
			`authorized branch-switch expected branch "${auth.branch}", current is ${formatBranch(state.current)}`,
		);
	}
	if (state.indexChanged) {
		failures.push(
			'authorized branch-switch must not change index state (adjacent unauthorized drift)',
		);
		if (state.changedPaths.length > 0) {
			failures.push(`changed index paths: ${state.changedPaths.join(', ')}`);
		}
	}
	return failures;
}

/**
 * @param {{ head: string | null, branch: string | null, detached: boolean }} state
 */
function formatBranch(state) {
	if (state.branch) return state.branch;
	if (state.detached) return `detached@${state.head ?? 'unknown'}`;
	return '(unborn)';
}

/**
 * @param {string} filePath
 */
function removeIfExists(filePath) {
	if (existsSync(filePath)) {
		unlinkSync(filePath);
		return true;
	}
	return false;
}

/**
 * @param {ReturnType<typeof resolvePaths>} paths
 */
function retireLegacyAllowMarker(paths) {
	if (removeIfExists(paths.legacyAllowFile)) {
		console.log(
			`  retired obsolete ${LEGACY_ALLOW_FILE_NAME} (not an authorization source)`,
		);
		return true;
	}
	return false;
}

/**
 * @param {ReturnType<typeof resolvePaths>} paths
 * @param {ReturnType<typeof captureProtectedState>} state
 */
export function writeBaseline(paths, state) {
	if (!existsSync(paths.tmpDir)) mkdirSync(paths.tmpDir, { recursive: true });
	const baseline = {
		version: BASELINE_VERSION,
		createdAt: new Date().toISOString(),
		head: state.head,
		branch: state.branch,
		detached: state.detached,
		indexFingerprint: state.indexFingerprint,
		indexEntries: state.indexEntries,
		diagnosticRefs: state.diagnosticRefs,
	};
	writeFileSync(paths.baselineFile, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
	return baseline;
}

/**
 * Classify an on-disk baseline without mutating it.
 * @param {string} baselineFile
 * @returns {{ kind: 'v2' | 'legacy' | 'unreadable', versionLabel: string, detail?: string }}
 */
export function classifyBaselineFile(baselineFile) {
	try {
		const raw = JSON.parse(readFileSync(baselineFile, 'utf8'));
		if (!raw || typeof raw !== 'object') {
			return { kind: 'unreadable', versionLabel: 'invalid', detail: 'not a JSON object' };
		}
		if (raw.version === BASELINE_VERSION) {
			return { kind: 'v2', versionLabel: String(raw.version) };
		}
		return {
			kind: 'legacy',
			versionLabel: raw.version === undefined ? 'missing' : String(raw.version),
			detail:
				raw.stagedDiffHash !== undefined
					? 'v1 schema (stagedDiffHash)'
					: 'incompatible schema',
		};
	} catch (error) {
		return {
			kind: 'unreadable',
			versionLabel: 'unreadable',
			detail: error instanceof Error ? error.message : String(error),
		};
	}
}

function printLegacyBaselineMigration(baselineFile, classification) {
	console.error(`legacy/incompatible baseline detected (version ${classification.versionLabel})`);
	if (classification.detail) console.error(`  detail: ${classification.detail}`);
	console.error(`  path: ${baselineFile}`);
	console.error('One-time operator migration (not a lifecycle command):');
	console.error('  1. Inspect .agent/tmp/git-safety-baseline.json');
	console.error('  2. Delete that file only with explicit operator intent');
	console.error('  3. Run `pnpm agent:git-safety:start` to open a v2 session');
	console.error('Do not recreate allow-git-write or any persistent authorization marker.');
}

/**
 * @param {string} baselineFile
 */
export function readBaseline(baselineFile) {
	const classification = classifyBaselineFile(baselineFile);
	if (classification.kind !== 'v2') {
		throw new Error(
			`incompatible or legacy baseline (version ${classification.versionLabel}); remove it deliberately after inspecting evidence, then run start`,
		);
	}
	const raw = JSON.parse(readFileSync(baselineFile, 'utf8'));
	if (typeof raw.indexFingerprint !== 'string') {
		throw new Error('baseline missing indexFingerprint');
	}
	if (!Array.isArray(raw.indexEntries)) {
		throw new Error('baseline missing indexEntries');
	}
	return {
		version: raw.version,
		createdAt: String(raw.createdAt ?? ''),
		head: raw.head === undefined ? null : raw.head,
		branch: raw.branch === undefined ? null : raw.branch,
		detached: Boolean(raw.detached),
		indexFingerprint: raw.indexFingerprint,
		indexEntries: raw.indexEntries.map(String),
		diagnosticRefs: {
			localHeadsFingerprint: String(raw.diagnosticRefs?.localHeadsFingerprint ?? ''),
			tagsFingerprint: String(raw.diagnosticRefs?.tagsFingerprint ?? ''),
			stashFingerprint: String(raw.diagnosticRefs?.stashFingerprint ?? ''),
		},
	};
}

/**
 * @param {{ repoRoot?: string }} [options]
 */
export function cmdStart(options = {}) {
	const paths = resolvePaths(options.repoRoot);
	console.log('agent:git-safety:start');

	if (existsSync(paths.baselineFile)) {
		console.error('FAILED');
		console.error(`active baseline already exists: ${paths.baselineFile}`);
		const classification = classifyBaselineFile(paths.baselineFile);
		if (classification.kind === 'v2') {
			console.error(
				'Refusing to overwrite. Close the prior session with finish, or remove the baseline only with operator intent, then retry start.',
			);
		} else {
			console.error('Refusing to overwrite.');
			printLegacyBaselineMigration(paths.baselineFile, classification);
		}
		process.exitCode = 1;
		return { ok: false, reason: 'baseline-exists', classification };
	}

	retireLegacyAllowMarker(paths);

	const state = captureProtectedState(paths.repoRoot);
	const baseline = writeBaseline(paths, state);

	console.log(`  version:              ${baseline.version}`);
	console.log(`  createdAt:            ${baseline.createdAt}`);
	console.log(`  HEAD:                 ${baseline.head ?? '(unborn)'}`);
	console.log(`  branch:               ${formatBranch(state)}`);
	console.log(`  index fingerprint:    ${baseline.indexFingerprint}`);
	console.log(`  baseline file:        ${paths.baselineFile}`);
	console.log('');
	console.log('Session started. Run `pnpm agent:git-safety:finish` to verify and close.');
	return { ok: true, baseline, paths };
}

/**
 * @param {{ operation: AuthorizedOperation | null, paths: string[], branch: string | null }} auth
 */
function formatAuthorizedOperation(auth) {
	if (!auth.operation) return 'none';
	const pathPart = auth.paths.length ? ` paths=${auth.paths.join(',')}` : '';
	const branchPart = auth.branch ? ` branch=${auth.branch}` : '';
	return `${auth.operation}${pathPart}${branchPart}`;
}

/**
 * @param {ReturnType<typeof readBaseline>} baseline
 * @param {ReturnType<typeof captureProtectedState>} current
 * @param {{ operation: AuthorizedOperation | null, paths: string[], branch: string | null }} auth
 * @param {ReturnType<typeof evaluateProtectedDrift>} verdict
 */
function printFinishSummary(baseline, current, auth, verdict) {
	console.log(`  baseline createdAt:   ${baseline.createdAt || '(unknown)'}`);
	console.log(`  authorized operation: ${formatAuthorizedOperation(auth)}`);
	console.log(`  HEAD changed:         ${verdict.headChanged ? 'yes' : 'no'}`);
	console.log(`  branch changed:       ${verdict.branchChanged ? 'yes' : 'no'}`);
	console.log(`  index changed:        ${verdict.indexChanged ? 'yes' : 'no'}`);
	console.log(`  current HEAD:         ${current.head ?? '(unborn)'}`);
	console.log(`  current branch:       ${formatBranch(current)}`);
	if (verdict.changedPaths.length > 0) {
		console.log('\n  Index path deltas:');
		for (const path of verdict.changedPaths) console.log(`    ${path}`);
	}
	for (const note of verdict.notes) console.log(`  note: ${note}`);
}

/**
 * @param {{ repoRoot?: string, argv?: string[] }} [options]
 */
export function cmdFinish(options = {}) {
	const paths = resolvePaths(options.repoRoot);
	console.log('agent:git-safety:finish');

	let auth;
	try {
		auth = parseFinishArgs(options.argv ?? []);
	} catch (error) {
		console.error('FAILED');
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
		return { ok: false, reason: 'invalid-args' };
	}

	if (!existsSync(paths.baselineFile)) {
		console.error('FAILED');
		console.error('no active session baseline');
		console.error('Run `pnpm agent:git-safety:start` before mutable work, then finish.');
		retireLegacyAllowMarker(paths);
		process.exitCode = 1;
		return { ok: false, reason: 'no-baseline' };
	}

	const classification = classifyBaselineFile(paths.baselineFile);
	if (classification.kind !== 'v2') {
		console.error('FAILED');
		printLegacyBaselineMigration(paths.baselineFile, classification);
		console.error(`baseline preserved at ${paths.baselineFile}`);
		process.exitCode = 1;
		return { ok: false, reason: 'invalid-baseline', classification };
	}

	let baseline;
	try {
		baseline = readBaseline(paths.baselineFile);
	} catch (error) {
		console.error('FAILED');
		console.error(error instanceof Error ? error.message : String(error));
		console.error(`baseline preserved at ${paths.baselineFile}`);
		process.exitCode = 1;
		return { ok: false, reason: 'invalid-baseline' };
	}

	const current = captureProtectedState(paths.repoRoot);
	const verdict = evaluateProtectedDrift(baseline, current, auth);
	printFinishSummary(baseline, current, auth, verdict);

	if (verdict.failures.length > 0) {
		console.log('\nFAILED');
		for (const failure of verdict.failures) console.log(failure);
		console.log(`\nEvidence preserved at ${paths.baselineFile}`);
		console.log('Do not auto-remediate. Report the drift and ask how to proceed.');
		retireLegacyAllowMarker(paths);
		process.exitCode = 1;
		return { ok: false, reason: 'drift', failures: verdict.failures, paths };
	}

	removeIfExists(paths.baselineFile);
	retireLegacyAllowMarker(paths);
	console.log('\nPASSED');
	console.log('protected state verified; session baseline removed');
	console.log('working tree may contain unstaged implementation edits');
	return { ok: true, paths };
}

/**
 * Read-only status check for an active mutable-session baseline.
 * @param {{ repoRoot?: string }} [options]
 */
export function cmdCheck(options = {}) {
	const paths = resolvePaths(options.repoRoot);
	console.log('agent:git-safety:check');
	if (!existsSync(paths.baselineFile)) {
		console.error('NO_ACTIVE_SESSION');
		console.error('No mutable-session baseline exists.');
		process.exitCode = 1;
		return { ok: false, reason: 'no-baseline' };
	}

	let baseline;
	try {
		baseline = readBaseline(paths.baselineFile);
	} catch (error) {
		console.error('FAILED');
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
		return { ok: false, reason: 'invalid-baseline' };
	}

	const current = captureProtectedState(paths.repoRoot);
	const verdict = evaluateProtectedDrift(baseline, current, {
		operation: null,
		paths: [],
		branch: null,
	});
	console.log(`  baseline createdAt: ${baseline.createdAt || '(unknown)'}`);
	console.log(`  current HEAD:      ${current.head ?? '(unborn)'}`);
	console.log(`  current branch:    ${formatBranch(current)}`);
	if (verdict.notes.length > 0) {
		for (const note of verdict.notes) console.log(`  note: ${note}`);
	}
	if (verdict.failures.length > 0) {
		console.error('DRIFT_DETECTED');
		for (const failure of verdict.failures) console.error(`  ${failure}`);
		process.exitCode = 1;
		return { ok: false, reason: 'drift', failures: verdict.failures };
	}
	console.log('PASSED');
	console.log('protected state unchanged; baseline preserved');
	return { ok: true, paths };
}

function printUsage() {
console.error(`Usage:
  node scripts/agent/git-safety.mjs start
  node scripts/agent/git-safety.mjs check
  node scripts/agent/git-safety.mjs finish [--authorized-operation=<op>] [--paths=a,b] [--branch=name]

Supported authorized operations (ephemeral, non-persistent, not proof of consent):
  stage          requires --paths
  unstage        requires --paths
  commit
  branch-switch  requires --branch`);
}

function main() {
	const cmd = process.argv[2];
	if (!cmd || !['start', 'check', 'finish'].includes(cmd)) {
		printUsage();
		process.exit(1);
	}

	if (cmd === 'start') {
		if (process.argv.length > 3) {
			console.error('start does not accept additional arguments');
			process.exit(1);
		}
		cmdStart();
		return;
	}

	if (cmd === 'check') {
		if (process.argv.length > 3) {
			console.error('check does not accept additional arguments');
			process.exit(1);
		}
		cmdCheck();
		return;
	}

	cmdFinish({ argv: process.argv.slice(3) });
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedFile === resolve(fileURLToPath(import.meta.url))) {
	main();
}
