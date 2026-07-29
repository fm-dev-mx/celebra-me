import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyStorageDownloadFailure } from '../../scripts/db/storage-object-archive';

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

	it('captures complete recovery before migration and verifies schema before code', () => {
		const workflow = read('scripts/db/push-prod-migrations.ts');
		const firstCriticalBackup = workflow.indexOf("'scripts/db/backup-critical-production.ts'");
		const preMigrationProfile = workflow.indexOf("'--integrity-profile=pre-phase3'");
		const migration = workflow.indexOf('// 7. DB Push execution');
		const contract = workflow.indexOf("'scripts/db/verify-mutation-schema-contract.ts'");
		const postMigrationBackup = workflow.lastIndexOf(
			"'scripts/db/backup-critical-production.ts'",
		);
		expect(firstCriticalBackup).toBeGreaterThan(0);
		expect(preMigrationProfile).toBeGreaterThan(firstCriticalBackup);
		expect(migration).toBeGreaterThan(preMigrationProfile);
		expect(contract).toBeGreaterThan(migration);
		expect(postMigrationBackup).toBeGreaterThan(contract);
		expect(postMigrationBackup).toBeGreaterThan(firstCriticalBackup);
	});

	it('removes incomplete critical backup output and never logs service credentials', () => {
		const workflow = read('scripts/db/backup-critical-production.ts');
		expect(workflow).toContain('rmSync(incompleteOutputDir, { recursive: true, force: true })');
		expect(workflow).not.toMatch(/console\.(?:info|log|error)\([^\n]*prodServiceRole/);
		expect(workflow).toContain('/storage/v1/object/public/');
		expect(workflow).not.toContain('/storage/v1/object/authenticated/');
		expect(workflow).not.toMatch(/failed[^\n]*object\.name|mismatch[^\n]*object\.name/);
		expect(workflow).toContain("a.deleted_at is null and a.provider = 'supabase'");
		expect(workflow).toContain('from public.published_invitation_content p');
		expect(workflow).toContain('from public.invitation_content_drafts d');
	});

	it('classifies Storage failures without retaining response details', () => {
		expect(classifyStorageDownloadFailure('{"message":"Object not found"}')).toBe('not_found');
		expect(classifyStorageDownloadFailure('{"error":"Invalid path"}')).toBe('invalid_request');
		expect(classifyStorageDownloadFailure('backend detail')).toBe('unknown');
	});
});
