import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const hook = fs.readFileSync(path.join(process.cwd(), '.husky/pre-commit'), 'utf8');
function resolveShell(): string {
	if (process.platform !== 'win32') return '/bin/sh';
	const candidates = spawnSync('where.exe', ['git'], { encoding: 'utf8' })
		.stdout.trim()
		.split(/\r?\n/);
	for (const candidate of candidates) {
		let current = path.dirname(candidate);
		while (current && current !== path.dirname(current)) {
			const binBash = path.join(current, 'bin', 'bash.exe');
			if (fs.existsSync(binBash)) return binBash;
			const usrBinBash = path.join(current, 'usr', 'bin', 'bash.exe');
			if (fs.existsSync(usrBinBash)) return usrBinBash;
			current = path.dirname(current);
		}
	}
	return 'bash';
}

const shell = resolveShell();

describe('pre-commit shell exit propagation', () => {
	it.each([0, 7, 9])('runs the real hook with controlled tools and exit %i', (failure) => {
		const result = spawnSync(shell, ['-s'], {
			encoding: 'utf8',
			input: `git() { echo feature/test; }
pnpm() { echo "CHECK:$1"; if [ "$1" = lint-staged ]; then return ${failure === 7 ? 7 : 0}; fi; return ${failure === 9 ? 9 : 0}; }
${hook}
echo HOOK_COMPLETE
`,
		});
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(failure);
		expect(result.stdout).toContain('CHECK:lint-staged');
		if (failure === 7) expect(result.stdout).not.toContain('CHECK:test:changed');
		else expect(result.stdout).toContain('CHECK:test:changed');
		if (failure) expect(result.stdout).not.toContain('HOOK_COMPLETE');
		else expect(result.stdout).toContain('HOOK_COMPLETE');
	});
});
