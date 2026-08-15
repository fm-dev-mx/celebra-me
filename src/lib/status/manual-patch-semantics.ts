import { ENV_LABELS, PATCH_STATUS_LABELS } from './labels';
import { step, type OperatorRemediation } from './operator-remediation';
import type { ManualPatchStatus, PatchEvidenceReason, TargetEnv } from './types';

const REFRESH_COMMAND = 'pnpm dbs';

function patchPlanCommand(patch: ManualPatchStatus): string {
	const command =
		patch.environments.production.planCommand ??
		`pnpm prod:apply -- --patch ${patch.file} --apply`;
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
		LIVE_STORE_DISAGREEMENT:
			'Hay claves duplicadas en una superficie published o draft; no es seguro aplicar.',
		QUERY_FAILED: 'La consulta read-only falló.',
		QUERY_TIMEOUT: 'La consulta read-only expiró.',
		QUERY_INVALID_OUTPUT: 'La consulta devolvió una salida no verificable.',
	};
	return labels[reason];
}

function affectedRowsLabel(patch: ManualPatchStatus, environment: TargetEnv): string | null {
	const rows = patch.environments[environment].affectedRows;
	if (!rows || rows.length === 0) return null;
	return rows
		.map(
			(row) =>
				`${row.store}/${row.slug ?? row.key}${row.version === null ? '' : `@v${row.version}`}`,
		)
		.join(', ');
}

export function manualPatchRemediation(
	patch: ManualPatchStatus,
	environment: TargetEnv,
): OperatorRemediation {
	const state = patch.environments[environment];
	const environmentLabel = ENV_LABELS[environment];
	if (state.status === 'NOT_APPLICABLE') {
		return {
			semantic: 'neutral',
			meaning: `${PATCH_STATUS_LABELS.NOT_APPLICABLE}: este parche solo aplica en Producción.`,
			why: null,
			environmentLabel,
			nextAction: 'No se requiere intervención en este entorno.',
			steps: [],
			verifyWhen: 'Sigue siendo No aplica para este entorno.',
			noCanonicalRemediation: false,
		};
	}
	if (state.status === 'NOT_NEEDED') {
		return {
			semantic: 'verified',
			meaning: 'No requerido: 0 filas. Esto no demuestra que el parche fue aplicado.',
			why: patchReasonLabel(state.reason),
			environmentLabel,
			nextAction: 'No aplique el parche; conserve la evidencia de cero filas.',
			steps: [],
			verifyWhen: 'La consulta read-only sigue devolviendo 0 filas.',
			noCanonicalRemediation: false,
		};
	}
	if (state.status === 'PENDING') {
		const command = patchPlanCommand(patch);
		return {
			semantic: 'blocked',
			meaning: `Parche pendiente: ${state.matchingRowCount ?? '—'} fila(s) dentro del rango ${patch.expectedRowsMin}–${patch.expectedRowsMax}.`,
			why: patchReasonLabel(state.reason),
			environmentLabel,
			nextAction:
				'Ejecute el comando canónico. El CLI planifica, pide una confirmación Owner y aplica sobre las superficies publicadas/draft que existan.',
			steps: [
				step(
					'Apply',
					command,
					'TTY del propietario; Cancelar es el valor seguro. Un draft ausente no bloquea el published.',
					true,
					false,
					'Aplicar parche',
				),
			],
			verifyWhen: 'La consulta read-only devuelve 0 filas y evidencia LIVE.',
			noCanonicalRemediation: false,
		};
	}
	if (state.status === 'BLOCKED') {
		const lintCommand = `pnpm db:prod:patch -- --dry-run --file ${patch.file}`;
		const catalogInvalid = state.reason === 'CATALOG_INVALID';
		const storeDisagreement = state.reason === 'LIVE_STORE_DISAGREEMENT';
		const affectedRows = affectedRowsLabel(patch, environment);
		const outsideRangeMeaning =
			state.matchingRowCount === null
				? 'Conteo fuera del rango aprobado; no es seguro aplicar.'
				: `Conteo fuera del rango aprobado: ${state.matchingRowCount} fila(s), rango ${patch.expectedRowsMin}–${patch.expectedRowsMax}.`;
		return {
			semantic: 'blocked',
			meaning: catalogInvalid
				? 'Catálogo de parches inválido.'
				: storeDisagreement
					? 'Hay claves duplicadas en published o draft; no es seguro aplicar.'
					: outsideRangeMeaning,
			environmentLabel,
			nextAction: catalogInvalid
				? 'Ejecute el lint seguro del parche y corrija el catálogo antes de aplicar.'
				: storeDisagreement
					? 'No aplique el parche. Resuelva las identidades duplicadas en esa superficie.'
					: 'No aplique el parche. Audite el detector y vuelva a validar el conteo.',
			why: affectedRows
				? `${patchReasonLabel(state.reason)} Filas detectadas: ${affectedRows}.`
				: patchReasonLabel(state.reason),
			steps: catalogInvalid
				? [
						step(
							'Verify',
							lintCommand,
							'La validación es read-only y no aplica el parche.',
							false,
							false,
							'Validar catálogo',
						),
					]
				: [
						step(
							'Manual/HITL',
							null,
							storeDisagreement
								? 'No aplique hasta resolver las claves duplicadas en esa superficie.'
								: 'No aplique con un conteo fuera del rango aprobado.',
							true,
							false,
							'Revisión manual',
						),
					],
			verifyWhen: storeDisagreement
				? 'Cada superficie no tiene claves duplicadas; el conteo está dentro del rango aprobado o es 0.'
				: 'Catálogo válido y conteo dentro del rango aprobado o igual a 0.',
			noCanonicalRemediation: !catalogInvalid,
		};
	}
	return {
		semantic: 'unverified',
		meaning: 'El estado del parche no está verificado.',
		why: patchReasonLabel(state.reason),
		environmentLabel,
		nextAction:
			'Revalide evidencia en vivo. No aplique el parche mientras la consulta no sea verificable.',
		steps: [
			step(
				'Diagnose',
				REFRESH_COMMAND,
				'Consulta read-only; no ejecuta parches.',
				false,
				false,
				'Revalidar parche',
			),
		],
		verifyWhen: 'Estado PENDING, NOT_NEEDED o BLOCKED con evidencia LIVE.',
		noCanonicalRemediation: false,
	};
}
