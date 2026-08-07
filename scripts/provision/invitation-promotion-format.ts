import { formatKeyValueBlock, shortSha } from '../db/operator-cli-ux.ts';
import type { PromotionApplyReport, PromotionPreflightReport } from './invitation-promote.ts';

type PromotionReport = PromotionPreflightReport | PromotionApplyReport;

/**
 * The preflight report retains the connection string only for the in-process
 * apply flow. CLI/operator artifacts must never serialize it.
 */
export function toPublicPromotionReport(
	report: PromotionPreflightReport | PromotionApplyReport,
): Omit<PromotionPreflightReport | PromotionApplyReport, 'targetDbUrl'> {
	const { targetDbUrl: _targetDbUrl, ...publicReport } = report;
	return publicReport;
}

function changeSummary(report: PromotionReport): string {
	const plan = report.engineResult?.plan;
	if (!plan) return '(no disponible)';
	const database = plan.physicalDatabaseOps;
	const storage = plan.storageOps;
	return [
		`${report.divergence.safeManagedChanges.length} funcional(es)`,
		`DB ${database.inserts + database.updates + database.deletes}`,
		`Storage ${storage.uploads + storage.overwrites + storage.moves + storage.deletes}`,
	].join(' · ');
}

function backupLabel(report: PromotionReport): string {
	if (!report.backup.required) return 'Se evaluará antes de escribir';
	if (!report.backup.acceptable) return 'Bloqueado';
	return report.backup.createdAt ? `Verificado · ${report.backup.createdAt}` : 'Verificado';
}

export function formatPromotionPlanCompact(
	report: PromotionReport,
	options: { title?: string; route?: string; deliveryScope?: string } = {},
): string {
	return formatKeyValueBlock('Plan de promoción', [
		['Entorno', 'Production'],
		['Invitación', options.title ?? report.engineResult?.plan.invitationTitle ?? report.slug],
		['Ruta', options.route ?? report.approval?.route ?? report.slug],
		['Estado', report.status],
		['Aprobación Preview', report.approval?.approvedAt ?? '(no verificada)'],
		['Schema', report.schema.state],
		['Scope', options.deliveryScope ?? '(según release)'],
		['Cambios', changeSummary(report)],
		['Respaldo', backupLabel(report)],
		['Plan', shortSha(report.engineResult?.plan.planId)],
	]);
}

export function buildPromotionTechnicalReview(
	report: PromotionReport,
): ReadonlyArray<readonly [string, string]> {
	const plan = report.engineResult?.plan;
	return [
		['Impacto', 'Escribe únicamente estado administrado de release en Production'],
		['Slug', report.slug],
		['Package hash', report.packageHash],
		['Source hash', report.sourceHash],
		['Projection hash', report.projectionHash],
		['Asset manifest hash', report.assetManifestHash],
		['Plan ID', plan?.planId ?? '(no disponible)'],
		['Project ref', report.productionProjectRef ?? '(no disponible)'],
		['Schema', `${report.schema.state} · ${report.schema.detail}`],
		['Respaldo', report.backup.detail],
		[
			'Diferencias',
			`managed=${report.divergence.safeManagedChanges.length} · target-owned=${report.divergence.targetOwnedDifferences.length} · drift=${report.divergence.managedDivergences.length} · conflicts=${report.divergence.conflicts.length}`,
		],
		[
			'Controles',
			`TTY · agente bloqueado · release-check · ${
				report.backup.required ? 'backup crítico' : 'recuperación por procedencia/preimagen'
			} · plan exacto · sin migraciones`,
		],
	];
}

export function formatPromotionResult(report: PromotionApplyReport): string {
	const verification = report.verification;
	return formatKeyValueBlock('Resultado de promoción', [
		['Invitación', report.slug],
		['Estado', report.status],
		['Plan', shortSha(report.applyResult?.plan.planId ?? report.engineResult?.plan.planId)],
		['Operaciones', String(report.applyResult?.executedMutations ?? 0)],
		['Versión publicada', String(report.applyResult?.publishedVersion ?? '(n/a)')],
		['Verificación', verification?.ok ? 'Aprobada' : 'Fallida'],
		['Detalle', verification?.detail ?? report.reason ?? '(sin detalle)'],
	]);
}
