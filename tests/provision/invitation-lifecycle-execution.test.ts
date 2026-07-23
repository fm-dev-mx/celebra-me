import { describe, expect, it, jest } from '@jest/globals';
import {
	buildCancellationResults,
	buildPreflightBlockedResults,
	deriveLifecycleExitCode,
	deriveLifecycleFinalStatus,
	executeTargetPlans,
	type LifecycleExecutionError,
	type TargetExecutionOutcome,
} from '../../scripts/provision/invitation-lifecycle-execution.ts';
import type { InvitationUpdateTarget } from '../../scripts/provision/invitation-update-options.ts';
import type {
	TargetApplyResultData,
	TargetPlanData,
} from '../../scripts/provision/invitation-update-presenter.ts';

const zeroDb = { inserts: 0, updates: 0, deletes: 0 };
const zeroStorage = { uploads: 0, overwrites: 0, moves: 0, deletes: 0 };

function targetPlan(
	target: InvitationUpdateTarget,
	status: TargetPlanData['status'] = 'CAMBIOS PENDIENTES',
): TargetPlanData {
	return {
		target,
		planId: `${target}-plan`,
		status,
		plannedOperations: status === 'SIN CAMBIOS' ? 0 : 1,
		expectedDatabaseWrites: status === 'SIN CAMBIOS' ? zeroDb : { ...zeroDb, updates: 1 },
		expectedStorageMutations: zeroStorage,
		actions: [],
	};
}

function outcome(target: InvitationUpdateTarget): TargetExecutionOutcome {
	const planId = `${target}-plan`;
	const result: TargetApplyResultData = {
		target,
		planId,
		status: 'CAMBIOS APLICADOS',
		completedOperations: 1,
		databaseWrites: { ...zeroDb, updates: 1 },
		storageMutations: zeroStorage,
	};
	return { result, executionPlanId: planId, receiptPlanId: planId };
}

const sanitize = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

describe('managed invitation lifecycle execution integration', () => {
	it('blocks every target before execution when one preflight is unevaluated', async () => {
		const targets: InvitationUpdateTarget[] = ['local', 'preview'];
		const plans = [targetPlan('local'), targetPlan('preview', 'NO EVALUADO')];
		const execute = jest.fn<() => Promise<TargetExecutionOutcome>>();

		const result = await executeTargetPlans({
			targets,
			targetPlans: plans,
			executeTarget: execute,
			sanitizeError: sanitize,
		});

		expect(execute).not.toHaveBeenCalled();
		expect(result.executionFailed).toBe(true);
		expect(result.targetResults).toHaveLength(2);
		expect(result.targetResults.map((item) => item.status)).toEqual(['BLOQUEADO', 'BLOQUEADO']);
	});

	it('does not execute a no-change target but executes a later pending target', async () => {
		const execute = jest.fn(async (...args: [InvitationUpdateTarget, TargetPlanData]) =>
			outcome(args[0]),
		);
		const result = await executeTargetPlans({
			targets: ['local', 'preview'],
			targetPlans: [targetPlan('local', 'SIN CAMBIOS'), targetPlan('preview')],
			executeTarget: execute,
			sanitizeError: sanitize,
		});

		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute).toHaveBeenCalledWith(
			'preview',
			expect.objectContaining({ planId: 'preview-plan' }),
		);
		expect(result.targetResults.map((item) => item.status)).toEqual([
			'SIN CAMBIOS',
			'CAMBIOS APLICADOS',
		]);
	});

	it('stops later targets after failure and preserves every target result', async () => {
		const execute = jest.fn(async (...args: [InvitationUpdateTarget, TargetPlanData]) => {
			const target = args[0];
			if (target === 'preview') {
				throw Object.assign(new Error('falló publicación'), {
					recoveryStatus: 'ERROR — CAMBIOS REVERTIDOS' as const,
				}) satisfies LifecycleExecutionError;
			}
			return outcome(target);
		});
		const result = await executeTargetPlans({
			targets: ['local', 'preview', 'production'],
			targetPlans: [targetPlan('local'), targetPlan('preview'), targetPlan('production')],
			executeTarget: execute,
			sanitizeError: sanitize,
		});

		expect(execute).toHaveBeenCalledTimes(2);
		expect(result.targetResults.map((item) => item.status)).toEqual([
			'CAMBIOS APLICADOS',
			'ERROR — CAMBIOS REVERTIDOS',
			'BLOQUEADO',
		]);
	});

	it('defaults unknown post-mutation failures to manual review', async () => {
		const result = await executeTargetPlans({
			targets: ['preview'],
			targetPlans: [targetPlan('preview')],
			executeTarget: async () => {
				throw new Error('resultado incierto');
			},
			sanitizeError: sanitize,
		});
		expect(result.targetResults[0]?.status).toBe('ERROR — REQUIERE REVISIÓN');
	});

	it('classifies a known failure before mutation as blocked', async () => {
		const result = await executeTargetPlans({
			targets: ['preview'],
			targetPlans: [targetPlan('preview')],
			executeTarget: async () => {
				throw Object.assign(new Error('credenciales perdidas'), { mutationStarted: false });
			},
			sanitizeError: sanitize,
		});
		expect(result.targetResults[0]?.status).toBe('BLOQUEADO');
	});

	it('rejects a receipt or result that does not match the confirmed plan', async () => {
		const result = await executeTargetPlans({
			targets: ['preview'],
			targetPlans: [targetPlan('preview')],
			executeTarget: async () => ({ ...outcome('preview'), receiptPlanId: 'other-plan' }),
			sanitizeError: sanitize,
		});
		expect(result.executionFailed).toBe(true);
		expect(result.targetResults[0]?.status).toBe('ERROR — REQUIERE REVISIÓN');
		expect(result.targetResults[0]?.reason).toContain('INVALID_ENGINE_RESULT');
	});

	it('detects a missing target plan as mandatory preflight failure', () => {
		const result = buildPreflightBlockedResults(['local', 'preview'], [targetPlan('local')]);
		expect(result).toHaveLength(2);
		expect(result?.every((item) => item.status === 'BLOQUEADO')).toBe(true);
	});

	it('returns explicit cancellation results without executing or mutating', () => {
		const results = buildCancellationResults(
			['local', 'preview'],
			[targetPlan('local'), targetPlan('preview')],
		);
		expect(results).toHaveLength(2);
		expect(results.every((item) => item.status === 'CANCELADO POR EL OPERADOR')).toBe(true);
		expect(results.every((item) => item.completedOperations === 0)).toBe(true);
	});

	it.each([
		{
			name: 'all targets no-change',
			results: ['local', 'preview', 'production'].map((target) => ({
				...outcome(target as InvitationUpdateTarget).result,
				status: 'SIN CAMBIOS' as const,
				completedOperations: 0,
			})),
			status: 'SIN CAMBIOS',
			exitCode: 0,
		},
		{
			name: 'mixed successful apply',
			results: [outcome('local').result, outcome('preview').result],
			status: 'CAMBIOS APLICADOS',
			exitCode: 0,
		},
		{
			name: 'blocked preflight',
			results: [
				{
					...outcome('production').result,
					status: 'BLOQUEADO' as const,
					completedOperations: 0,
				},
			],
			status: 'BLOQUEADO',
			exitCode: 1,
		},
		{
			name: 'verified rollback',
			results: [
				{
					...outcome('preview').result,
					status: 'ERROR — CAMBIOS REVERTIDOS' as const,
					completedOperations: 0,
				},
			],
			status: 'ERROR — CAMBIOS REVERTIDOS',
			exitCode: 1,
		},
		{
			name: 'manual review',
			results: [
				{
					...outcome('preview').result,
					status: 'ERROR — REQUIERE REVISIÓN' as const,
					completedOperations: 0,
				},
			],
			status: 'ERROR — REQUIERE REVISIÓN',
			exitCode: 1,
		},
	])('derives final status and exit code for $name', ({ results, status, exitCode }) => {
		expect(deriveLifecycleFinalStatus(results)).toBe(status);
		expect(deriveLifecycleExitCode(results)).toBe(exitCode);
	});
});
