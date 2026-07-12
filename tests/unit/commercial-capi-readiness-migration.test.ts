import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
	resolve('supabase/migrations/20260711183630_commercial_capi_readiness.sql'),
	'utf8',
);

describe('commercial CAPI readiness migration', () => {
	it('keeps deposit and Purchase creation inside one row-locked function', () => {
		expect(migration).toContain('function public.register_commercial_deposit_purchase');
		expect(migration).toContain('for update;');
		expect(migration).toContain("v_order.status not in ('quoted', 'confirmed')");
		expect(migration).toContain("'purchase:' || p_order_id::text || ':deposit_paid'");
		expect(migration).toContain('on conflict (event_id) do nothing');
	});

	it('defines leases, immutable attempts, and audited recovery', () => {
		expect(migration).toContain('claim_expires_at');
		expect(migration).toContain('meta_conversion_delivery_attempts');
		expect(migration).toContain('guard_meta_conversion_attempt_update');
		expect(migration).toContain('meta_conversion_recoveries');
		expect(migration).toContain("v_event.status = 'failed'");
		expect(migration).toContain('v_event.claim_expires_at is null');
		expect(migration).toContain("'sending_legacy_no_lease'");
	});

	it('keeps sent terminal and consent skips outside the recovery allowlist', () => {
		const recoveryFunction = migration.slice(
			migration.indexOf('function public.recover_meta_conversion_event'),
		);
		expect(recoveryFunction).not.toContain("v_event.status = 'sent'");
		expect(recoveryFunction).not.toContain("'CONSENT_REQUIRED'");
	});

	it('adds reversible test classification without rewriting existing records', () => {
		expect(migration).toContain('commercial_record_classifications');
		expect(migration).toContain('revoked_at');
		expect(migration).not.toMatch(
			/update public\.(leads|customers|sales_orders)\s+set\s+.*test/iu,
		);
	});

	it('fences every completion with the active sending claim and clears claim metadata', () => {
		const finalizer = migration.slice(
			migration.indexOf('function public.finalize_meta_conversion_event'),
		);
		expect(finalizer).toContain("and status = 'sending'");
		expect(finalizer).toContain('and claim_id = p_claim_id');
		expect(finalizer).toContain('claim_id = null');
		expect(finalizer).toContain('claimed_at = null');
		expect(finalizer).toContain('claim_expires_at = null');
		expect(finalizer).toContain("p_status not in ('sent', 'failed', 'skipped', 'ambiguous')");
		expect(finalizer).toContain('CAPI claim attempt is missing or already finalized.');
	});
});
