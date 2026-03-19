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

function buildEnv(
	files: string[],
	diffEntries?: Array<{ path: string; status: string; area?: string }>,
) {
	const entries =
		diffEntries ||
		files.map((file) => ({
			path: file,
			status: 'M',
		}));
	return {
		COMMITLINT_STAGED_FILES: files.join('\n'),
		COMMITLINT_DIFF_JSON: JSON.stringify(entries),
		COMMITLINT_FILE_GROUPS_JSON: JSON.stringify([
			{
				key: 'src/assets/images/events/demo-cumple/',
				files: files.filter((file) =>
					file.startsWith('src/assets/images/events/demo-cumple/'),
				),
				kind: 'asset-group',
			},
		]),
		COMMITLINT_DOMINANT_CHANGE_KIND: 'add',
		COMMITLINT_DOMINANT_AREA: 'asset',
	};
}

describe('Commit validation contract', () => {
	it('rejects process-oriented subjects', () => {
		const result = lintMessage(
			`feat(ui): record ui scope\n\n- src/components/Hero.tsx: Align hero to/for architectural purpose`,
			{
				COMMITLINT_STAGED_FILES: 'src/components/Hero.tsx',
				COMMITLINT_DIFF_JSON: JSON.stringify([
					{ path: 'src/components/Hero.tsx', status: 'M', area: 'source' },
				]),
				COMMITLINT_DOMINANT_CHANGE_KIND: 'modify',
				COMMITLINT_DOMINANT_AREA: 'source',
			},
		);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('subject must describe the change');
	});

	it('rejects generic subjects even when they use a strong verb', () => {
		const result = lintMessage('chore(core): update files', {
			COMMITLINT_STAGED_FILES: 'src/lib/core.ts',
			COMMITLINT_DIFF_JSON: JSON.stringify([
				{ path: 'src/lib/core.ts', status: 'M', area: 'source' },
			]),
			COMMITLINT_DOMINANT_CHANGE_KIND: 'modify',
			COMMITLINT_DOMINANT_AREA: 'source',
		});

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain(
			'subject must include a concrete target after the verb',
		);
	});

	it('rejects grouped path bullets for atomic asset commits', () => {
		const files = [
			'src/assets/images/events/demo-cumple/hero.webp',
			'src/assets/images/events/demo-cumple/gallery-01.webp',
			'src/assets/images/events/demo-cumple/index.ts',
		];
		const result = lintMessage(
			`
feat(ui): add demo-cumple webp asset set

- src/assets/images/events/demo-cumple/: add the birthday webp asset set
			`,
			buildEnv(files, [
				{ path: files[0], status: 'A', area: 'asset' },
				{ path: files[1], status: 'A', area: 'asset' },
				{ path: files[2], status: 'A', area: 'source' },
			]),
		);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('exact changed file path');
	});

	it('rejects bullets without path coverage', () => {
		const files = [
			'src/assets/images/events/demo-cumple/hero.webp',
			'src/assets/images/events/demo-cumple/index.ts',
		];
		const result = lintMessage(
			`
feat(ui): add demo-cumple webp asset set

- add the birthday webp asset set
			`,
			buildEnv(files, [
				{ path: files[0], status: 'A', area: 'asset' },
				{ path: files[1], status: 'A', area: 'source' },
			]),
		);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('commit body bullets must use');
	});

	it('accepts exact per-file docs archive bullets', () => {
		const files = [
			'.agent/plans/archive/ximena-overhaul/CHANGELOG.md',
			'.agent/plans/archive/ximena-overhaul/README.md',
			'.agent/plans/archive/ximena-overhaul/manifest.json',
		];
		const result = lintMessage(
			`
docs(gov-plans-archive): archive ximena-overhaul plan files

- .agent/plans/archive/ximena-overhaul/CHANGELOG.md: Align changelog to/for plan audit trail entries
- .agent/plans/archive/ximena-overhaul/README.md: Align readme to/for overview and operating guidance
- .agent/plans/archive/ximena-overhaul/manifest.json: Align manifest to/for plan metadata and phases
			`,
			{
				COMMITLINT_STAGED_FILES: files.join('\n'),
				COMMITLINT_DIFF_JSON: JSON.stringify(
					files.map((file) => ({
						path: file,
						status: 'A',
						area: file.endsWith('.json') ? 'config' : 'docs',
					})),
				),
				COMMITLINT_FILE_GROUPS_JSON: JSON.stringify([
					{
						key: '.agent/plans/archive/ximena-overhaul/',
						files,
						kind: 'docs-group',
					},
				]),
				COMMITLINT_DOMINANT_CHANGE_KIND: 'add',
				COMMITLINT_DOMINANT_AREA: 'docs',
			},
		);

		expect(result.status).toBe(0);
	});

	it('rejects ellipsis in commit body path bullets', () => {
		const files = [
			'src/lib/rsvp/repositories/guest.repository.ts',
			'src/lib/rsvp/services/dashboard-guests.service.ts',
		];
		const result = lintMessage(
			`
refactor(auth): standardize guest repository flows

- src/lib/.../guest.repository.ts: Align guest repository to/for guest persistence logic
			`,
			{
				COMMITLINT_STAGED_FILES: files.join('\n'),
				COMMITLINT_DIFF_JSON: JSON.stringify(
					files.map((file) => ({ path: file, status: 'M', area: 'source' })),
				),
				COMMITLINT_DOMINANT_CHANGE_KIND: 'modify',
				COMMITLINT_DOMINANT_AREA: 'source',
			},
		);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain('ellipsis (...) is not allowed');
	});

	it('accepts full relative paths in commit body path bullets', () => {
		const files = [
			'src/lib/rsvp/repositories/guest.repository.ts',
			'src/lib/rsvp/services/dashboard-guests.service.ts',
		];
		const result = lintMessage(
			`
refactor(auth): standardize guest repository flows

- src/lib/rsvp/repositories/guest.repository.ts: Align guest repository to/for guest persistence logic
- src/lib/rsvp/services/dashboard-guests.service.ts: Align dashboard service to/for guest orchestration
			`,
			{
				COMMITLINT_STAGED_FILES: files.join('\n'),
				COMMITLINT_DIFF_JSON: JSON.stringify(
					files.map((file) => ({ path: file, status: 'M', area: 'source' })),
				),
				COMMITLINT_DOMINANT_CHANGE_KIND: 'modify',
				COMMITLINT_DOMINANT_AREA: 'source',
			},
		);

		expect(result.status).toBe(0);
	});

	it('accepts renamed-file bullets that use the new path and mention the old path', () => {
		const files = ['scripts/commit-title.mjs'];
		const result = lintMessage(
			`
chore(gov-tooling): rename commit title helper

- scripts/commit-title.mjs: Rename from scripts/commit-helper.mjs and Align script to/for governance tooling
			`,
			{
				COMMITLINT_STAGED_FILES: files.join('\n'),
				COMMITLINT_DIFF_JSON: JSON.stringify([
					{
						path: files[0],
						oldPath: 'scripts/commit-helper.mjs',
						status: 'R',
						area: 'script',
					},
				]),
				COMMITLINT_DOMINANT_CHANGE_KIND: 'rename',
				COMMITLINT_DOMINANT_AREA: 'script',
			},
		);

		expect(result.status).toBe(0);
	});

	it('rejects remove-style subjects for rename-dominant commits', () => {
		const files = ['scripts/commit-title.mjs'];
		const result = lintMessage(
			`
chore(gov-tooling): remove commit title helper

- scripts/commit-title.mjs: Rename from scripts/commit-helper.mjs and Align script to/for governance tooling
			`,
			{
				COMMITLINT_STAGED_FILES: files.join('\n'),
				COMMITLINT_DIFF_JSON: JSON.stringify([
					{
						path: files[0],
						oldPath: 'scripts/commit-helper.mjs',
						status: 'R',
						area: 'script',
					},
				]),
				COMMITLINT_DOMINANT_CHANGE_KIND: 'rename',
				COMMITLINT_DOMINANT_AREA: 'script',
			},
		);

		expect(result.status).not.toBe(0);
		expect(`${result.stdout}\n${result.stderr}`).toContain(
			'does not match dominant rename changes',
		);
	});

	it('accepts deleted-file bullets that use the deleted path', () => {
		const files = ['docs/core/legacy-governance.md'];
		const result = lintMessage(
			`
docs(docs): remove legacy governance guide

- docs/core/legacy-governance.md: Remove legacy governance to/for governance cleanup
			`,
			{
				COMMITLINT_STAGED_FILES: files.join('\n'),
				COMMITLINT_DIFF_JSON: JSON.stringify([
					{ path: files[0], status: 'D', area: 'docs' },
				]),
				COMMITLINT_DOMINANT_CHANGE_KIND: 'delete',
				COMMITLINT_DOMINANT_AREA: 'docs',
			},
		);

		expect(result.status).toBe(0);
	});
});
