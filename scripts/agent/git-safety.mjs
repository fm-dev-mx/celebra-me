#!/usr/bin/env node

/**
 * Interactive Agent OS Git Safety lifecycle.
 *
 * Commands:
 *   start   — establish a mutable-session baseline (replaces one only when nothing drifted)
 *   finish  — verify protected state, then clean up on PASS (preserve on FAIL)
 *
 * Authorization remains Task Contract / current-task user authority.
 * Optional `--authorized-operation=` (comma-separated) only communicates that authority
 * to the detector for one invocation; it is never persisted and never proves human consent.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

export const BASELINE_VERSION = 3;
export const BASELINE_FILE_NAME = 'git-safety-baseline.json';

/** @typedef {'stage' | 'unstage' | 'commit' | 'history' | 'branch-switch'} AuthorizedOperation */
/** @typedef {{ operations: AuthorizedOperation[], paths: string[], branch: string | null }} Authorization */

const SUPPORTED_OPERATIONS = new Set(['stage', 'unstage', 'commit', 'history', 'branch-switch']);
const NO_AUTHORIZATION = Object.freeze({ operations: [], paths: [], branch: null });

const SESSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Concurrent agent sessions in one checkout keep separate baselines so that closing one session
 * never consumes another session's evidence. Without a session id the shared legacy file is used.
 * @param {string | null | undefined} session
 */
export function baselineFileName(session) {
	if (!session) return BASELINE_FILE_NAME;
	if (!SESSION_PATTERN.test(session))
		throw new Error('--session must match [A-Za-z0-9._-]{1,64} (for example the task branch).');
	return `git-safety-baseline.${session}.json`;
}

/**
 * @param {string} [repoRoot]
 * @param {string | null} [session]
 */
export function resolvePaths(
	repoRoot = process.env.CELEBRA_GIT_SAFETY_ROOT || defaultRepoRoot(),
	session = process.env.CELEBRA_GIT_SAFETY_SESSION || null,
) {
	const root = resolve(repoRoot);
	const tmpDir = join(root, '.agent', 'tmp');
	return {
		repoRoot: root,
		tmpDir,
		session: session || null,
		baselineFile: join(tmpDir, baselineFileName(session)),
	};
}

/**
 * Removes `--session` from argv; the remaining arguments keep their command-specific meaning.
 * @param {string[]} argv
 */
export function extractSessionArg(argv) {
	/** @type {string | null} */
	let session = null;
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith('--session=')) session = arg.slice('--session='.length);
		else if (arg === '--session') session = argv[++i] ?? '';
		else rest.push(arg);
	}
	if (session !== null) baselineFileName(session || '-invalid-');
	return { session, rest };
}

/** @param {string | null} session */
function sessionFlag(session) {
	return session ? ` --session=${session}` : '';
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
		stdout: String(result.stdout || '')
			.replace(/\r\n/g, '\n')
			.trimEnd(),
		stderr: String(result.stderr || '')
			.replace(/\r\n/g, '\n')
			.trimEnd(),
	};
}

/**
 * @param {string} text
 */
function sha256(text) {
	return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Fingerprint of staged changes relative to HEAD (`git diff --cached --raw`), so a
 * branch switch or commit that leaves nothing staged does not read as index drift.
 * Uses blob OIDs / modes / paths — never buffers staged binary contents.
 * @param {string} repoRoot
 */
export function indexFingerprint(repoRoot) {
	const { stdout } = git(repoRoot, ['diff', '--cached', '--raw', '--no-renames', '--no-abbrev']);
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
	const heads = git(
		repoRoot,
		['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'],
		{
			allowFailure: true,
		},
	);
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
 * @param {string | undefined} value
 * @returns {AuthorizedOperation[]}
 */
function parseOperationsOption(value) {
	const operations = parsePathsOption(value ?? '');
	const unknown = operations.filter((operation) => !SUPPORTED_OPERATIONS.has(operation));
	if (operations.length === 0 || unknown.length > 0) {
		throw new Error(
			`Unknown authorized operation "${unknown.join(',') || value || ''}". Supported: ${[...SUPPORTED_OPERATIONS].join(', ')}`,
		);
	}
	return /** @type {AuthorizedOperation[]} */ (operations);
}

/**
 * @param {string[]} argv
 */
export function parseFinishArgs(argv) {
	/** @type {Authorization} */
	const result = { operations: [], paths: [], branch: null };

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--') continue;
		if (arg.startsWith('--authorized-operation=')) {
			result.operations = parseOperationsOption(arg.slice('--authorized-operation='.length));
			continue;
		}
		if (arg === '--authorized-operation') {
			result.operations = parseOperationsOption(argv[++i]);
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
 * @param {Authorization} auth
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

	const failures = evaluateDrift(auth, {
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
 * Every protected drift must be covered by an authorized operation:
 * commit/history cover HEAD and index, stage/unstage cover the listed index paths,
 * branch-switch covers HEAD and a move to exactly --branch.
 * @param {Authorization} auth
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
function evaluateDrift(auth, state) {
	const operations = new Set(auth.operations);
	const movesHead = operations.has('commit') || operations.has('history');
	const stagesPaths = operations.has('stage') || operations.has('unstage');
	const switchesBranch = operations.has('branch-switch');
	/** @type {string[]} */
	const failures = [];

	if (stagesPaths !== auth.paths.length > 0) {
		failures.push('--paths is required by, and only accepted with, stage/unstage');
	}
	if (switchesBranch !== Boolean(auth.branch)) {
		failures.push('--branch is required by, and only accepted with, branch-switch');
	}
	if (failures.length > 0) return failures;

	if (!movesHead) failures.push(...uncoveredIndexDrift(auth, state));
	if (operations.has('commit') && !state.headChanged) {
		failures.push(
			'authorized commit requires HEAD to change (index-only drift is staging, not commit)',
		);
	}
	if (state.headChanged && !movesHead && !switchesBranch) {
		failures.push(
			`HEAD changed from ${state.baseline.head ?? '(unborn)'} to ${state.current.head ?? '(unborn)'} without authorization`,
		);
	}
	if (switchesBranch && state.current.branch !== auth.branch) {
		failures.push(
			`authorized branch-switch expected branch "${auth.branch}", current is ${formatBranch(state.current)}`,
		);
	}
	if (!switchesBranch && (state.branchChanged || state.detachedChanged)) {
		failures.push(
			`branch/detached state changed from ${formatBranch(state.baseline)} to ${formatBranch(state.current)} without authorization`,
		);
	}
	return failures;
}

/**
 * Index drift not covered by the `--paths` of stage/unstage.
 * @param {Authorization} auth
 * @param {{ indexChanged: boolean, changedPaths: string[] }} state
 */
function uncoveredIndexDrift(auth, state) {
	if (!state.indexChanged) return [];
	const allowed = new Set(auth.paths);
	const outside = state.changedPaths.filter((path) => !allowed.has(path));
	if (outside.length > 0) {
		return [
			'index (staged) state changed without authorization',
			`index paths outside authorized scope: ${outside.join(', ')}`,
		];
	}
	return state.changedPaths.length === 0
		? ['index (staged) state changed without authorization']
		: [];
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
 * @returns {{ kind: 'valid' | 'invalid', versionLabel: string, detail?: string }}
 */
export function classifyBaselineFile(baselineFile) {
	try {
		const raw = JSON.parse(readFileSync(baselineFile, 'utf8'));
		if (!raw || typeof raw !== 'object') {
			return { kind: 'invalid', versionLabel: 'invalid', detail: 'not a JSON object' };
		}
		if (
			raw.version === BASELINE_VERSION &&
			typeof raw.indexFingerprint === 'string' &&
			Array.isArray(raw.indexEntries)
		) {
			return { kind: 'valid', versionLabel: String(raw.version) };
		}
		return {
			kind: 'invalid',
			versionLabel: raw.version === undefined ? 'missing' : String(raw.version),
			detail: 'unsupported schema',
		};
	} catch (error) {
		return {
			kind: 'invalid',
			versionLabel: 'unreadable',
			detail: error instanceof Error ? error.message : String(error),
		};
	}
}

function printInvalidBaseline(baselineFile, classification) {
	console.error(`invalid baseline detected (version ${classification.versionLabel})`);
	if (classification.detail) console.error(`  detail: ${classification.detail}`);
	console.error(`  path: ${baselineFile}`);
	console.error('Inspect and remove the invalid file only with explicit operator intent.');
}

/**
 * @param {string} baselineFile
 */
export function readBaseline(baselineFile) {
	const classification = classifyBaselineFile(baselineFile);
	if (classification.kind !== 'valid') {
		throw new Error(
			`invalid baseline (version ${classification.versionLabel}); remove it deliberately after inspecting evidence, then run start`,
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
 * @param {{ repoRoot?: string, session?: string | null }} [options]
 */
export function cmdStart(options = {}) {
	const paths = resolvePaths(options.repoRoot, options.session);
	console.log('agent:git-safety:start');

	const state = captureProtectedState(paths.repoRoot);

	if (existsSync(paths.baselineFile)) {
		let classification = classifyBaselineFile(paths.baselineFile);
		/** @type {string[]} */
		let drift = [];
		if (classification.kind === 'valid') {
			try {
				drift = evaluateProtectedDrift(
					readBaseline(paths.baselineFile),
					state,
					NO_AUTHORIZATION,
				).failures;
			} catch (error) {
				classification = {
					kind: 'invalid',
					versionLabel: classification.versionLabel,
					detail: error instanceof Error ? error.message : String(error),
				};
			}
		}
		if (classification.kind !== 'valid' || drift.length > 0) {
			console.error('FAILED');
			console.error(`active baseline already exists: ${paths.baselineFile}`);
			if (classification.kind === 'valid') {
				for (const failure of drift) console.error(`  ${failure}`);
				console.error(
					'Refusing to overwrite drifted evidence. Close the prior session with finish first.',
				);
			} else {
				printInvalidBaseline(paths.baselineFile, classification);
			}
			process.exitCode = 1;
			return { ok: false, reason: 'baseline-exists', classification };
		}
		console.log('  replacing a prior baseline with no protected drift');
	}

	const baseline = writeBaseline(paths, state);

	console.log(`  version:              ${baseline.version}`);
	console.log(`  createdAt:            ${baseline.createdAt}`);
	console.log(`  HEAD:                 ${baseline.head ?? '(unborn)'}`);
	console.log(`  branch:               ${formatBranch(state)}`);
	console.log(`  index fingerprint:    ${baseline.indexFingerprint}`);
	console.log(`  baseline file:        ${paths.baselineFile}`);
	console.log('');
	console.log(
		`Session started. Run \`pnpm agent:git-safety:finish${sessionFlag(paths.session)}\` to verify and close.`,
	);
	return { ok: true, baseline, paths };
}

/**
 * @param {Authorization} auth
 */
function formatAuthorizedOperation(auth) {
	if (auth.operations.length === 0) return 'none';
	const pathPart = auth.paths.length ? ` paths=${auth.paths.join(',')}` : '';
	const branchPart = auth.branch ? ` branch=${auth.branch}` : '';
	return `${auth.operations.join(',')}${pathPart}${branchPart}`;
}

/**
 * @param {ReturnType<typeof readBaseline>} baseline
 * @param {ReturnType<typeof captureProtectedState>} current
 * @param {Authorization} auth
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
 * @param {{ repoRoot?: string, argv?: string[], session?: string | null }} [options]
 */
export function cmdFinish(options = {}) {
	const paths = resolvePaths(options.repoRoot, options.session);
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
		console.error(
			`Run \`pnpm agent:git-safety:start${sessionFlag(paths.session)}\` before mutable work, then finish.`,
		);
		process.exitCode = 1;
		return { ok: false, reason: 'no-baseline' };
	}

	const classification = classifyBaselineFile(paths.baselineFile);
	if (classification.kind !== 'valid') {
		console.error('FAILED');
		printInvalidBaseline(paths.baselineFile, classification);
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
		process.exitCode = 1;
		return { ok: false, reason: 'drift', failures: verdict.failures, paths };
	}

	removeIfExists(paths.baselineFile);
	console.log('\nPASSED');
	console.log('protected state verified; session baseline removed');
	console.log('working tree may contain unstaged implementation edits');
	return { ok: true, paths };
}

/**
 * Read-only status check for an active mutable-session baseline.
 * @param {{ repoRoot?: string, session?: string | null }} [options]
 */
export function cmdCheck(options = {}) {
	const paths = resolvePaths(options.repoRoot, options.session);
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
	const verdict = evaluateProtectedDrift(baseline, current, NO_AUTHORIZATION);
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
  node scripts/agent/git-safety.mjs start [--session=<id>]
  node scripts/agent/git-safety.mjs check [--session=<id>]
  node scripts/agent/git-safety.mjs finish [--session=<id>] [--authorized-operation=<op>[,<op>...]] [--paths=a,b] [--branch=name]

--session keeps a separate baseline per concurrent agent session in one checkout
(defaults to CELEBRA_GIT_SAFETY_SESSION, else the shared baseline).

Supported authorized operations (ephemeral, non-persistent, not proof of consent; combinable):
  stage          requires --paths
  unstage        requires --paths
  commit         HEAD must move
  history        HEAD may move (rebase, merge, pull)
  branch-switch  requires --branch`);
}

function main() {
	const cmd = process.argv[2];
	if (!cmd || !['start', 'check', 'finish'].includes(cmd)) {
		printUsage();
		process.exit(1);
	}

	let parsed;
	try {
		parsed = extractSessionArg(process.argv.slice(3).filter((arg) => arg !== '--'));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
	const session = parsed.session ?? undefined;

	if (cmd === 'start') {
		if (parsed.rest.length > 0) {
			console.error('start does not accept additional arguments');
			process.exit(1);
		}
		cmdStart({ session });
		return;
	}

	if (cmd === 'check') {
		if (parsed.rest.length > 0) {
			console.error('check does not accept additional arguments');
			process.exit(1);
		}
		cmdCheck({ session });
		return;
	}

	cmdFinish({ argv: parsed.rest, session });
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedFile === resolve(fileURLToPath(import.meta.url))) {
	main();
}
