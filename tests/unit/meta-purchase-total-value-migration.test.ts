import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
	resolve('supabase/migrations/20261026160000_meta_purchase_total_value.sql'),
	'utf8',
);
const original = readFileSync(
	resolve('supabase/migrations/20260711183630_commercial_capi_readiness.sql'),
	'utf8',
);

function depositFunction(sql: string): string {
	const match = sql.match(
		/create or replace function public\.register_commercial_deposit_purchase\([\s\S]*?\$\$;/,
	);
	if (!match) throw new Error('Deposit Purchase RPC definition is missing.');
	return match[0].replace(/\r\n/g, '\n');
}

describe('Meta Purchase total value migration (SQL contract, without database execution)', () => {
	it('changes only the new event value and conflict comparison in the existing atomic RPC', () => {
		const expected = depositFunction(original)
			.replace(
				"'deposit_paid', p_amount_paid, 'MXN', 'pending'",
				"'deposit_paid', v_order.total_amount, 'MXN', 'pending'",
			)
			.replace(
				'v_conversion.value <> p_amount_paid',
				'v_conversion.value <> v_order.total_amount',
			);
		expect(depositFunction(migration)).toBe(expected);
	});

	it('keeps the actual payment separate from the locked order total used for Purchase', () => {
		expect(migration).toMatch(
			/from public\.sales_orders\s+where id = p_order_id\s+for update;/,
		);
		expect(migration).toContain('amount_paid = p_amount_paid');
		expect(migration).toContain('p_amount_paid > v_order.total_amount');
		expect(migration).toContain("'deposit_paid', v_order.total_amount, 'MXN', 'pending'");
		expect(migration).toContain('v_conversion.value <> v_order.total_amount');
	});

	it('returns existing events before insertion without revaluing historical retries', () => {
		const rpc = depositFunction(migration);
		const retryBranch = rpc.slice(
			rpc.indexOf("if v_order.status in ('deposit_paid', 'paid')"),
			rpc.indexOf("if v_order.status not in ('quoted', 'confirmed')"),
		);
		expect(retryBranch).toContain('v_order.amount_paid <> p_amount_paid');
		expect(retryBranch).toContain('v_order.deposit_idempotency_key is distinct from v_key');
		expect(retryBranch).toContain("'idempotent', true");
		expect(retryBranch).not.toContain('v_conversion.value');
		expect(rpc).toContain("'purchase:' || p_order_id::text || ':deposit_paid'");
		expect(rpc).toContain('on conflict (event_id) do nothing');
	});

	it('only replaces the function in a transaction, preserving grants and existing outbox rows', () => {
		const outsideFunction = migration.replace(depositFunction(migration), '');
		expect(outsideFunction).toMatch(/begin;\s+commit;/);
		expect(outsideFunction).not.toMatch(/\b(update|insert|delete|grant|revoke|drop|alter)\b/i);
		expect(depositFunction(migration)).not.toMatch(/update public\.meta_conversion_events/i);
	});

	it('declares compatibility with the existing application for guarded schema rollout', () => {
		const registry = JSON.parse(
			readFileSync(resolve('supabase/migration-rollout-registry.json'), 'utf8'),
		);
		expect(registry.migrations['20261026160000'].phase).toBe('neutral');
	});
});
