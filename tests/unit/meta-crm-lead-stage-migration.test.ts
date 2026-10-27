import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateMigrationSqlRisk } from '../../scripts/db/migration-sql-risk';
import type { MigrationRolloutRegistry } from '../../scripts/db/migration-deployment-compatibility';

const version = '20261026180000';
const migrationPath = resolve(`supabase/migrations/${version}_meta_crm_lead_stages.sql`);
const migration = readFileSync(migrationPath, 'utf8');
const invitationDataMigration = readFileSync(
	resolve('supabase/migrations/20261026130000_invitation_data_requests.sql'),
	'utf8',
);
const disposableTestRunner = readFileSync(resolve('scripts/db/disposable-test-env.ts'), 'utf8');
const registry = JSON.parse(
	readFileSync(resolve('supabase/migration-rollout-registry.json'), 'utf8'),
) as MigrationRolloutRegistry;

describe('Meta CRM lead-stage migration', () => {
	it('keeps CRM stage rows free of order, customer, value or route data', () => {
		for (const [eventName, trigger] of [
			['LeadQuoted', 'crm_lead_quoted'],
			['LeadPaid', 'crm_lead_paid'],
			['LeadLost', 'crm_lead_lost'],
		]) {
			expect(migration).toContain(`event_name = '${eventName}'`);
			expect(migration).toContain(`trigger_status = '${trigger}'`);
		}
		// The existing FK uses ON DELETE SET NULL, so a check must not block lead deletion.
		expect(migration).not.toContain('lead_id is not null');
		expect(migration).toContain('order_id is null');
		expect(migration).toContain('customer_id is null');
		expect(migration).toContain('value is null');
		expect(migration).toContain('event_source_path is null');
	});

	it('retains only terminal browser and CRM rows for 30 days', () => {
		const purge = migration.slice(
			migration.indexOf('function public.purge_meta_conversion_retention'),
		);
		expect(purge).toContain("'LeadQuoted', 'LeadPaid', 'LeadLost'");
		expect(purge).toContain("e.status in ('sent', 'skipped')");
		expect(purge).toContain('e.created_at < v_events_cutoff');
		expect(purge).toContain('meta_conversion_recoveries');
		expect(purge).not.toContain("'Purchase'");
	});

	it('keeps CompleteRegistration in every outbox check replaced by the CRM migration', () => {
		for (const [constraint, preservedValue] of [
			['meta_conversion_events_event_name_check', 'CompleteRegistration'],
			['meta_conversion_events_trigger_status_check', 'invitation_data_submitted'],
			['meta_conversion_events_source_shape_check', 'CompleteRegistration'],
		]) {
			const start = migration.indexOf(`add constraint ${constraint}`);
			const end = migration.indexOf('\n\n', start);
			const check = migration.slice(start, end < 0 ? undefined : end);
			expect(start).toBeGreaterThanOrEqual(0);
			expect(check).toContain(preservedValue);
			expect(invitationDataMigration).toContain(preservedValue);
		}
		expect(migration).toContain("trigger_status = 'invitation_data_submitted'");
		expect(migration).toContain('order_id is not null');
		expect(migration).toContain('customer_id is not null');
		expect(migration).toContain('value is null');
	});

	it('includes the combined event insert proof in disposable pgTAP runs', () => {
		expect(disposableTestRunner).toContain("'invitation_data_requests.test.sql'");
		expect(disposableTestRunner).toContain("'meta_conversion_event_compatibility.test.sql'");
	});

	it('registers the constraint widening as a contract migration', () => {
		const result = evaluateMigrationSqlRisk({ version, registry, sqlPath: migrationPath });
		expect(result.risk.isDestructive).toBe(true);
		expect(result.blocked).toBe(false);
		expect(registry.migrations[version]).toMatchObject({
			phase: 'contract',
			provides: ['meta_conversion_events_crm_lead_stages'],
			requiresDeployedAppCapabilities: ['meta_capi_view_events_client'],
		});
	});
});
