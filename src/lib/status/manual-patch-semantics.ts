import { ENV_LABELS, PATCH_STATUS_LABELS } from './labels';
import { step, type OperatorRemediation } from './semantics';
import type {
	ManualPatchStatus,
	PatchEvidenceReason,
	TargetEnv,
} from './types';

const REFRESH_COMMAND = 'pnpm dbs';

function patchPlanCommand(patch: ManualPatchStatus): string {
	const command = patch.environments.production.planCommand ?? `pnpm prod:apply -- --patch ${patch.file} --owner-user-id <uuid>`;
	return command.replace('<file>', patch.file);
}

function patchReasonLabel(reason: PatchEvidenceReason): string {
	const labels: Record<PatchEvidenceReason, string> = {
		CATALOG_VALID: 'Catálogo válido.',
		CATALOG_INVALID: 'El catálogo o el manifest no es válido.',
		ENVIRONMENT_NOT_TARGET: 'Este entorno no es destino del parche.',
		ENVIRONMENT_NOT_PROBED: 'El entorno aún no fue consultado.',
		LIVE_ZERO_ROWS: 'La consulta en vivo devolvió cero filas.',
		LIVE_ROWS_WITHIN_RANGE: 'La consulta en vivo devolvió filas dentro del rango aprobado.',
		LIVE_ROWS_OUTSIDE_RANGE: 'La consulta en vivo devolvió filas fuera del rango aprobado.',
		QUERY_FAILED: 'La consulta read-only falló.',
		QUERY_TIMEOUT: 'La consulta read-only expiró.',
		QUERY_INVALID_OUTPUT: 'La consulta devolvió una salida no verificable.',
	};
	return labels[reason];
}

export function manualPatchRemediation(patch: ManualPatchStatus, environment: TargetEnv): OperatorRemediation {
	const state = patch.environments[environment];
	const environmentLabel = ENV_LABELS[environment];
	if (state.status === 'NOT_APPLICABLE') {
		return { semantic: 'neutral', meaning: `${PATCH_STATUS_LABELS.NOT_APPLICABLE}: este parche solo aplica en Producción.`, why: null, environmentLabel, nextAction: 'No se requiere intervención en este entorno.', steps: [], verifyWhen: 'Sigue siendo No aplica para este entorno.', noCanonicalRemediation: false };
	}
	if (state.status === 'NOT_NEEDED') {
		return { semantic: 'verified', meaning: 'No requerido: 0 filas. Esto no demuestra que el parche fue aplicado.', why: patchReasonLabel(state.reason), environmentLabel, nextAction: 'No aplique el parche; conserve la evidencia de cero filas.', steps: [], verifyWhen: 'La consulta read-only sigue devolviendo 0 filas.', noCanonicalRemediation: false };
	}
	if (state.status === 'PENDING') {
		const command = patchPlanCommand(patch);
		return { semantic: 'blocked', meaning: `Parche pendiente: ${state.matchingRowCount ?? '—'} fila(s) dentro del rango ${patch.expectedRowsMin}–${patch.expectedRowsMax}.`, why: patchReasonLabel(state.reason), environmentLabel, nextAction: 'Planifique el apply y ejecútelo con autorización Owner/HITL.', steps: [step('Plan', command, 'Dry-run read-only y revisión Owner.', true, false, 'Planificar parche'), step('Apply', `${command} --apply`, 'Plan revisado; requiere TTY del propietario.', true, false, 'Aplicar parche')], verifyWhen: 'La consulta read-only devuelve 0 filas y evidencia LIVE.', noCanonicalRemediation: false };
	}
	if (state.status === 'BLOCKED') {
		const lintCommand = `pnpm db:prod:patch -- --dry-run --file ${patch.file}`;
		const catalogInvalid = state.reason === 'CATALOG_INVALID';
		return { semantic: 'blocked', meaning: catalogInvalid ? 'Catálogo de parches inválido.' : 'Conteo fuera del rango aprobado; no es seguro aplicar.', why: patchReasonLabel(state.reason), environmentLabel, nextAction: catalogInvalid ? 'Ejecute el lint seguro del parche y corrija el catálogo antes de aplicar.' : 'No aplique el parche. Audite el detector y vuelva a validar el conteo.', steps: catalogInvalid ? [step('Verify', lintCommand, 'La validación es read-only y no aplica el parche.', false, false, 'Validar catálogo')] : [step('Manual/HITL', null, 'No aplique con un conteo fuera del rango aprobado.', true, false, 'Revisión manual')], verifyWhen: 'Catálogo válido y conteo dentro del rango aprobado o igual a 0.', noCanonicalRemediation: !catalogInvalid };
	}
	return { semantic: 'unverified', meaning: 'El estado del parche no está verificado.', why: patchReasonLabel(state.reason), environmentLabel, nextAction: 'Revalide evidencia en vivo. No aplique el parche mientras la consulta no sea verificable.', steps: [step('Diagnose', REFRESH_COMMAND, 'Consulta read-only; no ejecuta parches.', false, false, 'Revalidar parche')], verifyWhen: 'Estado PENDING, NOT_NEEDED o BLOCKED con evidencia LIVE.', noCanonicalRemediation: false };
}
