import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

function lintMessage(
	message: string,
	env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
	const tempDir = mkdtempSync(join(tmpdir(), 'commitlint-contract-'));
	const tempFile = join(tempDir, 'COMMIT_EDITMSG');
	writeFileSync(tempFile, `${message.trim()}\n`, 'utf8');

	try {
		const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
		const result = spawnSync(executable, ['commitlint', '--edit', tempFile], {
			cwd: process.cwd(),
			encoding: 'utf8',
			shell: process.platform === 'win32',
			env: {
				...process.env,
				...env,
			},
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

function buildEnv(files: string[]) {
	return {
		COMMITLINT_STAGED_FILES: files.join('\n'),
		COMMITLINT_DIFF_JSON: JSON.stringify(
			files.map((file) => ({
				path: file,
				status: 'M',
				area: 'source',
			})),
		),
		COMMITLINT_FILE_GROUPS_JSON: JSON.stringify([
			{
				key: 'src/lib/invitation/',
				files,
				kind: 'source-group',
			},
		]),
		COMMITLINT_DOMINANT_CHANGE_KIND: 'modify',
		COMMITLINT_DOMINANT_AREA: 'source',
		COMMITLINT_PLAN_ID: 'commit-workflow-fixture',
		COMMITLINT_UNIT_ID: 'retire-invitation-layers',
		COMMITLINT_UNIT_VERB: 'retire',
		COMMITLINT_UNIT_TARGET: 'invitation presenter layers',
		COMMITLINT_UNIT_PURPOSE: 'collapse presenter indirection into page-data assembly',
		COMMITLINT_UNIT_FILES_JSON: JSON.stringify(files),
		COMMITLINT_UNIT_DOMAIN: 'core',
	};
}

describe('Commit validation contract', () => {
	it('rejects missing plan trailers', () => {
		const files = [
			'src/lib/invitation/page-data.ts',
			'src/lib/presenters/invitation-presenter.ts',
		];
		const result = lintMessage(
			`
refactor(core): retire invitation presenter layers

- src/lib/invitation/page-data.ts: Align page data to/for collapse presenter indirection into page-data assembly
- src/lib/presenters/invitation-presenter.ts: Remove invitation presenter to/for collapse presenter indirection into page-data assembly
			`,
			buildEnv(files),
		);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain(
			'planned commits must include Plan-Id and Commit-Unit trailers',
		);
	});

	it('rejects subjects that do not match the selected commit unit', () => {
		const files = [
			'src/lib/invitation/page-data.ts',
			'src/lib/presenters/invitation-presenter.ts',
		];
		const result = lintMessage(
			`
refactor(core): align invitation page data

- src/lib/invitation/page-data.ts: Align page data to/for collapse presenter indirection into page-data assembly
- src/lib/presenters/invitation-presenter.ts: Remove invitation presenter to/for collapse presenter indirection into page-data assembly

Plan-Id: commit-workflow-fixture
Commit-Unit: retire-invitation-layers
			`,
			buildEnv(files),
		);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain(
			'subject must match planned commit unit subject',
		);
	});

	it('rejects scope drift relative to the selected domain', () => {
		const files = [
			'src/lib/invitation/page-data.ts',
			'src/lib/presenters/invitation-presenter.ts',
		];
		const result = lintMessage(
			`
refactor(auth): retire invitation presenter layers

- src/lib/invitation/page-data.ts: Align page data to/for collapse presenter indirection into page-data assembly
- src/lib/presenters/invitation-presenter.ts: Remove invitation presenter to/for collapse presenter indirection into page-data assembly

Plan-Id: commit-workflow-fixture
Commit-Unit: retire-invitation-layers
			`,
			buildEnv(files),
		);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain(
			'scope must match planned unit domain "core"',
		);
	});

	it('accepts valid planned commit messages with trailers', () => {
		const files = [
			'src/lib/invitation/page-data.ts',
			'src/lib/presenters/invitation-presenter.ts',
		];
		const result = lintMessage(
			`
refactor(core): retire invitation presenter layers

- src/lib/invitation/page-data.ts: Align page data to/for collapse presenter indirection into page-data assembly
- src/lib/presenters/invitation-presenter.ts: Remove invitation presenter to/for collapse presenter indirection into page-data assembly

Plan-Id: commit-workflow-fixture
Commit-Unit: retire-invitation-layers
			`,
			buildEnv(files),
		);

		expect(result.status).toBe(0);
	});
});
