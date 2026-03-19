import { cpSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const FIXTURE_ROOT = join(ROOT, 'tests/fixtures/gatekeeper/plan-aware-basic');
const RUNTIME_FILES = ['commitlint.config.cjs', 'package.json'];
const WORKFLOW_BIN = join(ROOT, '.agent/governance/bin/gatekeeper-workflow.mjs');

function runCommand(
	cmd: string,
	args: string[],
	options: { cwd: string; allowFailure?: boolean; env?: Record<string, string> } = {
		cwd: ROOT,
	},
) {
	const executable = process.platform === 'win32' && cmd === 'pnpm' ? 'pnpm.cmd' : cmd;
	const result = spawnSync(executable, args, {
		cwd: options.cwd,
		encoding: 'utf8',
		env: {
			...process.env,
			...(options.env || {}),
		},
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
	for (const file of RUNTIME_FILES) {
		const source = join(ROOT, file);
		const target = join(worktree, file);
		mkdirSync(dirname(target), { recursive: true });
		cpSync(source, target);
	}
	cpSync(FIXTURE_ROOT, worktree, { recursive: true });
	const nodeModulesTarget = join(worktree, 'node_modules');
	symlinkSync(join(ROOT, 'node_modules'), nodeModulesTarget, 'junction');
}

function seedFixtureBaseline(worktree: string) {
	runCommand(
		'git',
		[
			'add',
			'--',
			'.agent/plans/commit-workflow-fixture',
			'src/lib/invitation/page-data.ts',
			'src/lib/presenters/invitation-presenter.ts',
			'src/pages/[eventType]/[slug].astro',
			'tests/support/invitation-presenter.fixture.ts',
		],
		{ cwd: worktree },
	);
	runCommand(
		'git',
		[
			'-c',
			'user.name=Gatekeeper Test',
			'-c',
			'user.email=gatekeeper@example.com',
			'commit',
			'--no-verify',
			'-m',
			'chore(core): seed commit workflow fixture',
		],
		{ cwd: worktree },
	);
	writeFileSync(
		join(worktree, 'src/lib/invitation/page-data.ts'),
		"export const label = 'page-data-v2';\n",
		'utf8',
	);
	writeFileSync(
		join(worktree, 'src/lib/presenters/invitation-presenter.ts'),
		"export const label = 'invitation-presenter-v2';\n",
		'utf8',
	);
	writeFileSync(
		join(worktree, 'src/pages/[eventType]/[slug].astro'),
		"---\nconst label = 'slug-page-v2';\n---\n\n<div>{label}</div>\n",
		'utf8',
	);
	writeFileSync(
		join(worktree, 'tests/support/invitation-presenter.fixture.ts'),
		"export const label = 'invitation-presenter-test-v2';\n",
		'utf8',
	);
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

const describeWorkflowIntegration = process.platform === 'win32' ? describe.skip : describe;

describeWorkflowIntegration('Gatekeeper workflow integration', () => {
	it('inspects working-tree changes and resolves one planned unit without pre-staging', async () => {
		await withWorktree(async (worktree) => {
			seedFixtureBaseline(worktree);
			const inspect = parseJsonFromOutput(
				runCommand(
					'node',
					[WORKFLOW_BIN, 'inspect', '--plan', 'commit-workflow-fixture', '--json'],
					{ cwd: worktree },
				).stdout,
			);

			expect(inspect.workflowRoute).toBe('proceed_commit_unit');
			expect(inspect.commitPlanning.status).toBe('matched_unit');
			expect(inspect.commitPlanning.recommendedUnit.id).toBe('retire-invitation-layers');
		});
	});

	it('stages exactly one unit from working tree and scaffolds trailers', async () => {
		await withWorktree(async (worktree) => {
			seedFixtureBaseline(worktree);
			runCommand('node', [WORKFLOW_BIN, 'inspect', '--plan', 'commit-workflow-fixture'], {
				cwd: worktree,
			});

			const staged = parseJsonFromOutput(
				runCommand(
					'node',
					[
						WORKFLOW_BIN,
						'stage',
						'--plan',
						'commit-workflow-fixture',
						'--unit',
						'retire-invitation-layers',
						'--json',
					],
					{ cwd: worktree },
				).stdout,
			);
			expect(staged.planId).toBe('commit-workflow-fixture');
			expect(staged.unitId).toBe('retire-invitation-layers');

			const scaffold = parseJsonFromOutput(
				runCommand(
					'node',
					[WORKFLOW_BIN, 'scaffold', '--unit', 'retire-invitation-layers', '--json'],
					{ cwd: worktree },
				).stdout,
			);
			expect(scaffold.header).toBe('refactor(core): retire invitation presenter layers');
			expect(scaffold.fullMessage).toContain('Plan-Id: commit-workflow-fixture');
			expect(scaffold.fullMessage).toContain('Commit-Unit: retire-invitation-layers');
		});
	});

	it('creates a planned commit with durable trailers', async () => {
		await withWorktree(async (worktree) => {
			seedFixtureBaseline(worktree);
			runCommand('node', [WORKFLOW_BIN, 'inspect', '--plan', 'commit-workflow-fixture'], {
				cwd: worktree,
			});
			runCommand(
				'node',
				[
					WORKFLOW_BIN,
					'stage',
					'--plan',
					'commit-workflow-fixture',
					'--unit',
					'retire-invitation-layers',
				],
				{ cwd: worktree },
			);
			runCommand('node', [WORKFLOW_BIN, 'commit', '--unit', 'retire-invitation-layers'], {
				cwd: worktree,
				env: {
					HUSKY: '0',
				},
			});

			const subject = runCommand('git', ['log', '-1', '--format=%s'], {
				cwd: worktree,
			}).stdout.trim();
			const body = runCommand('git', ['log', '-1', '--format=%B'], {
				cwd: worktree,
			}).stdout;
			expect(subject).toBe('refactor(core): retire invitation presenter layers');
			expect(body).toContain('Plan-Id: commit-workflow-fixture');
			expect(body).toContain('Commit-Unit: retire-invitation-layers');
		});
	});

	it('blocks commit when the staged set drifts after stage', async () => {
		await withWorktree(async (worktree) => {
			seedFixtureBaseline(worktree);
			runCommand('node', [WORKFLOW_BIN, 'inspect', '--plan', 'commit-workflow-fixture'], {
				cwd: worktree,
			});
			runCommand(
				'node',
				[
					WORKFLOW_BIN,
					'stage',
					'--plan',
					'commit-workflow-fixture',
					'--unit',
					'retire-invitation-layers',
				],
				{ cwd: worktree },
			);
			const extraFile = join(worktree, 'docs/core/extra.md');
			mkdirSync(dirname(extraFile), { recursive: true });
			writeFileSync(extraFile, '# extra\n', 'utf8');
			runCommand('git', ['add', '--', 'docs/core/extra.md'], { cwd: worktree });

			const commit = runCommand(
				'node',
				[WORKFLOW_BIN, 'commit', '--unit', 'retire-invitation-layers'],
				{
					cwd: worktree,
					allowFailure: true,
					env: {
						HUSKY: '0',
					},
				},
			);

			expect(commit.status).not.toBe(0);
			expect(`${commit.stdout}\n${commit.stderr}`).toContain('Staged set drift detected');
		});
	});
});
