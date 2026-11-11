import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateMigrationSqlRisk } from '../../scripts/db/migration-sql-risk.ts';

const migration = readFileSync(
	resolve('supabase/migrations/20261110130000_order_lifecycle_payments.sql'),
	'utf8',
).replace(/\r\n/g, '\n');

function fn(name: string): string {
	const match = migration.match(
		new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`),
	);
	if (!match) throw new Error(`${name} definition is missing.`);
	return match[0];
}

describe('order lifecycle payments migration (SQL contract, without database execution)', () => {
	it('adds the event date and the payment ledger', () => {
		expect(migration).toMatch(
			/alter table public\.sales_orders\s+add column if not exists event_date date/,
		);
		// No if not exists: the initial revoke must never strip grants from a pre-existing table.
		expect(migration).toContain('create table public.sales_order_payments (');
		expect(migration).not.toContain('create table if not exists public.sales_order_payments');
		expect(migration).toContain("check (kind in ('deposit', 'installment', 'settlement'))");
		expect(migration).toMatch(/amount\s+numeric\(12, 2\) not null check \(amount > 0\)/);
		expect(migration).toMatch(/idempotency_key\s+text not null unique/);
	});

	it('keeps the ledger service-role only with forced row level security', () => {
		expect(migration).toContain(
			'alter table public.sales_order_payments enable row level security',
		);
		expect(migration).toContain(
			'alter table public.sales_order_payments force row level security',
		);
		expect(migration).toMatch(
			/revoke all on table public\.sales_order_payments from public, anon, authenticated, service_role/,
		);
		expect(migration).toMatch(
			/grant select on table public\.sales_order_payments to service_role/,
		);
		expect(migration).not.toMatch(
			/grant [a-z, ]*(insert|update|delete)[a-z, ]* on table public\.sales_order_payments/,
		);
	});

	it('allows one deposit and one settlement per order', () => {
		expect(migration).toMatch(/unique index[^;]*\(order_id\)\s+where kind = 'deposit'/);
		expect(migration).toMatch(/unique index[^;]*\(order_id\)\s+where kind = 'settlement'/);
	});

	it('backfills a deposit row for orders that already hold one', () => {
		expect(migration).toContain("'backfill-deposit:'");
		expect(migration).toMatch(/status in \('deposit_paid', 'paid'\)/);
	});

	it('moves the order to paid only when the balance is covered', () => {
		const rpc = fn('register_commercial_order_payment');
		expect(rpc).toContain('for update');
		expect(rpc).toContain("v_order.status <> 'deposit_paid'");
		expect(rpc).toContain("'settlement'");
		expect(rpc).toContain("'installment'");
		expect(rpc).toContain(
			"status = case when v_kind = 'settlement' then 'paid' else status end",
		);
		expect(rpc).toContain("'idempotent', true");
		expect(rpc).toContain('ya se usó con datos diferentes');
		expect(rpc).not.toContain('meta_conversion_events');
	});

	it('records the deposit in the ledger without changing the Purchase value', () => {
		const rpc = fn('register_commercial_deposit_purchase');
		expect(rpc).toContain('insert into public.sales_order_payments');
		expect(rpc).toContain("'deposit:' || v_key");
		expect(rpc).toContain("'deposit_paid', v_order.total_amount, 'MXN', 'pending'");
		expect(rpc).toContain(
			"set status = case when p_amount_paid >= total_amount then 'paid' else 'deposit_paid' end",
		);
	});

	it('restricts the new payment function to the service role and keeps the deposit one as is', () => {
		expect(migration).toMatch(
			/revoke all on function public\.register_commercial_order_payment\([^)]*\)\s+from public, anon, authenticated/,
		);
		expect(migration).toMatch(
			/grant execute on function public\.register_commercial_order_payment\([^)]*\)\s+to service_role/,
		);
		// create or replace keeps the existing privileges of the deposit function.
		expect(migration).not.toMatch(
			/(grant|revoke)[^;]*function public\.register_commercial_deposit_purchase/,
		);
	});

	it('is registered as a contract migration because it revokes on the objects it creates', () => {
		const registry = JSON.parse(
			readFileSync(resolve('supabase/migration-rollout-registry.json'), 'utf8'),
		);
		const entry = registry.migrations['20261110130000'];
		expect(entry.phase).toBe('contract');
		expect(entry.revokes.length).toBeGreaterThan(0);
		expect(entry.requiresDeployedAppCapabilities).toBeUndefined();
		expect(evaluateMigrationSqlRisk({ version: '20261110130000', registry }).blocked).toBe(
			false,
		);
	});
});
