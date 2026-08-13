import { describe, expect, it } from '@jest/globals';
import { buildOperationalActionPlan } from '@/lib/status/action-plan';
import { buildCanonicalStatusViewFixture } from '@tests/helpers/canonical-status-fixture';

describe('operational action plan', () => {
	it('declara verde solo con controles aplicables live y sin deuda operativa', () => {
		const base = buildCanonicalStatusViewFixture();
		const environments = Object.fromEntries(
			Object.entries(base.environments).map(([environment, row]) => [
				environment,
				{
					...row,
					schemaOperationReadiness: 'READY',
					schemaLifecycle: 'CURRENT',
					schemaNextAction: null,
					invitationAttentionCount: 0,
				},
			]),
		) as typeof base.environments;
		const manualPatches = base.manualPatches.map((patch) => ({
			...patch,
			environments: {
				local: { ...patch.environments.local },
				preview: { ...patch.environments.preview },
				production: {
					...patch.environments.production,
					status: 'NOT_NEEDED' as const,
					evidence: 'LIVE' as const,
					matchingRowCount: 0,
					reason: 'LIVE_ZERO_ROWS' as const,
				},
			},
		}));
		const plan = buildOperationalActionPlan(
			buildCanonicalStatusViewFixture({
				environments,
				disposableProof: { status: 'valid', reason: 'valid', evidence: 'LIVE' },
				promotions: [],
				manualPatches,
			}),
		);
		expect(plan.health.status).toBe('GREEN');
		expect(plan.health.label).toBe('Todo en orden');
		expect(plan.actions).toHaveLength(0);
	});

	it('trata NOT_APPLICABLE como neutral y no lo convierte en acción', () => {
		const plan = buildOperationalActionPlan(
			buildCanonicalStatusViewFixture({
				promotions: [],
				manualPatches: buildCanonicalStatusViewFixture().manualPatches.map((patch) => ({
					...patch,
					environments: {
						...patch.environments,
						production: {
							...patch.environments.production,
							status: 'NOT_NEEDED',
							matchingRowCount: 0,
							reason: 'LIVE_ZERO_ROWS',
						},
					},
				})),
			}),
		);
		expect(
			plan.actions.some(
				(action) => action.domain === 'patch' && action.environments.includes('Local'),
			),
		).toBe(false);
	});

	it('prioriza bloqueo y deduplica disposable/refresh compartidos', () => {
		const plan = buildOperationalActionPlan(buildCanonicalStatusViewFixture());
		expect(plan.health.status).toBe('ACTION_REQUIRED');
		expect(plan.actions[0]?.semantic).toBe('blocked');
		const disposable = plan.actions.filter((action) =>
			action.steps.some(
				(step) => step.command === 'pnpm db:migrate -- --target disposable-test --apply',
			),
		);
		expect(disposable).toHaveLength(1);
	});

	it('no recomienda apply cuando el parche está sin verificar o fuera de rango', () => {
		const base = buildCanonicalStatusViewFixture();
		const manualPatches = base.manualPatches.map((patch) => ({
			...patch,
			environments: {
				...patch.environments,
				production: {
					...patch.environments.production,
					status: 'UNVERIFIED' as const,
					evidence: 'UNVERIFIED' as const,
					reason: 'QUERY_TIMEOUT' as const,
					planCommand: null,
				},
			},
		}));
		const plan = buildOperationalActionPlan(
			buildCanonicalStatusViewFixture({ promotions: [], manualPatches }),
		);
		const patchAction = plan.actions.find((action) => action.domain === 'patch');
		expect(patchAction?.steps.every((step) => !step.command?.includes('--apply'))).toBe(true);
	});

	it('explica claves duplicadas en una superficie sin llamarlo conteo fuera de rango', () => {
		const base = buildCanonicalStatusViewFixture();
		const patch = base.manualPatches[0]!;
		const manualPatches = [
			{
				...patch,
				environments: {
					...patch.environments,
					production: {
						...patch.environments.production,
						status: 'BLOCKED' as const,
						reason: 'LIVE_STORE_DISAGREEMENT' as const,
						matchingRowCount: 7,
						planCommand: null,
					},
				},
			},
		];
		const plan = buildOperationalActionPlan(
			buildCanonicalStatusViewFixture({ promotions: [], manualPatches }),
		);
		const action = plan.actions.find((item) => item.domain === 'patch');

		expect(action?.summary).toContain('duplicadas');
		expect(action?.steps[0]?.prerequisite).toContain('duplicadas');
		expect(action?.verifyWhen).toContain('duplicadas');
		expect(action?.summary).not.toContain('conteo fuera del rango');
	});
});
