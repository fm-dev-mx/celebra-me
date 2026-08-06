/**
 * Presentation helpers for MigrationPlan (compact + technical).
 * Kept free of orchestrator/policy imports to avoid cycles.
 */

import type { MigrationPlan } from './migration-plan.ts';
import {
	formatKeyValueBlock,
	formatPhaseSummary,
	labelAuthRequirement,
	labelBackupRequirement,
	labelCompatibility,
	labelTarget,
	shortSha,
} from './operator-cli-ux.ts';

/** Full technical review — URLs stay redacted; hashes/executors/policy names included. */
export function formatPlanReview(plan: MigrationPlan): string {
	const pending =
		plan.pendingVersions.length === 0 ? '(ninguna)' : plan.pendingVersions.join(', ');
	const phases = formatPhaseSummary(plan.phaseByVersion, plan.pendingVersions);
	return formatKeyValueBlock('Revisión técnica del plan de migración', [
		['Entorno', labelTarget(plan.target)],
		['Modo', plan.mode],
		['Migraciones', pending],
		['Fases', phases],
		[
			'Compatibilidad',
			`${plan.compatibilityStatus} (${labelCompatibility(plan.compatibilityStatus)})`,
		],
		['Motivos', plan.compatibilityReasons.join('; ') || '(ninguno)'],
		['Respaldo', `${plan.backupRequirement}`],
		['Autorización', `${plan.authRequirement}`],
		['Ejecutor', plan.executor],
		['Verificación', plan.verificationRequirement],
		['Plan ID', plan.planId],
		['Source HEAD', plan.sourceHead],
		['Identidad', plan.redactedTargetIdentity],
		['Pin esperado', plan.expectedPin ? plan.expectedPin.join(', ') : '(derivado)'],
		[
			'Release',
			`${plan.releaseIdentity.kind}${plan.releaseIdentity.value ? `=${plan.releaseIdentity.value}` : ''}`,
		],
		['App desplegada', plan.deployedAppIdentity.sha ?? '(ninguna)'],
		['Evidencia release', plan.releaseEvidenceSha ?? '(no requerida en este modo)'],
	]);
}

/** Compact operator card — no URLs, full hashes, executors, or internal policy names. */
export function formatPlanReviewCompact(plan: MigrationPlan): string {
	const pending =
		plan.pendingVersions.length === 0 ? '(ninguna)' : plan.pendingVersions.join(', ');
	const phases = formatPhaseSummary(plan.phaseByVersion, plan.pendingVersions);
	return formatKeyValueBlock('Plan de migración', [
		['Entorno', labelTarget(plan.target)],
		['Migraciones', pending],
		['Fase / compat.', `${phases} · ${labelCompatibility(plan.compatibilityStatus)}`],
		['Respaldo', labelBackupRequirement(plan.backupRequirement)],
		['Autorización', labelAuthRequirement(plan.authRequirement)],
		['Plan', shortSha(plan.planId)],
	]);
}

/** Technical review rows for the shared owner gate. */
export function buildMigrationTechnicalReview(
	plan: MigrationPlan,
	redactedDbUrl: string,
): ReadonlyArray<readonly [string, string]> {
	const pending =
		plan.pendingVersions.length === 0 ? '(ninguna)' : plan.pendingVersions.join(', ');
	const phases = formatPhaseSummary(plan.phaseByVersion, plan.pendingVersions);
	return [
		['Impacto', 'Aplica migraciones de schema pendientes'],
		['Migraciones', pending],
		['Fases', phases],
		['Compatibilidad', plan.compatibilityStatus],
		...(plan.compatibilityReasons.length > 0
			? ([['Motivos', plan.compatibilityReasons.join('; ')]] as const)
			: []),
		['Respaldo (política)', plan.backupRequirement],
		['Autorización (política)', plan.authRequirement],
		['Ejecutor', plan.executor],
		['Verificación', plan.verificationRequirement],
		['Plan ID', plan.planId],
		['Release SHA', plan.releaseEvidenceSha ?? plan.sourceHead],
		['Destino', redactedDbUrl],
		['Pin esperado', plan.expectedPin ? plan.expectedPin.join(',') : '(derivado del dry-run)'],
		['Controles', 'TTY · agente bloqueado · release-check · backup obligatorio · sin token'],
	];
}
