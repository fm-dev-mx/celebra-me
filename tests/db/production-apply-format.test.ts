import { describe, expect, it } from '@jest/globals';
import {
	formatProductionApplyPlan,
	formatProductionApplyResult,
	toPublicProductionApplyPlan,
} from '../../scripts/db/production-apply-format.ts';
import type { ProductionApplyPlan } from '../../scripts/db/production-apply-plan.ts';

function plan(overrides: Partial<ProductionApplyPlan> = {}): ProductionApplyPlan {
	return {
		planId: 'abcdef0123456789deadbeef',
		scope: {
			schema: true,
			slugs: ['america-johana'],
			allReady: false,
			inspectAll: false,
		},
		items: [
			{
				domain: 'schema',
				id: 'schema',
				readiness: 'READY',
				summary: 'Pendientes: 20260812210000',
				pendingVersions: ['20260812210000'],
				binding: 'schema-binding',
			},
			{
				domain: 'invitation',
				id: 'america-johana',
				readiness: 'IN_SYNC',
				summary: 'Production already matches',
				packageHash: 'pkghash0123456789',
				preflight: {
					targetDbUrl: 'postgresql://postgres:super-secret@db.example/postgres',
				},
			},
			{
				domain: 'invitation',
				id: 'blocked-slug',
				readiness: 'BLOCKED',
				summary: 'Missing approval',
				detail: 'MISSING_PREVIEW_APPROVAL',
				blockCode: 'MISSING_PREVIEW_APPROVAL',
			},
		],
		...overrides,
	} as ProductionApplyPlan;
}

describe('production apply presentation', () => {
	it('groups READY / IN_SYNC / BLOCKED and never prints URLs or secrets', () => {
		const rendered = formatProductionApplyPlan(plan());
		expect(rendered).toMatch(/Listo/);
		expect(rendered).toMatch(/En sync/);
		expect(rendered).toMatch(/Bloqueado/);
		expect(rendered).toMatch(/prod:apply/);
		expect(rendered).toContain('--schema --slug america-johana --apply');
		expect(rendered).not.toMatch(/postgres(ql)?:\/\//i);
		expect(rendered).not.toContain('super-secret');
	});

	it('formats apply outcomes without leaking connection strings', () => {
		const rendered = formatProductionApplyResult({
			plan: plan(),
			outcomes: [
				{ id: 'schema', outcome: 'APPLIED_AND_VERIFIED', detail: '20260812210000' },
				{ id: 'america-johana', outcome: 'already_applied' },
			],
		});
		expect(rendered).toContain('schema: APPLIED_AND_VERIFIED');
		expect(rendered).not.toMatch(/postgres(ql)?:\/\//i);
	});

	it('strips preflight from the public plan', () => {
		const publicPlan = toPublicProductionApplyPlan(plan());
		expect(publicPlan.items.find((item) => item.id === 'america-johana')).not.toHaveProperty(
			'preflight',
		);
		expect(JSON.stringify(publicPlan)).not.toContain('super-secret');
	});
});
