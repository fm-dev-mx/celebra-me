import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { runCommand } from '../helpers/run-command';
import { initGitRepo, cleanupFixture } from '../helpers/git-fixture';

const ROOT = process.cwd();
const CLI_PATH = join(ROOT, 'scripts/cli.mjs');

function createRepoFixture() {
	const repoRoot = mkdtempSync(join(tmpdir(), 'check-links-'));
	['scripts/cli.mjs', 'scripts/check-links.mjs', 'scripts/shared-changed-files.mjs'].forEach(
		(file) => {
			const source = join(ROOT, file);
			const target = join(repoRoot, file);
			mkdirSync(dirname(target), { recursive: true });
			cpSync(source, target);
		},
	);

	initGitRepo(repoRoot, 'Check Links Test', 'check-links@example.com');

	return repoRoot;
}

describe('check-links script', () => {
	it('passes when changed markdown links resolve', () => {
		const repoRoot = createRepoFixture();

		try {
			mkdirSync(join(repoRoot, 'docs'), { recursive: true });
			writeFileSync(join(repoRoot, 'docs/guide.md'), '# Guide\n', 'utf8');
			writeFileSync(join(repoRoot, 'README.md'), '[Guide](docs/guide.md)\n', 'utf8');
			runCommand('git', ['add', '.'], { cwd: repoRoot });
			runCommand('git', ['commit', '--no-verify', '-m', 'docs(core): add docs guide'], {
				cwd: repoRoot,
			});

			writeFileSync(
				join(repoRoot, 'README.md'),
				'[Guide](docs/guide.md)\n[CLI](scripts/cli.mjs)\n',
				'utf8',
			);

			const result = runCommand('node', [CLI_PATH, 'check-links'], {
				cwd: repoRoot,
				allowFailure: true,
			});

			expect(result.status).toBe(0);
			expect(result.stdout).toContain('Checked 1 changed Markdown file');
		} finally {
			cleanupFixture(repoRoot);
		}
	});

	it('fails when a changed markdown file points to a missing relative target', () => {
		const repoRoot = createRepoFixture();

		try {
			writeFileSync(join(repoRoot, 'README.md'), '[Guide](docs/guide.md)\n', 'utf8');
			runCommand('git', ['add', 'README.md'], { cwd: repoRoot });
			runCommand('git', ['commit', '--no-verify', '-m', 'docs(core): add readme link'], {
				cwd: repoRoot,
			});

			writeFileSync(join(repoRoot, 'README.md'), '[Missing](docs/missing.md)\n', 'utf8');

			const result = runCommand('node', [CLI_PATH, 'check-links'], {
				cwd: repoRoot,
				allowFailure: true,
			});

			expect(result.status).not.toBe(0);
			expect(`${result.stdout}\n${result.stderr}`).toContain('docs/missing.md');
		} finally {
			cleanupFixture(repoRoot);
		}
	});
});
