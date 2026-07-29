import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string): string {
	return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('Phase 3 operational contracts', () => {
	it('keeps canonical Playwright in the foreground and isolated by default', () => {
		const config = read('playwright.config.ts');
		expect(config).toContain("env: { ASTRO_DEV_BACKGROUND: '1' }");
		expect(config).toContain(
			"reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true'",
		);
		const packageJson = JSON.parse(read('package.json')) as {
			scripts: Record<string, string>;
		};
		expect(packageJson.scripts['test:e2e:ci']).toContain(
			'tests/e2e/envelope-reveal-interaction.spec.ts',
		);
		expect(packageJson.scripts['test:e2e:ci']).toContain('--grep-invert @extended');
	});

	it('verifies schema before code and captures complete recovery after migration', () => {
		const workflow = read('scripts/db/push-prod-migrations.ts');
		const preBackup = workflow.indexOf("'scripts/db/backup-prod.ts'");
		const migration = workflow.indexOf('// 7. DB Push execution');
		const contract = workflow.indexOf("'scripts/db/verify-mutation-schema-contract.ts'");
		const criticalBackup = workflow.lastIndexOf("'scripts/db/backup-critical-production.ts'");
		expect(preBackup).toBeGreaterThan(0);
		expect(migration).toBeGreaterThan(preBackup);
		expect(contract).toBeGreaterThan(migration);
		expect(criticalBackup).toBeGreaterThan(contract);
	});

	it('removes incomplete critical backup output and never logs service credentials', () => {
		const workflow = read('scripts/db/backup-critical-production.ts');
		expect(workflow).toContain('rmSync(incompleteOutputDir, { recursive: true, force: true })');
		expect(workflow).not.toMatch(/console\.(?:info|log|error)\([^\n]*prodServiceRole/);
	});
});
