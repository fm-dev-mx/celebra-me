import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { cleanupFixture, initGitRepo } from '../helpers/git-fixture';

const shell =
	process.platform === 'win32'
		? resolve(
				execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(),
				'../../../bin/bash.exe',
			)
		: 'sh';
const hook = resolve('.husky/pre-push').replaceAll('\\', '/');
const updates = `refs/heads/task ${'a'.repeat(40)} refs/heads/task ${'b'.repeat(40)}\nrefs/heads/second ${'c'.repeat(40)} refs/heads/second ${'d'.repeat(40)}\n`;
function run(
	input: string,
	lfsStatus = '0',
	remote = 'origin',
	missingRefs = '',
	policyStatus = '0',
) {
	return spawnSync(
		shell,
		[
			'-c',
			`
git() {
  if [ "$1" = lfs ]; then
    printf 'LFS_ARGS:%s\\n' "$*"
    cat
    return "$LFS_TEST_STATUS"
  fi
  if [ "$1" = merge-base ]; then
    case ",$MISSING_REFS," in *",$3,"*) return 1 ;; esac
    printf '%s\\n' "$3"
    return 0
  fi
  printf '%s\\n' aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
}
node() { printf 'POLICY:%s\\n' "$*"; return "$POLICY_STATUS"; }
hook=$1
shift
. "$hook"
`,
			'test',
			hook,
			remote,
			'https://example.invalid/repository.git',
		],
		{
			input,
			encoding: 'utf8',
			env: {
				...process.env,
				LFS_TEST_STATUS: lfsStatus,
				MISSING_REFS: missingRefs,
				POLICY_STATUS: policyStatus,
				ALLOW_MAIN_PUSH: '',
				SKIP_COMMIT_RANGE_VALIDATION: '',
			},
			timeout: 10000,
		},
	);
}
describe('pre-push LFS handoff', () => {
	it('validates every pending commit but no integrated history in a real new-branch graph', () => {
		const directory = mkdtempSync(resolve(tmpdir(), 'pre-push-range-'));
		try {
			initGitRepo(directory, 'Range Fixture', 'range@example.invalid');
			const git = (...args: string[]) =>
				execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
			const commit = (index: number) => {
				writeFileSync(resolve(directory, 'fixture.txt'), `${index}\n`);
				git('add', 'fixture.txt');
				git('commit', '-m', `test(range): verify fixture revision ${index}`);
				return git('rev-parse', 'HEAD');
			};
			git('update-ref', 'refs/remotes/origin/main', commit(0));
			commit(1);
			git('update-ref', 'refs/remotes/origin/develop', commit(2));
			commit(3);
			const head = commit(4);
			const result = spawnSync(
				shell,
				[
					'-c',
					`
git() { if [ "$1" = lfs ]; then cat >/dev/null; else command git "$@"; fi; }
node() { printf 'PENDING:'; command git rev-list --count "$2..$3"; }
hook=$1
shift
. "$hook"
`,
					'test',
					hook,
					'origin',
				],
				{
					cwd: directory,
					encoding: 'utf8',
					timeout: 10000,
					input: `refs/heads/task ${head} refs/heads/task ${'0'.repeat(40)}\n`,
					env: { ...process.env, ALLOW_MAIN_PUSH: '', SKIP_COMMIT_RANGE_VALIDATION: '' },
				},
			);
			expect(result.error).toBeUndefined();
			expect(result.status).toBe(0);
			expect(result.stdout).toContain('PENDING:2');
		} finally {
			cleanupFixture(directory);
		}
	});
	const newBranch = `refs/heads/task ${'a'.repeat(40)} refs/heads/task ${'0'.repeat(40)}\n`;
	it('excludes integrated develop history for a new origin task branch', () => {
		const result = run(newBranch);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('POLICY:scripts/validate-commits.mjs origin/develop ');
	});
	it('keeps the existing remote SHA as the base for branch updates', () => {
		expect(run(updates).stdout).toContain(
			`POLICY:scripts/validate-commits.mjs ${'b'.repeat(40)} `,
		);
	});
	it.each([
		['upstream', 'refs/heads/task'],
		['origin', 'refs/heads/develop'],
		['origin', 'refs/tags/v1'],
	])('preserves fallback policy for %s %s', (remote, ref) => {
		const result = run(newBranch.replaceAll('refs/heads/task', ref), '0', remote);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain('POLICY:scripts/validate-commits.mjs origin/main ');
	});
	it.each([
		['origin/develop', 'origin/main'],
		['origin/develop,origin/main', 'a'.repeat(40)],
	])('retains fallback when %s is unavailable', (missing, base) => {
		const result = run(newBranch, '0', 'origin', missing);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(`POLICY:scripts/validate-commits.mjs ${base} `);
	});
	it('stops before LFS when commit validation fails', () => {
		const result = run(newBranch, '0', 'origin', '', '7');
		expect(result.status).toBe(7);
		expect(result.stdout).not.toContain('LFS_ARGS');
	});
	it('passes branch deletion to LFS without validating a zero local SHA', () => {
		const result = run(`(delete) ${'0'.repeat(40)} refs/heads/task ${'b'.repeat(40)}\n`);
		expect(result.status).toBe(0);
		expect(result.stdout).not.toContain('POLICY:');
		expect(result.stdout).toContain('LFS_ARGS');
	});
	it('passes both ref updates and remote arguments to LFS after policy', () => {
		const result = run(updates);
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			'LFS_ARGS:lfs pre-push origin https://example.invalid/repository.git',
		);
		expect(result.stdout).toContain(updates);
	});
	it('propagates LFS failure', () => expect(run(updates, '1').status).toBe(1));
	it('keeps main protection ahead of upload', () => {
		const result = run(updates.replaceAll('refs/heads/task', 'refs/heads/main'));
		expect(result.status).toBe(1);
		expect(result.stdout).not.toContain('LFS_ARGS');
	});
});
