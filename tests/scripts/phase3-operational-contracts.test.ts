import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyStorageDownloadFailure } from '../../scripts/db/storage-object-archive';

function read(relativePath: string): string {
	return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('Phase 3 operational contracts', () => {
	it('keeps canonical Playwright in the foreground and isolated by default', () => {
		const config = read('playwright.config.ts');
		expect(config).toContain("ASTRO_DEV_BACKGROUND: '1'");
		expect(config).toContain('SUPABASE_URL: localSupabaseUrl');
		expect(config).toContain('PUBLIC_SUPABASE_URL: localPublicSupabaseUrl');
		expect(config).toContain('LOCAL_SUPABASE_URL');
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
		const workflow = read('scripts/db/migrate-policy-production.ts');
		const beforeWriteIdx = workflow.indexOf('beforeWrite(plan, ctx)');
		const authorizeIdx = workflow.indexOf('async authorize(plan, ctx)');
		const migration = workflow.indexOf("['db', 'push', '--db-url', ctx.dbUrl, '--yes']");
		const afterWriteIdx = workflow.indexOf('afterWrite(plan, ctx)');
		const contract = workflow.indexOf("runMutationContractVerify('production')", afterWriteIdx);
		const postBackup = workflow.indexOf("runCriticalBackup(ctx.dbUrl, 'post'", afterWriteIdx);
		expect(workflow).toContain('evaluateHostedCompatibilityForPlan');
		expect(workflow).toContain('evaluateCriticalBackupReuse');
		expect(workflow).toContain('assertProductionUnchangedSinceBackup');
		expect(workflow).toContain("'scripts/db/backup-critical-production.ts'");
		expect(workflow).not.toContain('daily-critical-production-backup');
		// Phase 3 is fully applied in Production; the stale pre-phase3 profile must not return.
		expect(workflow).not.toContain('--integrity-profile=pre-phase3');
		expect(beforeWriteIdx).toBeGreaterThan(0);
		expect(workflow.indexOf("runCriticalBackup(ctx.dbUrl, 'pre'", beforeWriteIdx)).toBeGreaterThan(
			beforeWriteIdx,
		);
		expect(authorizeIdx).toBeGreaterThan(beforeWriteIdx);
		expect(workflow.indexOf('assertPreBackupCoverageBeforeAuthorize', authorizeIdx)).toBeGreaterThan(
			authorizeIdx,
		);
		expect(migration).toBeGreaterThan(authorizeIdx);
		expect(afterWriteIdx).toBeGreaterThan(migration);
		expect(contract).toBeGreaterThan(afterWriteIdx);
		expect(postBackup).toBeGreaterThan(contract);
	});

	it('wires Preview migrate through dry-run and the compatibility gate', () => {
		const workflow = read('scripts/db/migrate-policy-preview.ts');
		expect(workflow).toContain('executeSupabaseDryRun');
		expect(workflow).toContain('evaluateHostedCompatibilityForPlan');
		expect(workflow).toContain('runMutationContractVerify');
		expect(workflow).toContain('slug: PREVIEW_MIGRATE_AUTH_SLUG');
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

	it('keeps daily Production backup local and outside ordinary validation', () => {
		const packageJson = JSON.parse(read('package.json')) as {
			scripts: Record<string, string>;
		};
		const daily = packageJson.scripts['db:prod:backup:daily'];
		expect(daily).toContain('db-guard.ts check --target production --operation backup');
		expect(daily).toContain('daily-critical-production-backup.ts');
		expect(packageJson.scripts.ci).not.toContain('db:prod:backup');
		expect(packageJson.scripts.build).not.toContain('db:prod:backup');

		const workflow = read('scripts/db/daily-critical-production-backup.ts');
		expect(workflow).toContain('estimatedMonthlyEgressBytes');
		expect(workflow).toContain('manifestVerified: true');
		expect(workflow).toContain('planCriticalBackupRetention');
		expect(workflow).not.toContain('vercel');
	});
});
