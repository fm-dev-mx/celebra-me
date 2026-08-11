import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type PackageManifest = {
	scripts?: Record<string, string>;
	'lint-staged'?: Record<string, string[]>;
};

function readPackageManifest(): PackageManifest {
	const packagePath = path.resolve(process.cwd(), 'package.json');
	return JSON.parse(fs.readFileSync(packagePath, 'utf8')) as PackageManifest;
}

describe('canonical validation contract', () => {
	it('keeps full Stylelint and the production build in the canonical CI command', () => {
		const manifest = readPackageManifest();
		const scripts = manifest.scripts ?? {};
		const ci = scripts['ci'] ?? '';

		expect(ci).toContain('pnpm lint:styles');
		expect(ci).not.toContain('pnpm lint:styles:changed');
		expect(ci).toContain('pnpm build:app');
		expect(ci).toContain('pnpm validate:structure');
		expect(ci).not.toContain('agent:git-safety');
		expect(scripts['agent:git-safety:start']).toBe('node scripts/agent/git-safety.mjs start');
		expect(scripts['agent:git-safety:finish']).toBe('node scripts/agent/git-safety.mjs finish');
		expect(scripts['agent:git-safety:check']).toBeUndefined();
		expect(scripts['agent:git-safety:end']).toBeUndefined();
		expect(scripts['validate:markdown-tables']).toBe(
			'node scripts/validate-markdown-tables.mjs',
		);
		expect(scripts['format:markdown-tables']).toBe(
			'node scripts/validate-markdown-tables.mjs --fix',
		);
		expect(manifest['lint-staged']?.['*.md']).toEqual([
			'node scripts/validate-markdown-tables.mjs --fix --files',
			'prettier --write',
			'node scripts/validate-markdown-tables.mjs --files',
		]);

		const markdownlintConfig = JSON.parse(
			fs.readFileSync(path.resolve(process.cwd(), '.markdownlint.json'), 'utf8'),
		) as Record<string, unknown>;
		expect(markdownlintConfig.default).toBe(false);
		expect(markdownlintConfig['celebra-table-narrative']).toEqual(
			expect.objectContaining({ severity: 'warning', maxCharacters: 120 }),
		);
		expect(markdownlintConfig['celebra-table-hard-limit']).toEqual(
			expect.objectContaining({ severity: 'error', maxCharacters: 240 }),
		);

		const markdownlintCliConfig = fs.readFileSync(
			path.resolve(process.cwd(), '.markdownlint-cli2.jsonc'),
			'utf8',
		);
		expect(markdownlintCliConfig).toContain('./scripts/markdownlint/table-readability.mjs');

		const vscodeSettings = JSON.parse(
			fs.readFileSync(path.resolve(process.cwd(), '.vscode/settings.json'), 'utf8'),
		) as { '[markdown]'?: { 'editor.codeActionsOnSave'?: Record<string, unknown> } };
		expect(vscodeSettings['[markdown]']?.['editor.codeActionsOnSave']).toEqual(
			expect.objectContaining({ 'source.fixAll.markdownlint': 'explicit' }),
		);

		const extensions = JSON.parse(
			fs.readFileSync(path.resolve(process.cwd(), '.vscode/extensions.json'), 'utf8'),
		) as { recommendations?: string[] };
		expect(extensions.recommendations).toEqual(
			expect.arrayContaining(['DavidAnson.vscode-markdownlint', 'esbenp.prettier-vscode']),
		);
	});

	it('keeps coverage opt-in and replaces placeholder E2E tiers', () => {
		const scripts = readPackageManifest().scripts ?? {};

		expect(scripts.test).toBe('jest');
		expect(scripts['test:coverage']).toBe('jest --coverage');
		expect(scripts['test:e2e:infra']).toBe('node scripts/run-e2e-tier.mjs infra');
		expect(scripts['test:e2e:visual']).toBe('node scripts/run-e2e-tier.mjs visual');
		expect(scripts['screenshot:page']).toBeUndefined();
	});

	it('fails E2E tiers with an actionable message when Supabase env is absent', () => {
		const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-tier-preflight-'));
		const env = { ...process.env };
		delete env.SUPABASE_URL;
		delete env.SUPABASE_ANON_KEY;
		delete env.SUPABASE_SERVICE_ROLE_KEY;

		try {
			const result = fs.realpathSync(path.resolve(process.cwd(), 'scripts/run-e2e-tier.mjs'));
			const execution = spawnSync(process.execPath, [result, 'infra'], {
				cwd: fixtureRoot,
				encoding: 'utf8',
				env,
			});

			expect(execution.status).toBe(1);
			expect(execution.stderr).toContain('missing required environment variables');
			expect(execution.stderr).toContain('docs/env-workflow.md');
		} finally {
			fs.rmSync(fixtureRoot, { recursive: true, force: true });
		}
	});

	it('runs staged autofixes before corrected related tests in pre-commit', () => {
		const hook = fs.readFileSync(path.resolve(process.cwd(), '.husky/pre-commit'), 'utf8');

		expect(hook).toContain('pnpm lint-staged');
		expect(hook).toContain('pnpm test:changed');
		expect(hook.indexOf('pnpm lint-staged')).toBeLessThan(hook.indexOf('pnpm test:changed'));
		expect(hook).not.toContain('pnpm type-check');
		expect(hook).not.toContain('pnpm test\n');
	});

	it('keeps event parity on the package command only', () => {
		const scripts = readPackageManifest().scripts ?? {};
		const opsCli = fs.readFileSync(path.resolve(process.cwd(), 'scripts/cli.mjs'), 'utf8');

		expect(scripts['validate:event-parity']).toContain('scripts/validate-event-parity.ts');
		expect(opsCli).not.toContain("'validate-event-parity'");
	});

	it('keeps GitHub Actions on the canonical CI command', () => {
		const workflowPath = path.resolve(process.cwd(), '.github/workflows/commit-validation.yml');
		expect(() => fs.readFileSync(workflowPath, 'utf8')).not.toThrow();
		const workflow = fs.readFileSync(workflowPath, 'utf8');

		expect(workflow).toContain('name: Repository CI');
		expect(workflow).toContain('policy-validation:');
		expect(workflow).toContain('name: Repository Policy');
		expect(workflow).toContain('application-validation:');
		expect(workflow).toContain('name: Application Suite');
		expect(workflow).toContain('node scripts/validate-commits.mjs');
		expect(workflow).toContain('pnpm ops check-links');
		expect(workflow).toContain('pnpm validate:markdown-tables');
		expect(workflow).toContain('run: pnpm run ci');
		expect((workflow.match(/run: pnpm run ci/g) ?? []).length).toBe(1);
		expect(workflow).toContain('uses: actions/checkout@v4');
		expect(workflow).toContain('uses: pnpm/action-setup@v4');
		expect(workflow).toContain('uses: actions/setup-node@v4');
		expect(workflow).not.toContain('uses: actions/checkout@v7');
		expect(workflow).not.toContain('uses: pnpm/action-setup@v6');
		expect(workflow).not.toContain('uses: actions/setup-node@v6');
		expect(workflow).not.toMatch(/needs:\s*policy-validation/);
		expect(workflow).not.toContain('name: Validate PR Commits');
	});
});
