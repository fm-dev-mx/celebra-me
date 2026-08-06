/**
 * release-check.ts — Canonical release validation bound to clean HEAD.
 *
 * Runs type-check → tests → build against a clean working tree, then writes
 * gitignored evidence under .agent/tmp/ for Production apply gates.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fail, runCommand, type CommandResult } from './db-workflow-lib.ts';
import {
	formatOperatorFailure,
	parsePorcelainDirtyFiles,
} from './operator-cli-ux.ts';

export const RELEASE_CHECK_EVIDENCE_PATH = resolve(
	process.cwd(),
	'.agent/tmp/release-check-evidence.json',
);

export interface ReleaseCheckEvidence {
	version: 1;
	status: 'pass';
	sha: string;
	clean: true;
	typeCheck: 'pass';
	test: 'pass';
	build: 'pass';
	createdAt: string;
}

export interface GitWorktreeState {
	sha: string;
	clean: boolean;
	dirtySummary: string;
}

export function readGitWorktreeState(
	runner: (command: string, args: string[]) => string = (command, args) =>
		execFileSync(command, args, { encoding: 'utf8' }).trim(),
): GitWorktreeState {
	const sha = runner('git', ['rev-parse', 'HEAD']);
	if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
		fail(`Unable to resolve current HEAD SHA (got "${sha}").`);
	}
	const porcelain = runner('git', ['status', '--porcelain']);
	const dirtyCount = porcelain
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter(Boolean).length;
	const dirtyFiles = parsePorcelainDirtyFiles(porcelain, 8);
	return {
		sha,
		clean: dirtyCount === 0,
		dirtySummary:
			dirtyCount === 0 ? '' : `${dirtyCount} archivo(s): ${dirtyFiles.join(' | ')}`,
	};
}

function failDirtyWorktree(state: GitWorktreeState, cause: string): never {
	const porcelain = state.dirtySummary;
	// Re-read porcelain paths from git for a precise multiline list.
	let items: string[] = [];
	try {
		const raw = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
		items = parsePorcelainDirtyFiles(raw);
	} catch {
		items = porcelain
			? porcelain
					.replace(/^\d+ archivo\(s\):\s*/, '')
					.split(' | ')
					.filter(Boolean)
			: [];
	}
	process.stderr.write(
		formatOperatorFailure({
			title: 'Árbol de trabajo con cambios',
			cause,
			code: 'DIRTY_WORKTREE',
			remediation: [
				'Revise los archivos afectados y confirme que los cambios son intencionales.',
				'Haga commit de los cambios (o limpie el árbol) hasta que `git status` quede limpio.',
				'Ejecute `pnpm release-check` sobre el HEAD limpio.',
				'Reintente el comando de Production apply.',
			],
			retryCommand: 'pnpm release-check && pnpm db:prod:migrate',
			affected: {
				label: 'Archivos afectados',
				items,
			},
		}),
	);
	process.exit(1);
}

export function assertCleanGitWorktree(state: GitWorktreeState = readGitWorktreeState()): string {
	if (!state.clean) {
		failDirtyWorktree(
			state,
			`Hay cambios locales sin commit. La validación de release y el apply de Production exigen un HEAD limpio. ${state.dirtySummary}`,
		);
	}
	return state.sha;
}

export function writeReleaseCheckEvidence(evidence: ReleaseCheckEvidence, path = RELEASE_CHECK_EVIDENCE_PATH): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

export function clearReleaseCheckEvidence(path = RELEASE_CHECK_EVIDENCE_PATH): void {
	if (existsSync(path)) unlinkSync(path);
}

export function readReleaseCheckEvidence(
	path = RELEASE_CHECK_EVIDENCE_PATH,
): ReleaseCheckEvidence | null {
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as ReleaseCheckEvidence;
		if (
			parsed?.version !== 1 ||
			parsed.status !== 'pass' ||
			parsed.clean !== true ||
			parsed.typeCheck !== 'pass' ||
			parsed.test !== 'pass' ||
			parsed.build !== 'pass' ||
			typeof parsed.sha !== 'string' ||
			typeof parsed.createdAt !== 'string'
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Require valid release-check evidence for the current clean HEAD.
 * Invalidates stale/mismatched evidence files.
 */
export function assertValidReleaseCheckEvidence(
	options: {
		evidencePath?: string;
		worktree?: GitWorktreeState;
	} = {},
): ReleaseCheckEvidence {
	const worktree = options.worktree ?? readGitWorktreeState();
	const sha = assertCleanGitWorktree(worktree);
	const path = options.evidencePath ?? RELEASE_CHECK_EVIDENCE_PATH;
	const evidence = readReleaseCheckEvidence(path);
	if (!evidence) {
		fail(
			'RELEASE_CHECK_REQUIRED: Run `pnpm release-check` on a clean worktree before Production apply. No valid evidence artifact was found.',
		);
	}
	if (evidence.sha !== sha) {
		clearReleaseCheckEvidence(path);
		fail(
			`RELEASE_CHECK_STALE: Evidence SHA ${evidence.sha} does not match current clean HEAD ${sha}. Re-run \`pnpm release-check\`.`,
		);
	}
	return evidence;
}

export function runReleaseCheck(options: {
	runner?: typeof runCommand;
	evidencePath?: string;
	worktree?: GitWorktreeState;
} = {}): ReleaseCheckEvidence {
	const runner = options.runner ?? runCommand;
	const worktree = options.worktree ?? readGitWorktreeState();
	const sha = assertCleanGitWorktree(worktree);
	const evidencePath = options.evidencePath ?? RELEASE_CHECK_EVIDENCE_PATH;

	clearReleaseCheckEvidence(evidencePath);

	const steps: Array<{ label: 'typeCheck' | 'test' | 'build'; args: string[] }> = [
		{ label: 'typeCheck', args: ['type-check'] },
		{ label: 'test', args: ['test'] },
		{ label: 'build', args: ['build'] },
	];

	for (const step of steps) {
		console.info(`release-check: running pnpm ${step.args.join(' ')}...`);
		const result: CommandResult = runner('pnpm', step.args, { throwOnError: false });
		if (result.status !== 0) {
			clearReleaseCheckEvidence(evidencePath);
			fail(`release-check failed during pnpm ${step.args.join(' ')} (exit ${result.status}).`);
		}
	}

	const post = readGitWorktreeState();
	if (!post.clean || post.sha !== sha) {
		clearReleaseCheckEvidence(evidencePath);
		if (!post.clean) {
			failDirtyWorktree(
				post,
				'El árbol de trabajo cambió durante release-check. No se escribió evidencia.',
			);
		}
		fail(
			'DIRTY_WORKTREE: Working tree SHA changed during release-check. Evidence was not written.',
		);
	}

	const evidence: ReleaseCheckEvidence = {
		version: 1,
		status: 'pass',
		sha,
		clean: true,
		typeCheck: 'pass',
		test: 'pass',
		build: 'pass',
		createdAt: new Date().toISOString(),
	};
	writeReleaseCheckEvidence(evidence, evidencePath);
	console.info(`✅ release-check passed for HEAD ${sha}`);
	console.info(`   Evidence: ${evidencePath}`);
	return evidence;
}

function main(): void {
	runReleaseCheck();
}

if (process.argv[1]?.endsWith('release-check.ts')) {
	main();
}
