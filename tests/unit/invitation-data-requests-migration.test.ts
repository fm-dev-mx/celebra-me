import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
	resolve('supabase/migrations/20261026120000_invitation_data_requests.sql'),
	'utf8',
);
const registry = JSON.parse(
	readFileSync(resolve('supabase/migration-rollout-registry.json'), 'utf8'),
) as {
	migrations: Record<string, { phase: string; provides?: string[] }>;
	appCapabilities: Record<string, { requiresDbCapabilities: string[] }>;
};

describe('invitation data requests migration', () => {
	it('keeps one service-role-only request per order with a hashed token', () => {
		expect(migration).toContain('create table public.invitation_data_requests');
		expect(migration).toMatch(
			/order_id uuid not null unique references public\.sales_orders\(id\) on delete cascade/u,
		);
		expect(migration).toContain(
			"token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$')",
		);
		expect(migration).not.toMatch(/\btoken text\b/u);
		expect(migration).toContain(
			'revoke all on table public.invitation_data_requests from public, anon, authenticated, service_role;',
		);
		expect(migration).toContain(
			'alter table public.invitation_data_requests force row level security;',
		);
		expect(migration).toContain(
			'grant select, insert, update on table public.invitation_data_requests to service_role;',
		);
	});

	it('bounds the answers and ties the submitted status to its timestamp', () => {
		expect(migration).toContain("jsonb_typeof(answers) = 'object'");
		expect(migration).toContain('pg_column_size(answers) <= 32768');
		expect(migration).toContain("check (status in ('sent', 'in_progress', 'submitted'))");
		expect(migration).toContain("check ((status = 'submitted') = (submitted_at is not null))");
		expect(migration).toContain('check (expires_at > token_issued_at)');
	});

	it('widens the Meta outbox for one valueless CompleteRegistration per order', () => {
		expect(migration).toContain("'CompleteRegistration'");
		expect(migration).toContain("'invitation_data_submitted'");
		expect(migration).toMatch(
			/event_name = 'CompleteRegistration'\s+and trigger_status = 'invitation_data_submitted'\s+and order_id is not null\s+and customer_id is not null\s+and value is null/u,
		);
		// Existing shapes stay exactly as strict.
		expect(migration).toMatch(
			/event_name = 'Purchase'\s+and trigger_status = 'deposit_paid'\s+and order_id is not null\s+and customer_id is not null\s+and value is not null/u,
		);
		for (const event of ['Contact', 'Lead', 'PageView', 'ViewContent']) {
			expect(migration).toContain(`'${event}'`);
		}
	});

	it('is registered as contract and required by the deployed application', () => {
		expect(registry.migrations['20261026120000']).toMatchObject({
			phase: 'contract',
			provides: ['invitation_data_requests', 'meta_conversion_events_complete_registration'],
		});
		expect(registry.appCapabilities.invitation_data_link_client.requiresDbCapabilities).toEqual(
			['invitation_data_requests', 'meta_conversion_events_complete_registration'],
		);
	});
});
