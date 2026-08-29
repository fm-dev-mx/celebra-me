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
		expect(packageJson.scripts['test:e2e:ci']).toBe(
			'playwright test tests/e2e/landing.page.regressions.spec.ts tests/e2e/demo-routing-parity.spec.ts tests/e2e/invitation-route-isolation.spec.ts tests/e2e/envelope-reveal-interaction.spec.ts tests/e2e/p0-structural-runtime.spec.ts tests/e2e/structural-variant-portability.spec.ts --grep-invert @extended',
		);
	});

	it('keeps complete Production recovery coverage around migration', () => {
		const workflow = read('scripts/db/migrate-policy-production.ts');
		const beforeWriteIdx = workflow.indexOf('beforeWrite(plan, ctx)');
		const afterWriteIdx = workflow.indexOf('afterWrite(plan, ctx)');
		expect(workflow).toContain('evaluateHostedCompatibilityForPlan');
		expect(workflow).toContain('ensureCriticalProductionBackup');
		expect(workflow).toContain('revalidateCriticalProductionBackup');
		expect(workflow).toContain('CRITICAL_BACKUP_RPO_MS');
		expect(workflow).toContain('productionPermit: {');
		expect(workflow).not.toContain('daily-critical-production-backup');
		expect(workflow).not.toContain('assertProductionUnchangedSinceBackup');
		const sharedBackup = read('scripts/db/critical-production-backup.ts');
		expect(sharedBackup).toContain('evaluateCriticalBackupCoverage');
		expect(sharedBackup).toContain('assertCriticalBackupStructuralCoverage');
		expect(sharedBackup).toContain('BACKUP_CAPTURE_UNSTABLE');
		expect(sharedBackup).toContain("'scripts/db/backup-critical-production.ts'");
		expect(sharedBackup).toContain('inheritStderr: true');
		// Phase 3 is fully applied in Production; the stale pre-phase3 profile must not return.
		expect(workflow).not.toContain('--integrity-profile=pre-phase3');
		expect(beforeWriteIdx).toBeGreaterThan(0);
		expect(
			workflow.indexOf("runCriticalBackup(ctx.dbUrl, 'pre'", beforeWriteIdx),
		).toBeGreaterThan(beforeWriteIdx);
		expect(
			workflow.indexOf("runCriticalBackup(ctx.dbUrl, 'post'", afterWriteIdx),
		).toBeGreaterThan(afterWriteIdx);
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
		expect(workflow).toContain('removeIncompleteCriticalBackups');
		expect(workflow).toContain('wrapRecoveryIntegrityPsqlInput');
		expect(workflow).not.toMatch(/--command[\s\S]*sql/);
		expect(workflow).not.toMatch(/console\.(?:info|log|error)\([^\n]*prodServiceRole/);
		expect(workflow).toContain('STORAGE_INVENTORY_SQL');
		expect(workflow).toContain('writeBackupPhase');
		expect(workflow).toContain('BACKUP_PHASE_LABELS.dumpPublic');
		expect(workflow).toContain('Promise.all');
		expect(workflow).toContain('runCommandAsync');
		const storage = read('scripts/db/critical-backup-storage.ts');
		expect(storage).toContain('/storage/v1/object/public/');
		expect(storage).not.toContain('/storage/v1/object/authenticated/');
		expect(storage).not.toMatch(/failed[^\n]*object\.name|mismatch[^\n]*object\.name/);
		expect(storage).toContain("a.deleted_at is null and a.provider = 'supabase'");
		expect(storage).toContain('inner join storage.objects');
		expect(storage).not.toMatch(/union all/i);
		expect(storage).not.toMatch(/content\s*::\s*text\s+like/i);
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
