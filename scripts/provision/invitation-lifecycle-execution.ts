import type { InvitationUpdateTarget } from './invitation-update-options.ts';
import type { TargetApplyResultData, TargetPlanData } from './invitation-update-presenter.ts';
import type { MutationOutcomeStatus } from '../../src/lib/intake/mutations/outcome.ts';

const ZERO_DATABASE_WRITES = { inserts: 0, updates: 0, deletes: 0 };
const ZERO_STORAGE_MUTATIONS = { uploads: 0, overwrites: 0, moves: 0, deletes: 0 };

export interface TargetExecutionOutcome {
	result: TargetApplyResultData;
	executionPlanId: string;
	receiptPlanId: string;
}

export interface LifecycleExecutionError extends Error {
	mutationStarted?: boolean;
	recoveryStatus?: 'ERROR — CAMBIOS REVERTIDOS' | 'ERROR — REQUIERE REVISIÓN';
	executionTotals?: Pick<
		TargetApplyResultData,
		'completedOperations' | 'databaseWrites' | 'storageMutations'
	>;
}

export interface TargetExecutionSummary {
	targetResults: TargetApplyResultData[];
	executionFailed: boolean;
}

export type LifecycleFinalStatus =
	| 'CAMBIOS APLICADOS'
	| 'SIN CAMBIOS'
	| 'BLOQUEADO'
	| 'ERROR — CAMBIOS REVERTIDOS'
	| 'ERROR — REQUIERE REVISIÓN';

export function toMutationOutcomeStatus(
	status: TargetApplyResultData['status'],
): MutationOutcomeStatus {
	if (status === 'SIN CAMBIOS') return 'replayed';
	if (status === 'CAMBIOS APLICADOS') return 'applied';
	if (status === 'ERROR — REQUIERE REVISIÓN') return 'partial';
	return 'not_applied';
}

function zeroResult(
	target: InvitationUpdateTarget,
	plan: TargetPlanData | undefined,
	status: TargetApplyResultData['status'],
	reason?: string,
): TargetApplyResultData {
	return {
		target,
		planId: plan?.planId,
		status,
		reason,
		completedOperations: 0,
		databaseWrites: { ...ZERO_DATABASE_WRITES },
		storageMutations: { ...ZERO_STORAGE_MUTATIONS },
		publishedVersion: plan?.publishedVersion,
		functionalChanges: plan?.functionalChanges,
	};
}

export function buildPreflightBlockedResults(
	targets: InvitationUpdateTarget[],
	targetPlans: TargetPlanData[],
): TargetApplyResultData[] | null {
	const blocked = targetPlans.find(
		(plan) => plan.status === 'BLOQUEADO' || plan.status === 'NO EVALUADO',
	);
	const missing = targets.find((target) => !targetPlans.some((plan) => plan.target === target));
	if (!blocked && !missing) return null;

	const blockedTarget = blocked?.target ?? missing!;
	const reason =
		blocked?.reason ?? `No se pudo construir el plan obligatorio de ${blockedTarget}.`;
	return targets.map((target) => {
		const plan = targetPlans.find((candidate) => candidate.target === target);
		return zeroResult(
			target,
			plan,
			'BLOQUEADO',
			target === blockedTarget
				? reason
				: `No se inició la mutación porque el preflight de ${blockedTarget} no concluyó correctamente.`,
		);
	});
}

export function buildCancellationResults(
	targets: InvitationUpdateTarget[],
	targetPlans: TargetPlanData[],
): TargetApplyResultData[] {
	return targets.map((target) =>
		zeroResult(
			target,
			targetPlans.find((plan) => plan.target === target),
			'CANCELADO POR EL OPERADOR',
			'Cancelado antes de cualquier mutación.',
		),
	);
}

export function deriveLifecycleFinalStatus(
	targetResults: TargetApplyResultData[],
): LifecycleFinalStatus {
	if (targetResults.some((result) => result.status === 'ERROR — REQUIERE REVISIÓN')) {
		return 'ERROR — REQUIERE REVISIÓN';
	}
	if (targetResults.some((result) => result.status === 'ERROR — CAMBIOS REVERTIDOS')) {
		return 'ERROR — CAMBIOS REVERTIDOS';
	}
	if (targetResults.some((result) => result.status === 'BLOQUEADO')) return 'BLOQUEADO';
	if (targetResults.every((result) => result.status === 'SIN CAMBIOS')) return 'SIN CAMBIOS';
	return 'CAMBIOS APLICADOS';
}

export function deriveLifecycleExitCode(targetResults: TargetApplyResultData[]): 0 | 1 {
	return targetResults.some((result) =>
		['BLOQUEADO', 'ERROR — CAMBIOS REVERTIDOS', 'ERROR — REQUIERE REVISIÓN'].includes(
			result.status,
		),
	)
		? 1
		: 0;
}

function validateOutcome(
	plan: TargetPlanData,
	outcome: TargetExecutionOutcome | null | undefined,
): TargetApplyResultData {
	if (
		!outcome ||
		!plan.planId ||
		outcome.executionPlanId !== plan.planId ||
		outcome.receiptPlanId !== plan.planId ||
		outcome.result.planId !== plan.planId
	) {
		throw Object.assign(
			new Error(
				'INVALID_ENGINE_RESULT: El motor no devolvió ejecución, recibo y resultado ligados al plan confirmado.',
			),
			{ mutationStarted: true },
		);
	}
	return outcome.result;
}

function classifyFailure(
	target: InvitationUpdateTarget,
	plan: TargetPlanData | undefined,
	error: unknown,
	sanitizeError: (error: unknown) => string,
): TargetApplyResultData {
	const lifecycleError = error as LifecycleExecutionError;
	if (lifecycleError?.mutationStarted === false) {
		return zeroResult(target, plan, 'BLOQUEADO', sanitizeError(error));
	}
	const status =
		lifecycleError?.recoveryStatus === 'ERROR — CAMBIOS REVERTIDOS'
			? 'ERROR — CAMBIOS REVERTIDOS'
			: 'ERROR — REQUIERE REVISIÓN';
	const result = zeroResult(target, plan, status, sanitizeError(error));
	if (lifecycleError?.executionTotals) {
		result.completedOperations = lifecycleError.executionTotals.completedOperations;
		result.databaseWrites = lifecycleError.executionTotals.databaseWrites;
		result.storageMutations = lifecycleError.executionTotals.storageMutations;
	}
	return result;
}

export async function executeTargetPlans(input: {
	targets: InvitationUpdateTarget[];
	targetPlans: TargetPlanData[];
	executeTarget: (
		target: InvitationUpdateTarget,
		plan: TargetPlanData,
	) => Promise<TargetExecutionOutcome | null | undefined>;
	sanitizeError: (error: unknown) => string;
}): Promise<TargetExecutionSummary> {
	const preflightBlocked = buildPreflightBlockedResults(input.targets, input.targetPlans);
	if (preflightBlocked) return { targetResults: preflightBlocked, executionFailed: true };

	const targetResults: TargetApplyResultData[] = [];
	let executionFailed = false;
	for (const target of input.targets) {
		const plan = input.targetPlans.find((candidate) => candidate.target === target)!;
		if (plan.status === 'SIN CAMBIOS') {
			targetResults.push(zeroResult(target, plan, 'SIN CAMBIOS'));
			continue;
		}
		try {
			const outcome = await input.executeTarget(target, plan);
			targetResults.push(validateOutcome(plan, outcome));
		} catch (error) {
			executionFailed = true;
			targetResults.push(classifyFailure(target, plan, error, input.sanitizeError));
			break;
		}
	}

	for (const target of input.targets) {
		if (targetResults.some((result) => result.target === target)) continue;
		const plan = input.targetPlans.find((candidate) => candidate.target === target);
		targetResults.push(
			zeroResult(
				target,
				plan,
				'BLOQUEADO',
				'No se ejecutó porque falló un entorno anterior en el orden de promoción.',
			),
		);
	}

	return { targetResults, executionFailed };
}
