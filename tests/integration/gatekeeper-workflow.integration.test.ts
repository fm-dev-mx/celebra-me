import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const WORKTREE_FILES = [
	'.agent/governance/bin/gatekeeper.mjs',
	'.agent/governance/bin/gatekeeper-workflow.mjs',
	'.agent/governance/config/policy.json',
	'.husky/pre-commit',
	'scripts/validate-commits.mjs',
];

function runCommand(
	cmd: string,
	args: string[],
	options: { cwd: string; allowFailure?: boolean } = { cwd: ROOT },
) {
	const executable = process.platform === 'win32' && cmd === 'pnpm' ? 'pnpm.cmd' : cmd;
	const result = spawnSync(executable, args, {
		cwd: options.cwd,
		encoding: 'utf8',
	});
	if (result.error) throw result.error;
	if (!options.allowFailure && (result.status ?? 1) !== 0) {
		throw new Error(
			`Command failed: ${cmd} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`,
		);
	}
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
	};
}

function parseJsonFromOutput(output: string) {
	const start = output.indexOf('{');
	const end = output.lastIndexOf('}');
	if (start < 0 || end <= start) {
		throw new Error(`JSON payload not found in output:\n${output}`);
	}
	return JSON.parse(output.slice(start, end + 1));
}

function syncWorktreeFiles(worktree: string) {
	for (const file of WORKTREE_FILES) {
		const source = join(ROOT, file);
		const target = join(worktree, file);
		mkdirSync(dirname(target), { recursive: true });
		cpSync(source, target);
	}
	const nodeModulesTarget = join(worktree, 'node_modules');
	symlinkSync(join(ROOT, 'node_modules'), nodeModulesTarget, 'junction');
}

function createPlanFiles(worktree: string, count: number) {
	const dir = join(worktree, '.agent/plans/archive/gatekeeper-hardening-fixture');
	mkdirSync(dir, { recursive: true });
	for (let index = 0; index < count; index += 1) {
		const sequence = String(index + 1).padStart(2, '0');
		if (index % 2 === 0) {
			writeFileSync(
				join(dir, `${sequence}-phase.md`),
				`# Phase ${sequence}\n\n- status: pending\n`,
				'utf8',
			);
		} else {
			writeFileSync(
				join(dir, `${sequence}-manifest.json`),
				`${JSON.stringify({ id: sequence, status: 'pending' }, null, 2)}\n`,
				'utf8',
			);
		}
	}
	return dir;
}

function addAll(worktree: string, pathspec: string) {
	runCommand('git', ['add', '--', pathspec], { cwd: worktree });
}

function gitDirPath(worktree: string) {
	return runCommand('git', ['rev-parse', '--git-dir'], { cwd: worktree }).stdout.trim();
}

async function withWorktree(testBody: (worktree: string) => Promise<void>) {
	const worktree = join(
		tmpdir(),
		`gatekeeper-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`,
	);
	runCommand('git', ['worktree', 'add', '--detach', worktree, 'HEAD'], { cwd: ROOT });
	try {
		syncWorktreeFiles(worktree);
		await testBody(worktree);
	} finally {
		runCommand('git', ['worktree', 'remove', '--force', worktree], {
			cwd: ROOT,
			allowFailure: true,
		});
		rmSync(worktree, { recursive: true, force: true });
	}
}

function sleep(ms: number) {
	return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function runHook(worktree: string) {
	for (const shell of process.platform === 'win32' ? ['sh', 'bash'] : ['sh']) {
		try {
			const result = runCommand(shell, ['.husky/pre-commit'], {
				cwd: worktree,
				allowFailure: true,
			});
			const shellMissing =
				(result.status ?? 1) !== 0 &&
				/No such file or directory|not found|cannot find/i.test(
					`${result.stdout}\n${result.stderr}`,
				);
			if (shellMissing) {
				continue;
			}
			return result;
		} catch {
			/* try next shell */
		}
	}
	throw new Error('No shell available to execute .husky/pre-commit');
}

const describeWorkflowIntegration = process.platform === 'win32' ? describe.skip : describe;

describeWorkflowIntegration('Gatekeeper workflow integration', () => {
	it('handles a 20-file plan set without atomicity intervention and refreshes cached inspect state', async () => {
		await withWorktree(async (worktree) => {
			createPlanFiles(worktree, 20);
			addAll(worktree, '.agent/plans/archive/gatekeeper-hardening-fixture');

			const first = parseJsonFromOutput(
				runCommand(
					'node',
					['.agent/governance/bin/gatekeeper-workflow.mjs', 'inspect', '--json'],
					{ cwd: worktree },
				).stdout,
			);
			expect(first.workflowRoute).not.toBe('architectural_intervention');
			expect(first.workflowReasons || []).not.toContain('adu_atomicity_limit_exceeded');
			expect(first.adu.suggestedSplits.map((entry: { id: string }) => entry.id)).toEqual([
				'gov-plans-archive-1',
				'gov-plans-archive-2',
			]);

			const sessionPath = join(worktree, gitDirPath(worktree), 'gatekeeper-session.json');
			const firstSession = JSON.parse(readFileSync(sessionPath, 'utf8'));

			await sleep(1100);
			parseJsonFromOutput(
				runCommand(
					'node',
					['.agent/governance/bin/gatekeeper-workflow.mjs', 'inspect', '--json'],
					{ cwd: worktree },
				).stdout,
			);
			const secondSession = JSON.parse(readFileSync(sessionPath, 'utf8'));
			expect(secondSession.inspectionCacheKey).toBe(firstSession.inspectionCacheKey);
			expect(secondSession.refreshedAt).not.toBe(firstSession.refreshedAt);

			writeFileSync(
				join(worktree, '.agent/plans/archive/gatekeeper-hardening-fixture/01-phase.md'),
				'# Phase 01\n\n- status: complete\n',
				'utf8',
			);
			addAll(worktree, '.agent/plans/archive/gatekeeper-hardening-fixture/01-phase.md');

			parseJsonFromOutput(
				runCommand(
					'node',
					['.agent/governance/bin/gatekeeper-workflow.mjs', 'inspect', '--json'],
					{ cwd: worktree },
				).stdout,
			);
			const thirdSession = JSON.parse(readFileSync(sessionPath, 'utf8'));
			expect(thirdSession.inspectionCacheKey).not.toBe(firstSession.inspectionCacheKey);
		});
	});

	it('keeps S0 valid through stage, scaffold, and pre-commit formatting for plan-only buckets', async () => {
		await withWorktree(async (worktree) => {
			createPlanFiles(worktree, 20);
			addAll(worktree, '.agent/plans/archive/gatekeeper-hardening-fixture');

			const inspect = parseJsonFromOutput(
				runCommand(
					'node',
					['.agent/governance/bin/gatekeeper-workflow.mjs', 'inspect', '--json'],
					{ cwd: worktree },
				).stdout,
			);
			const firstDomain = inspect.adu.suggestedSplits[0].id;

			runCommand(
				'node',
				[
					'.agent/governance/bin/gatekeeper-workflow.mjs',
					'stage',
					'--domain',
					firstDomain,
					'--json',
				],
				{ cwd: worktree },
			);
			const scaffold = parseJsonFromOutput(
				runCommand(
					'node',
					[
						'.agent/governance/bin/gatekeeper-workflow.mjs',
						'scaffold',
						'--domain',
						firstDomain,
						'--json',
					],
					{ cwd: worktree },
				).stdout,
			);
			expect(scaffold.header.length).toBeLessThanOrEqual(72);
			for (const line of scaffold.body as string[]) {
				expect(line.length).toBeLessThanOrEqual(100);
			}

			let hook;
			try {
				hook = runHook(worktree);
			} catch (error) {
				if (String(error).includes('No shell available')) {
					return;
				}
				throw error;
			}
			expect(hook.status).toBe(0);
			expect(`${hook.stdout}\n${hook.stderr}`).not.toContain('s0ScopeDrift');
			expect(`${hook.stdout}\n${hook.stderr}`).not.toContain('Scope drift detected');
		});
	});
});
