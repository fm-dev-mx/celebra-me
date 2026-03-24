import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

function lintMessage(message: string): { status: number; stdout: string; stderr: string } {
	const tempDir = mkdtempSync(join(tmpdir(), 'commitlint-contract-'));
	const tempFile = join(tempDir, 'COMMIT_EDITMSG');
	writeFileSync(tempFile, `${message.trim()}\n`, 'utf8');

	try {
		const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
		const result = spawnSync(executable, ['commitlint', '--edit', tempFile], {
			cwd: process.cwd(),
			encoding: 'utf8',
			shell: process.platform === 'win32',
			env: process.env,
		});
		return {
			status: result.status ?? 1,
			stdout: String(result.stdout || ''),
			stderr: String(result.stderr || ''),
		};
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}

describe('Commit validation contract', () => {
	it('accepts conventional commits with a concrete target', () => {
		const result = lintMessage('refactor(core): retire invitation presenter layers');

		expect(result.status).toBe(0);
	});

	it('rejects overly generic subjects', () => {
		const result = lintMessage('refactor(core): update files');

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('subject target is too generic');
	});

	it('rejects process-language subjects', () => {
		const result = lintMessage('chore(core): record changes');

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('subject must describe the change');
	});
});
