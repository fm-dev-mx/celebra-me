import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const shell =
	process.platform === 'win32'
		? resolve(
				execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(),
				'../../../bin/bash.exe',
			)
		: 'sh';
const hook = resolve('.husky/pre-push').replaceAll('\\', '/');
const updates = `refs/heads/task ${'a'.repeat(40)} refs/heads/task ${'b'.repeat(40)}\nrefs/heads/second ${'c'.repeat(40)} refs/heads/second ${'d'.repeat(40)}\n`;
function run(input: string, lfsStatus = '0') {
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
  printf '%s\\n' aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
}
node() { return 0; }
hook=$1
shift
. "$hook"
`,
			'test',
			hook,
			'origin',
			'https://example.invalid/repository.git',
		],
		{
			input,
			encoding: 'utf8',
			env: {
				...process.env,
				LFS_TEST_STATUS: lfsStatus,
				ALLOW_MAIN_PUSH: '',
				SKIP_COMMIT_RANGE_VALIDATION: '',
			},
			timeout: 10000,
		},
	);
}
describe('pre-push LFS handoff', () => {
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
