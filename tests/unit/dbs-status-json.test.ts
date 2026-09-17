import { describe, expect, it } from '@jest/globals';
import { buildOperationalActionPlan } from '@/lib/status/action-plan';
import { DbsStatusJsonSchema } from '@/lib/status/dbs-json';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

describe('dbs JSON contract', () => {
	it('validates canonical v3 status plus its typed operational plan', () => {
		const view = buildCanonicalStatusViewFixture();
		const parsed = DbsStatusJsonSchema.parse({
			...view,
			operationalPlan: buildOperationalActionPlan(view),
		});
		expect(parsed.schemaVersion).toBe(3);
		expect(parsed.operationalPlan.actions.length).toBeGreaterThan(0);
		expect(JSON.stringify(parsed)).not.toContain('\u001b[');
	});

	it('rejects a legacy v2 canonical payload', () => {
		const view = buildCanonicalStatusViewFixture();
		expect(() =>
			DbsStatusJsonSchema.parse({
				...view,
				schemaVersion: 2,
				operationalPlan: buildOperationalActionPlan(view),
			}),
		).toThrow();
	});
});
