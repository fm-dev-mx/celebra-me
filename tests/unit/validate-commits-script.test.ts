import { cpSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { runCommand } from '../helpers/run-command';
import { initGitRepo, cleanupFixture } from '../helpers/git-fixture';

const ROOT = process.cwd();
const SCRIPT_PATH = join(ROOT, 'scripts/validate-commits.mjs');
const RUNTIME_FILES = ['commitlint.config.cjs', 'package.json'];
const describeRangeValidation = process.platform === 'win32' ? describe.skip : describe;

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

	initGitRepo(repoRoot, 'Commit Validation Test', 'commit-validation@example.com');

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
				// The fixture borrows installed dependencies; never let pnpm reinstall the
				// external symlink target. Commitlint itself still executes normally.
				env: { ...process.env, pnpm_config_verify_deps_before_run: 'warn' },
			});

			expect(result.status).toBe(0);
			expect(result.stdout).toContain('Checking commit:');
			expect(result.stdout).toContain('Commit validation completed');

			writeFileSync(trackedFile, '# fixture\n\ninvalid commit message\n', 'utf8');
			runCommand('git', ['add', 'README.md'], { cwd: repoRoot });
			runCommand('git', ['commit', '--no-verify', '-m', 'invalid'], { cwd: repoRoot });
			const invalidHead = runCommand('git', ['rev-parse', 'HEAD'], {
				cwd: repoRoot,
			}).stdout.trim();
			const invalid = runCommand('node', [SCRIPT_PATH, headSha, invalidHead], {
				cwd: repoRoot,
				allowFailure: true,
				env: { ...process.env, pnpm_config_verify_deps_before_run: 'warn' },
			});
			expect(invalid.status).toBe(1);
			expect(invalid.stderr).toContain('Commit validation failed');
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	describe('commit size limits', () => {
		const env = { ...process.env, pnpm_config_verify_deps_before_run: 'warn' };

		function commitFiles(
			repoRoot: string,
			files: Record<string, string | Buffer>,
			message: string[],
		) {
			for (const [path, content] of Object.entries(files)) {
				const target = join(repoRoot, path);
				mkdirSync(dirname(target), { recursive: true });
				writeFileSync(target, content);
			}
			// Stage only the written paths; the fixture's node_modules link must stay untracked.
			runCommand('git', ['add', '--', ...Object.keys(files)], { cwd: repoRoot });
			runCommand(
				'git',
				['commit', '--no-verify', ...message.flatMap((part) => ['-m', part])],
				{ cwd: repoRoot },
			);
			return runCommand('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).stdout.trim();
		}

		function sourceModules(count: number) {
			return Object.fromEntries(
				Array.from({ length: count }, (_, index) => [
					`src/fixture/module-${index}.ts`,
					`export const value${index} = ${index};\n`,
				]),
			);
		}

		function validate(repoRoot: string, baseSha: string, headSha: string, flags: string[]) {
			return runCommand('node', [SCRIPT_PATH, baseSha, headSha, ...flags], {
				cwd: repoRoot,
				allowFailure: true,
				env,
			});
		}

		function withBase(test: (repoRoot: string, baseSha: string) => void) {
			const repoRoot = createRepoFixture();
			try {
				const baseSha = commitFiles(repoRoot, { 'README.md': '# fixture\n' }, [
					'docs(testing): add fixture readme',
				]);
				test(repoRoot, baseSha);
			} finally {
				cleanupFixture(repoRoot);
			}
		}

		const body = 'Adds generated fixture modules so the size limit has a commit to measure.';

		it('blocks more than 40 reviewable files only with --strict', () => {
			withBase((repoRoot, baseSha) => {
				const headSha = commitFiles(repoRoot, sourceModules(41), [
					'test(testing): add generated fixture modules',
					body,
				]);

				const strict = validate(repoRoot, baseSha, headSha, ['--strict']);
				expect(strict.status).toBe(1);
				expect(strict.stderr).toContain('commit changes 41 reviewable files (limit 40)');

				const advisory = validate(repoRoot, baseSha, headSha, []);
				expect(advisory.status).toBe(0);
				expect(advisory.stderr).toContain('commit changes 41 reviewable files (limit 40)');
			});
		});

		it('turns the hard limit into a warning with a Large-Change trailer', () => {
			withBase((repoRoot, baseSha) => {
				const headSha = commitFiles(repoRoot, sourceModules(41), [
					'test(testing): add generated fixture modules',
					body,
					'Large-Change: sweep',
				]);

				const strict = validate(repoRoot, baseSha, headSha, ['--strict']);
				expect(strict.status).toBe(0);
				expect(strict.stderr).toContain(
					'commit changes 41 reviewable files and 41 lines (Large-Change: sweep)',
				);
			});
		});

		it('blocks a multi-file commit without a body only with --strict', () => {
			withBase((repoRoot, baseSha) => {
				const headSha = commitFiles(repoRoot, sourceModules(2), [
					'test(testing): add two fixture modules',
					'Co-Authored-By: Fixture <fixture@example.com>',
				]);

				const strict = validate(repoRoot, baseSha, headSha, ['--strict']);
				expect(strict.status).toBe(1);
				expect(strict.stderr).toContain(
					'commit changes 2 reviewable files but has no body',
				);

				const advisory = validate(repoRoot, baseSha, headSha, []);
				expect(advisory.status).toBe(0);
				expect(advisory.stderr).toContain(
					'commit changes 2 reviewable files but has no body',
				);
			});
		});

		it('accepts a single-file commit without a body', () => {
			withBase((repoRoot, baseSha) => {
				const headSha = commitFiles(repoRoot, sourceModules(1), [
					'test(testing): add one fixture module',
				]);

				const strict = validate(repoRoot, baseSha, headSha, ['--strict']);
				expect(strict.status).toBe(0);
				expect(strict.stderr).not.toContain('has no body');
			});
		});

		it('leaves the lockfile and images out of the size count', () => {
			withBase((repoRoot, baseSha) => {
				const images = Object.fromEntries(
					Array.from({ length: 45 }, (_, index) => [
						`src/assets/fixture-${index}.png`,
						Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, index]),
					]),
				);
				const headSha = commitFiles(
					repoRoot,
					{
						...images,
						'pnpm-lock.yaml': 'lockfileVersion: 9.0\n'.repeat(700),
						'src/fixture/module-0.ts': 'export const value0 = 0;\n',
					},
					['test(testing): add image and lockfile fixtures', body],
				);

				const strict = validate(repoRoot, baseSha, headSha, ['--strict']);
				expect(strict.status).toBe(0);
				expect(strict.stderr).not.toContain('reviewable files');
			});
		});
	});
});
