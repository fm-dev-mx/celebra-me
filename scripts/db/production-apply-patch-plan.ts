import {
	extractSupabaseProjectRef,
	getSecretFromEnvOrFiles,
	PROD_SECRET_FILES,
} from './db-target-config.ts';
import { OperatorError } from './operator-cli-ux.ts';
import {
	inspectProductionPatchPreview,
	prepareProductionPatchFile,
	type PreparedProductionPatch,
} from './run-prod-patch.ts';
import type { ProductionPatchPreviewAssessment } from './production-patch-preview.ts';
import type { ProductionApplyPlanItem } from './production-apply-plan.ts';

export interface ProductionApplyPatchPlanDeps {
	preparePatch?: typeof prepareProductionPatchFile;
	getProductionDbUrl?: () => { url: string };
	inspectPatchPreview?: (prepared: PreparedProductionPatch) => ProductionPatchPreviewAssessment;
}

function resolveReadOnlyProductionDbUrl(): { url: string } {
	const url = getSecretFromEnvOrFiles('PROD_DB_URL', PROD_SECRET_FILES);
	if (!url) {
		throw new OperatorError({
			title: 'Credenciales de Production no verificables',
			cause: 'PROD_DB_URL no está disponible para la preconsulta LIVE.',
			code: 'PRODUCTION_CREDENTIALS_UNAVAILABLE',
			remediation: ['Configure PROD_DB_URL y vuelva a ejecutar el plan read-only.'],
		});
	}
	return { url };
}

function patchPreviewRows(assessment: ProductionPatchPreviewAssessment) {
	return (
		assessment.evidence.rows?.map((row) => {
			const selectedSlug = row.row?.slug;
			const slug = typeof selectedSlug === 'string' ? selectedSlug : null;
			const selectedVersion = row.row?.version;
			const version =
				typeof selectedVersion === 'number' &&
				Number.isSafeInteger(selectedVersion) &&
				selectedVersion >= 0
					? selectedVersion
					: null;
			return { store: row.store, key: row.key, slug, version };
		}) ?? null
	);
}

function projectRefForDbUrl(dbUrl: string): string | null {
	try {
		return extractSupabaseProjectRef(dbUrl);
	} catch {
		return null;
	}
}

function patchPreviewDetail(input: {
	assessment: ProductionPatchPreviewAssessment;
	min: number;
	max: number;
	verifiedAt: string;
	projectRef: string | null;
}): string {
	const keys = input.assessment.evidence.keysByStore
		? Object.entries(input.assessment.evidence.keysByStore)
				.map(([store, values]) => `${store}=[${values.join(', ')}]`)
				.join('; ')
		: 'claves no disponibles';
	return `LIVE ${input.assessment.evidence.total} filas · rango ${input.min}-${input.max} · ${keys} · verificado ${input.verifiedAt} · proyecto ${input.projectRef ?? 'desconocido'}`;
}

export function inspectPatch(
	file: string | undefined,
	deps: ProductionApplyPatchPlanDeps,
): ProductionApplyPlanItem | null {
	if (!file) return null;
	try {
		const prepared = (deps.preparePatch ?? prepareProductionPatchFile)(file);
		const verifiedAt = new Date().toISOString();
		const dbUrl = (deps.getProductionDbUrl ?? resolveReadOnlyProductionDbUrl)().url;
		const assessment = (
			deps.inspectPatchPreview ?? ((input) => inspectProductionPatchPreview(input, dbUrl))
		)(prepared);
		const expectedRowsMin = Number(prepared.manifest['expected-rows-min']);
		const expectedRowsMax = Number(prepared.manifest['expected-rows-max']);
		const patchPreview = {
			state: assessment.state,
			reason: assessment.reason,
			total: assessment.evidence.total,
			expectedRowsMin,
			expectedRowsMax,
			keysByStore: assessment.evidence.keysByStore,
			affectedRows: patchPreviewRows(assessment),
			verifiedAt,
			projectRef: projectRefForDbUrl(dbUrl),
		};
		const detail = patchPreviewDetail({
			assessment,
			min: expectedRowsMin,
			max: expectedRowsMax,
			verifiedAt,
			projectRef: patchPreview.projectRef,
		});
		if (assessment.state === 'NOT_NEEDED') {
			return {
				domain: 'patch',
				id: file,
				readiness: 'IN_SYNC',
				summary: 'Parche no requerido: la vista previa LIVE devolvió 0 filas.',
				binding: prepared.fingerprint,
				detail,
				patchPreview,
			};
		}
		if (assessment.state === 'BLOCKED') {
			return {
				domain: 'patch',
				id: file,
				readiness: 'BLOCKED',
				summary: 'Vista previa LIVE fuera del contrato aprobado.',
				detail,
				blockCode:
					assessment.reason === 'STORE_DISAGREEMENT'
						? 'PATCH_PREVIEW_STORE_DISAGREEMENT'
						: 'PATCH_PREVIEW_ROW_COUNT_MISMATCH',
				binding: prepared.fingerprint,
				patchPreview,
			};
		}
		return {
			domain: 'patch',
			id: file,
			readiness: 'READY',
			summary: `Parche LIVE aplicable: ${assessment.evidence.total} filas dentro del rango aprobado ${expectedRowsMin}-${expectedRowsMax}.`,
			binding: prepared.fingerprint,
			detail,
			patchPreview,
		};
	} catch (error) {
		const code =
			error && typeof error === 'object' && 'code' in error
				? String((error as { code?: string }).code ?? 'PATCH_PREVIEW_FAILED')
				: 'PATCH_PREVIEW_FAILED';
		return {
			domain: 'patch',
			id: file,
			readiness: 'UNKNOWN',
			summary: 'No fue posible inspeccionar el parche LIVE de forma segura.',
			detail: `Preflight LIVE no verificable (${code}).`,
			blockCode: code,
		};
	}
}
