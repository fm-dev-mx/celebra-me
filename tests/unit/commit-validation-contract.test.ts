import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

function lintMessage(message: string): { status: number; stdout: string; stderr: string } {
	const COMMITLINT_CLI = join(process.cwd(), 'node_modules/@commitlint/cli/cli.js');
	const tempDir = mkdtempSync(join(tmpdir(), 'commitlint-contract-'));
	const tempFile = join(tempDir, 'COMMIT_EDITMSG');
	writeFileSync(tempFile, `${message.trim()}\n`, 'utf8');

	try {
		const result = spawnSync(process.execPath, [COMMITLINT_CLI, '--edit', tempFile], {
			cwd: process.cwd(),
			encoding: 'utf8',
			shell: false,
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
		expect(`${result.stdout}\n${result.stderr}`).toContain(
			'subject must include a concrete target after the verb',
		);
	});

	it('rejects process-language subjects', () => {
		const result = lintMessage('chore(core): record changes');

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('subject must describe the change');
	});

	it('rejects internal process identifiers', () => {
		const result = lintMessage('fix(rsvp): close phase 2.1 of the reply flow');

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain(
			'commit message names an internal process identifier: "phase 2.1"',
		);
	});

	it('warns on plan codes without blocking the commit', () => {
		const result = lintMessage('docs(plans): mark the D5 hosting decision as taken');

		expect(result.status).toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('contains the plan code "D5"');
	});

	it('rejects headers longer than 100 characters', () => {
		const header = `fix(rsvp): reject duplicate replies ${'x'.repeat(65)}`;
		expect(header).toHaveLength(101);

		const result = lintMessage(header);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('header-max-length');
	});

	it('warns on scopes outside the canonical list without blocking the commit', () => {
		const result = lintMessage('fix(unknown-area): reject duplicate guest replies');

		expect(result.status).toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('scope-enum');
	});
});
