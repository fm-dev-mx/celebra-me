import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const CLI_PATH = join(ROOT, 'scripts/cli.mjs');

function runCommand(cmd: string, args: string[], options: { cwd: string; allowFailure?: boolean }) {
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
	const repoRoot = mkdtempSync(join(tmpdir(), 'check-links-'));
	['scripts/cli.mjs', 'scripts/check-links.mjs', 'scripts/shared-changed-files.mjs'].forEach(
		(file) => {
			const source = join(ROOT, file);
			const target = join(repoRoot, file);
			mkdirSync(dirname(target), { recursive: true });
			cpSync(source, target);
		},
	);

	runCommand('git', ['init'], { cwd: repoRoot });
	runCommand('git', ['config', 'user.name', 'Check Links Test'], { cwd: repoRoot });
	runCommand('git', ['config', 'user.email', 'check-links@example.com'], { cwd: repoRoot });

	return repoRoot;
}

function cleanupRepoFixture(repoRoot: string) {
	try {
		rmSync(repoRoot, { recursive: true, force: true });
	} catch {
		// Ignore teardown races from temporary git fixtures.
	}
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
			cleanupRepoFixture(repoRoot);
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
			cleanupRepoFixture(repoRoot);
		}
	});
});
