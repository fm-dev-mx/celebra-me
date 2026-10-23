#!/usr/bin/env tsx
/**
 * worktree-doctor.ts — Read-only worktree diagnostic command.
 *
 * Detects material configuration problems without mutating any state, and lists what is safe
 * to sweep across all checkouts (`checkSweep`, also shown by `pnpm ops:status`).
 * Safe to run at any time — never deletes, resets, or modifies user work.
 *
 * Usage: pnpm ops worktree-doctor [--lane <path>]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
	detectWorktreeLane,
	findRepoRoot,
	getExternalWorktreeRoot,
	gitInspectionEnv,
	WORKTREE_LANES,
	type WorktreeLaneDefinition,
} from '../shared/worktree-lane';
import { inspectLane } from './worktree-status';
import { assertCheckoutRuntime } from './env-files';

type Category = 'Location' | 'Git state' | 'Dependencies' | 'Environment' | 'Sweep';

interface Finding {
	category: Category;
	severity: 'warning' | 'error';
	title: string;
	remediation: string;
}

function checkLocation(cwd: string, repoRoot: string, lane: WorktreeLaneDefinition): Finding[] {
	if (!existsSync(resolve(cwd, 'package.json'))) {
		return [
			{
				category: 'Location',
				severity: 'error',
				title: 'Not a valid worktree: package.json is missing',
				remediation: 'Run from a lane root or pass --lane <path>.',
			},
		];
	}
	if (lane.id !== 'unknown') return [];
	return [
		{
			category: 'Location',
			severity: 'warning',
			title: 'Not a canonical lane path',
			remediation: `Use the repository root or a lane under ${getExternalWorktreeRoot(repoRoot)}.`,
		},
	];
}

function checkGitState(cwd: string, lane: WorktreeLaneDefinition): Finding[] {
	const status = inspectLane({
		name: lane.displayName,
		path: cwd,
		runtimeDefault: lane.runtimeDefault,
	});
	if (status.inspection === 'unavailable') {
		return [
			{
				category: 'Git state',
				severity: 'error',
				title: `Git inspection unavailable: ${status.diagnostics.join('; ')}`,
				remediation: 'Resolve the Git failure before claiming or mutating this lane.',
			},
		];
	}
	const findings: Finding[] = [];
	if (status.state === 'dirty') {
		findings.push({
			category: 'Git state',
			severity: 'warning',
			title: `Working tree is dirty (${status.modifiedCount} path(s))`,
			remediation: 'Preserve the existing owner state; do not repurpose this lane.',
		});
	}
	if (status.relation === 'UNVERIFIED') {
		findings.push({
			category: 'Git state',
			severity: 'warning',
			title: 'Relation to develop is unverified',
			remediation: 'Restore the develop ref, then rerun.',
		});
	}
	return findings;
}

function checkDependencies(cwd: string): Finding[] {
	const install = 'Run: pnpm install';
	const findings: Finding[] = [];
	if (!existsSync(resolve(cwd, 'pnpm-lock.yaml'))) {
		findings.push({
			category: 'Dependencies',
			severity: 'error',
			title: 'Missing pnpm-lock.yaml',
			remediation: install,
		});
	}
	const nodeModules = resolve(cwd, 'node_modules');
	if (!existsSync(nodeModules)) {
		findings.push({
			category: 'Dependencies',
			severity: 'error',
			title: 'Missing node_modules',
			remediation: install,
		});
		return findings;
	}
	if (lstatSync(nodeModules).isSymbolicLink()) {
		findings.push({
			category: 'Dependencies',
			severity: 'error',
			title: 'node_modules is a symlink, which breaks worktree isolation',
			remediation: 'Remove the link and run pnpm install in this worktree.',
		});
	}

	const pkgPath = resolve(cwd, 'package.json');
	if (!existsSync(pkgPath)) return findings;
	let pkg: {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	try {
		pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
	} catch {
		findings.push({
			category: 'Dependencies',
			severity: 'error',
			title: 'Malformed package.json (invalid JSON syntax)',
			remediation: 'Fix the JSON syntax in package.json.',
		});
		return findings;
	}
	const missing = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
		(dep) => !existsSync(resolve(nodeModules, dep, 'package.json')),
	);
	if (missing.length > 0) {
		findings.push({
			category: 'Dependencies',
			severity: 'warning',
			title: `${missing.length} declared package(s) missing: ${missing.slice(0, 5).join(', ')}`,
			remediation: install,
		});
	}
	return findings;
}

function checkEnvironment(cwd: string, lane: WorktreeLaneDefinition): Finding[] {
	try {
		assertCheckoutRuntime(cwd, lane.runtimeDefault);
		return [];
	} catch (error: unknown) {
		// assertCheckoutRuntime messages name files and keys only, never values.
		const reason = error instanceof Error ? ` ${error.message}` : '';
		return [
			{
				category: 'Environment',
				severity: 'error',
				title: `File configuration for ${lane.runtimeDefault} runtime is incomplete or invalid.${reason}`,
				remediation: `Run pnpm env:check -- --runtime ${lane.runtimeDefault}. Request a named, purpose-scoped sync; preserve local conflicts. Shell overrides and live connectivity require separate checks.`,
			},
		];
	}
}

export type SweepKind = 'worktree' | 'branch' | 'baseline' | 'folder';

export interface SweepFinding {
	kind: SweepKind;
	/** Path or branch name the finding is about. */
	subject: string;
	detail: string;
	/** Command the owner runs to clean it up; absent when only a manual review fits. */
	command?: string;
	/** False when `gh` was unavailable, so an open PR could not be ruled out. */
	prChecked: boolean;
}

export interface SweepDeps {
	/** Runs git in the repository root and returns trimmed stdout. */
	git(args: string[]): string;
	/** Head branches of open PRs, or null when `gh` is unavailable (offline, signed out). */
	openPrBranches(): ReadonlySet<string> | null;
	/** Names of the subdirectories of a directory; empty when it does not exist. */
	listDirs(path: string): string[];
	/** Names of the files of a directory; empty when it does not exist. */
	listFiles(path: string): string[];
	/** Creation time of a git-safety baseline in ms (its `createdAt`, else its mtime), or null. */
	baselineCreatedAt(path: string): number | null;
	nowMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASELINE_MAX_AGE_MS = 7 * DAY_MS;
const BASELINE_FILE_PATTERN = /^git-safety-baseline.*\.json$/;
const LONG_LIVED_BRANCHES = new Set(['develop', 'main']);

/** Forward-slash absolute path, the form git prints and the owner can paste in any shell. */
function displayPath(path: string): string {
	return resolve(path).replaceAll('\\', '/');
}

function samePath(a: string, b: string): boolean {
	const normalize = (path: string) =>
		process.platform === 'win32' ? displayPath(path).toLowerCase() : displayPath(path);
	return normalize(a) === normalize(b);
}

interface WorktreeEntry {
	path: string;
	branch: string | null;
}

export function parseWorktreeList(porcelain: string): WorktreeEntry[] {
	const entries: WorktreeEntry[] = [];
	for (const block of porcelain.split(/\r?\n\r?\n/)) {
		const lines = block.split(/\r?\n/);
		const path = lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length);
		if (!path) continue;
		const ref = lines.find((line) => line.startsWith('branch '))?.slice('branch '.length);
		entries.push({ path, branch: ref?.replace(/^refs\/heads\//, '') ?? null });
	}
	return entries;
}

function listEntries(
	path: string,
	keep: (entry: { isDirectory(): boolean; isFile(): boolean }) => boolean,
): string[] {
	if (!existsSync(path)) return [];
	return readdirSync(path, { withFileTypes: true })
		.filter(keep)
		.map((entry) => entry.name);
}

function defaultSweepDeps(repoRoot: string): SweepDeps {
	return {
		git: (args) =>
			execFileSync('git', args, {
				cwd: repoRoot,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				env: gitInspectionEnv(),
			}).trim(),
		openPrBranches: () => {
			try {
				const raw = execFileSync(
					'gh',
					['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'headRefName'],
					{
						cwd: repoRoot,
						encoding: 'utf8',
						stdio: ['ignore', 'pipe', 'ignore'],
						timeout: 30_000,
						windowsHide: true,
					},
				);
				const prs = JSON.parse(raw) as Array<{ headRefName: string }>;
				return new Set(prs.map((pr) => pr.headRefName));
			} catch {
				return null;
			}
		},
		listDirs: (path) => listEntries(path, (entry) => entry.isDirectory()),
		listFiles: (path) => listEntries(path, (entry) => entry.isFile()),
		baselineCreatedAt: (path) => {
			try {
				const raw = JSON.parse(readFileSync(path, 'utf8')) as { createdAt?: unknown };
				const createdAt = Date.parse(String(raw.createdAt));
				return Number.isNaN(createdAt) ? statSync(path).mtimeMs : createdAt;
			} catch {
				return existsSync(path) ? statSync(path).mtimeMs : null;
			}
		},
		nowMs: Date.now(),
	};
}

/**
 * Read-only sweep of what is safe to clean up across every checkout of the repository:
 * (a) `.claude/worktrees/*` whose branch is merged into origin/develop and has no open PR,
 * (b) local branches merged into origin/develop with no worktree and no open PR,
 * (c) git-safety baselines older than 7 days, and
 * (d) folders under the external worktree root that are not a canonical lane.
 * It never deletes anything; each finding carries the command the owner can run.
 */
export function checkSweep(
	repoRoot: string,
	deps: SweepDeps = defaultSweepDeps(repoRoot),
): SweepFinding[] {
	const findings: SweepFinding[] = [];
	const root = displayPath(repoRoot);
	const worktrees = parseWorktreeList(deps.git(['worktree', 'list', '--porcelain']));
	const merged = new Set(
		deps
			.git([
				'for-each-ref',
				'--merged',
				'origin/develop',
				'--format=%(refname:short)',
				'refs/heads',
			])
			.split(/\r?\n/)
			.filter(Boolean),
	);
	const openPrs = deps.openPrBranches();
	const prChecked = openPrs !== null;
	const prNote = prChecked ? 'no tiene PR abierto' : 'PR sin comprobar (gh no respondió)';
	const isSweepable = (branch: string) =>
		merged.has(branch) && !LONG_LIVED_BRANCHES.has(branch) && !openPrs?.has(branch);

	const claudeWorktrees = resolve(repoRoot, '.claude', 'worktrees');
	for (const worktree of worktrees) {
		if (!worktree.branch || !isSweepable(worktree.branch)) continue;
		if (!samePath(resolve(worktree.path, '..'), claudeWorktrees)) continue;
		const name = relative(repoRoot, worktree.path).replaceAll('\\', '/');
		findings.push({
			kind: 'worktree',
			subject: displayPath(worktree.path),
			detail: `${name} (${worktree.branch}) ya está en origin/develop y ${prNote}. Al quitarlo, su rama aparece aquí para borrarla.`,
			command: `git -C "${root}" worktree remove "${displayPath(worktree.path)}"`,
			prChecked,
		});
	}

	const checkedOut = new Set(worktrees.flatMap((worktree) => worktree.branch ?? []));
	for (const branch of [...merged].sort()) {
		if (checkedOut.has(branch) || !isSweepable(branch)) continue;
		findings.push({
			kind: 'branch',
			subject: branch,
			detail: `${branch} ya está en origin/develop, no tiene worktree y ${prNote}.`,
			command: `git -C "${root}" branch -d ${branch}`,
			prChecked,
		});
	}

	for (const worktree of worktrees) {
		const tmpDir = resolve(worktree.path, '.agent', 'tmp');
		const baselines = deps.listFiles(tmpDir).filter((file) => BASELINE_FILE_PATTERN.test(file));
		for (const name of baselines.sort()) {
			const path = resolve(tmpDir, name);
			const createdAt = deps.baselineCreatedAt(path);
			if (createdAt === null || deps.nowMs - createdAt <= BASELINE_MAX_AGE_MS) continue;
			findings.push({
				kind: 'baseline',
				subject: displayPath(path),
				detail: `${name} en ${displayPath(worktree.path)} lleva ${Math.floor((deps.nowMs - createdAt) / DAY_MS)} días; ninguna sesión dura tanto.`,
				command: `rm "${displayPath(path)}"`,
				prChecked: true,
			});
		}
	}

	const externalRoot = getExternalWorktreeRoot(repoRoot);
	const laneSegments = new Set<string>(WORKTREE_LANES.flatMap((lane) => lane.segment ?? []));
	for (const name of deps.listDirs(externalRoot).sort()) {
		if (laneSegments.has(name)) continue;
		const path = resolve(externalRoot, name);
		const registered = worktrees.some((worktree) => samePath(worktree.path, path));
		findings.push({
			kind: 'folder',
			subject: displayPath(path),
			detail: registered
				? `${name} es un worktree fuera de los carriles F05–F12; revíselo antes de quitarlo.`
				: `${name} no es un carril F05–F12 ni un worktree registrado; revísela y bórrela a mano.`,
			command: registered
				? `git -C "${root}" worktree remove "${displayPath(path)}"`
				: undefined,
			prChecked: true,
		});
	}
	return findings;
}

const SWEEP_KIND_LABEL: Record<SweepKind, string> = {
	worktree: 'Merged worktree',
	branch: 'Merged branch',
	baseline: 'Stale git-safety baseline',
	folder: 'Non-lane folder',
};

function sweepToFindings(sweep: readonly SweepFinding[]): Finding[] {
	return sweep.map((finding) => ({
		category: 'Sweep',
		severity: 'warning',
		title: `${SWEEP_KIND_LABEL[finding.kind]}: ${finding.subject}`,
		remediation: finding.command ? `Run: ${finding.command}` : finding.detail,
	}));
}

function printReport(findings: Finding[]): void {
	const categories: Category[] = [
		'Location',
		'Git state',
		'Dependencies',
		'Environment',
		'Sweep',
	];
	for (const category of categories) {
		const matches = findings.filter((finding) => finding.category === category);
		console.log(`\n── ${category} ──`);
		if (matches.length === 0) console.log('  ✅ OK');
		for (const finding of matches) {
			console.log(`  ${finding.severity === 'error' ? '❌' : '⚠️'} ${finding.title}`);
			console.log(`     → ${finding.remediation}`);
		}
	}

	const errors = findings.filter((finding) => finding.severity === 'error').length;
	const warnings = findings.length - errors;
	if (errors > 0) {
		process.exitCode = 1;
		console.log(`\n❌ Worktree is unhealthy: ${errors} error(s), ${warnings} warning(s).`);
	} else if (warnings > 0) {
		console.log(`\n⚠️ Worktree is usable with ${warnings} warning(s).`);
	} else {
		console.log('\n✅ Worktree is healthy.');
	}
}

function main(): void {
	const args = process.argv.slice(2);
	const laneIndex = args.indexOf('--lane');
	const cwd =
		laneIndex !== -1 && args[laneIndex + 1] ? resolve(args[laneIndex + 1]!) : process.cwd();
	const repoRoot = findRepoRoot(cwd);
	const lane = detectWorktreeLane(cwd, repoRoot);

	console.log('\nCelebra-me Worktree Doctor (read-only)');
	console.log(`  Lane:    ${lane.displayName} (${lane.id})`);
	console.log(`  Path:    ${cwd}`);
	console.log(`  Runtime: ${lane.runtimeDefault} default`);

	printReport([
		...checkLocation(cwd, repoRoot, lane),
		...checkGitState(cwd, lane),
		...checkDependencies(cwd),
		...checkEnvironment(cwd, lane),
		...sweepToFindings(checkSweep(repoRoot)),
	]);
}

if (/worktree-doctor\.(ts|js|mjs)$/.test(process.argv[1] ?? '')) {
	main();
}
