import { cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const SCRIPT_PATH = join(ROOT, 'scripts/validate-commits.mjs');
const RUNTIME_FILES = ['commitlint.config.cjs', 'package.json'];
const describeRangeValidation = process.platform === 'win32' ? describe.skip : describe;

function runCommand(
	cmd: string,
	args: string[],
	options: { cwd: string; allowFailure?: boolean } = { cwd: ROOT },
) {
	const result = spawnSync(cmd, args, {
		cwd: options.cwd,
		encoding: 'utf8',
		env: process.env,
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

function createRepoFixture() {
	const repoRoot = mkdtempSync(join(tmpdir(), 'commit-validation-range-'));

	for (const file of RUNTIME_FILES) {
		const source = join(ROOT, file);
		const target = join(repoRoot, file);
		mkdirSync(dirname(target), { recursive: true });
		cpSync(source, target);
	}

	symlinkSync(
		join(ROOT, 'node_modules'),
		join(repoRoot, 'node_modules'),
		process.platform === 'win32' ? 'junction' : 'dir',
	);

	runCommand('git', ['init'], { cwd: repoRoot });
	runCommand('git', ['config', 'user.name', 'Commit Validation Test'], { cwd: repoRoot });
	runCommand('git', ['config', 'user.email', 'commit-validation@example.com'], {
		cwd: repoRoot,
	});

	return repoRoot;
}

describeRangeValidation('validate-commits script', () => {
	it('audits a generic commit range without plan metadata', () => {
		const repoRoot = createRepoFixture();
		try {
			const trackedFile = join(repoRoot, 'README.md');
			writeFileSync(trackedFile, '# fixture\n', 'utf8');
			runCommand('git', ['add', 'README.md'], { cwd: repoRoot });
			runCommand('git', ['commit', '--no-verify', '-m', 'docs(core): add fixture readme'], {
				cwd: repoRoot,
			});
			const baseSha = runCommand('git', ['rev-parse', 'HEAD'], {
				cwd: repoRoot,
			}).stdout.trim();

			writeFileSync(trackedFile, '# fixture\n\nsecond line\n', 'utf8');
			runCommand('git', ['add', 'README.md'], { cwd: repoRoot });
			runCommand(
				'git',
				['commit', '--no-verify', '-m', 'docs(core): update fixture readme'],
				{
					cwd: repoRoot,
				},
			);
			const headSha = runCommand('git', ['rev-parse', 'HEAD'], {
				cwd: repoRoot,
			}).stdout.trim();

			const result = runCommand('node', [SCRIPT_PATH, baseSha, headSha], {
				cwd: repoRoot,
				allowFailure: true,
			});

			expect(result.status).toBe(0);
			expect(result.stdout).toContain('Checking commit:');
			expect(result.stdout).toContain('Commit validation completed');
		} finally {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});
});
