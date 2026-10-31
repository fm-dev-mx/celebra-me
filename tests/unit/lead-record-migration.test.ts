import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateMigrationSqlRisk } from '../../scripts/db/migration-sql-risk';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';
import { LEAD_AD_PLATFORMS, LEAD_LOST_REASONS, LEAD_STAGES } from '@/lib/commercial/lead-record';

const version = '20261030180000';
const migrationPath = resolve(`supabase/migrations/${version}_lead_record_origin.sql`);
const migration = readFileSync(migrationPath, 'utf8');
const registry = JSON.parse(
	readFileSync(resolve('supabase/migration-rollout-registry.json'), 'utf8'),
) as MigrationRolloutRegistry;

describe('lead record migration', () => {
	it('keeps the SQL checks in sync with the application enums', () => {
		for (const value of [...LEAD_STAGES, ...LEAD_LOST_REASONS, ...LEAD_AD_PLATFORMS]) {
			expect(migration).toContain(`'${value}'`);
		}
		expect(migration).toContain("check ((stage = 'lost') = (lost_reason is not null))");
	});

	it('keeps the ad code catalog service-only', () => {
		expect(migration).toContain(
			'revoke all on table public.lead_ad_codes from public, anon, authenticated, service_role;',
		);
		expect(migration).toContain('alter table public.lead_ad_codes force row level security;');
		expect(migration).not.toMatch(/grant [^;]* to (anon|authenticated)/);
	});

	it('is an additive expand migration', () => {
		expect(migration).not.toMatch(/\bdrop\b/i);
		const result = evaluateMigrationSqlRisk({ version, registry, sqlPath: migrationPath });
		expect(result.blocked).toBe(false);
		expect(registry.migrations[version]).toMatchObject({
			phase: 'expand',
			provides: ['leads_record_origin', 'lead_ad_codes'],
		});
	});
});
