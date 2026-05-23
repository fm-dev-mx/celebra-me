import { cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { runCommand } from '../helpers/run-command';
import { initGitRepo, cleanupFixture } from '../helpers/git-fixture';

const ROOT = process.cwd();
const SCRIPT_PATH = join(ROOT, 'scripts/lint-styles-changed.mjs');
const RUNTIME_FILES = ['package.json', '.stylelintrc.json', '.gitignore'];

function createRepoFixture() {
	const repoRoot = mkdtempSync(join(tmpdir(), 'lint-styles-changed-'));

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

	initGitRepo(repoRoot, 'Stylelint Changed Test', 'stylelint@example.com');

	return repoRoot;
}

function cleanupRepoFixture(repoRoot: string) {
	try {
		rmSync(join(repoRoot, 'node_modules'), { recursive: true, force: true });
	} catch {
		// Best-effort cleanup for Windows junctions.
	}

	cleanupFixture(repoRoot);
}

describe('lint-styles-changed script', () => {
	it('passes when only non-stylesheet files changed', () => {
		const repoRoot = createRepoFixture();

		try {
			const readmePath = join(repoRoot, 'README.md');
			writeFileSync(readmePath, '# fixture\n', 'utf8');
			runCommand('git', ['add', 'README.md'], { cwd: repoRoot });
			runCommand('git', ['commit', '--no-verify', '-m', 'docs(core): add fixture readme'], {
				cwd: repoRoot,
			});

			writeFileSync(readmePath, '# fixture\n\nupdated\n', 'utf8');

			const result = runCommand('node', [SCRIPT_PATH], {
				cwd: repoRoot,
				allowFailure: true,
			});

			expect(result.status).toBe(0);
			expect(result.stdout).toContain('No changed stylesheet files to lint.');
		} finally {
			cleanupRepoFixture(repoRoot);
		}
	});

	it('fails when a changed stylesheet violates Stylelint rules', () => {
		const repoRoot = createRepoFixture();

		try {
			const scssPath = join(repoRoot, 'src/styles/example.scss');
			mkdirSync(dirname(scssPath), { recursive: true });
			writeFileSync(scssPath, '.fixture { color: rgb(255 255 255 / 100%); }\n', 'utf8');
			runCommand('git', ['add', 'src/styles/example.scss'], { cwd: repoRoot });
			runCommand(
				'git',
				['commit', '--no-verify', '-m', 'feat(styles): add example stylesheet'],
				{
					cwd: repoRoot,
				},
			);

			writeFileSync(scssPath, '.fixture { color: #fff; }\n', 'utf8');

			const result = runCommand('node', [SCRIPT_PATH], {
				cwd: repoRoot,
				allowFailure: true,
			});

			expect(result.status).not.toBe(0);
			const output = `${result.stdout}\n${result.stderr}`;
			expect(output).toMatch(/#fff/);
			expect(output).toMatch(/color-no-hex/);
		} finally {
			cleanupRepoFixture(repoRoot);
		}
	});

	it('passes for a valid stylesheet change when diffing an explicit base/head range', () => {
		const repoRoot = createRepoFixture();

		try {
			const scssPath = join(repoRoot, 'src/styles/example.scss');
			mkdirSync(dirname(scssPath), { recursive: true });
			writeFileSync(scssPath, '.fixture { color: rgb(255 255 255 / 100%); }\n', 'utf8');
			runCommand('git', ['add', 'src/styles/example.scss'], { cwd: repoRoot });
			runCommand(
				'git',
				['commit', '--no-verify', '-m', 'feat(styles): add example stylesheet'],
				{
					cwd: repoRoot,
				},
			);
			const baseSha = runCommand('git', ['rev-parse', 'HEAD'], {
				cwd: repoRoot,
			}).stdout.trim();

			writeFileSync(
				scssPath,
				'.fixture {\n\tcolor: rgb(255 255 255 / 100%);\n\tbackground-color: rgb(0 0 0 / 0%);\n}\n',
				'utf8',
			);
			runCommand('git', ['add', 'src/styles/example.scss'], { cwd: repoRoot });
			runCommand(
				'git',
				['commit', '--no-verify', '-m', 'refactor(styles): extend example stylesheet'],
				{
					cwd: repoRoot,
				},
			);
			const headSha = runCommand('git', ['rev-parse', 'HEAD'], {
				cwd: repoRoot,
			}).stdout.trim();

			const result = runCommand('node', [SCRIPT_PATH], {
				cwd: repoRoot,
				allowFailure: true,
				env: {
					...process.env,
					VALIDATION_BASE_SHA: baseSha,
					VALIDATION_HEAD_SHA: headSha,
				},
			});

			expect(result.status).toBe(0);
			expect(result.stdout).toContain('Linting changed stylesheet files');
		} finally {
			cleanupRepoFixture(repoRoot);
		}
	});
});
