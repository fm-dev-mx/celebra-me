import type { ImportEngineResult } from './invitation-import-engine.ts';
import type { OperationalPlan } from './invitation-update-plan.ts';

export function assertEngineResult(
	result: ImportEngineResult | null | undefined,
	expectedPlanId: string | undefined,
	targetLabel: 'Preview' | 'Producción',
	requireReceipt: boolean,
): asserts result is ImportEngineResult & { plan: OperationalPlan } {
	if (!result?.plan?.planId || (expectedPlanId && result.plan.planId !== expectedPlanId)) {
		throw new Error(
			`INVALID_ENGINE_RESULT: ${targetLabel} no devolvió el plan confirmado completo.`,
		);
	}
	if (requireReceipt && (!expectedPlanId || result.receipt?.planId !== expectedPlanId)) {
		throw new Error(
			`INVALID_ENGINE_RESULT: ${targetLabel} no devolvió un recibo ligado al plan confirmado.`,
		);
	}
}
