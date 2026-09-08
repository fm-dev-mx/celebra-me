/** Human summary of canonical decisions. Does not probe or classify environments. */
import { buildOperationalActionPlan, releasePromotions } from '../../src/lib/status/action-plan';
import {
	ENV_LABELS,
	SEMANTIC_LABELS,
	PUBLICATION_REASON_LABELS,
} from '../../src/lib/status/labels';
import type {
	CanonicalPromotionRow,
	CanonicalStatusView,
	TargetEnv,
} from '../../src/lib/status/types';
import {
	evaluateCriticalBackupHealth,
	type CriticalBackupHealth,
} from '../db/critical-backup-health';

const ENVS: readonly TargetEnv[] = ['local', 'preview', 'production'];

export function publicationStatusLabel(row: CanonicalPromotionRow): string {
	if (row.action === 'BLOCKED') return 'Bloqueado';
	if (row.action === 'UNKNOWN') return 'Sin verificar';
	if (!row.destination || row.envEvidence[row.destination] !== 'LIVE') return 'Sin verificar';
	if (row.source === 'preview' && row.envEvidence.preview !== 'LIVE') return 'Sin verificar';
	return 'Pendiente de sincronizar';
}

/** Read-only inspection for a canonical handoff; never changes the handoff JSON. */
export function publicationInspectionCommand(row: CanonicalPromotionRow): string | null {
	if (row.handoff.dryRunCommand && !row.handoff.dryRunCommand.split(/\s+/).includes('--apply'))
		return row.handoff.dryRunCommand;
	if (
		(row.action === 'PROMOTE_PREVIEW' || row.action === 'PROMOTE_PRODUCTION') &&
		row.destination
	) {
		return `pnpm invitation:release -- --slug ${row.slug} --targets ${row.destination} --dry-run`;
	}
	return null;
}
function publicationTarget(row: CanonicalPromotionRow): TargetEnv | 'registro' {
	if (
		row.reasonCode === 'PRODUCTION_PREFLIGHT_BLOCKED' ||
		row.reasonCode === 'PRODUCTION_PREFLIGHT_UNVERIFIED'
	)
		return 'production';
	return row.destination ?? 'registro';
}

/** Group only equal canonical codes, target, evidence and state; never error prose. */
export function groupPublicationRows(rows: CanonicalPromotionRow[]): CanonicalPromotionRow[][] {
	const groups = new Map<string, CanonicalPromotionRow[]>();
	for (const row of rows) {
		const key = JSON.stringify([
			publicationTarget(row),
			row.action,
			row.reasonCode,
			row.preflightBlockCode,
			publicationStatusLabel(row),
			row.environments,
			row.envEvidence,
			row.reasonCode === 'PRODUCTION_PREFLIGHT_BLOCKED' && !row.preflightBlockCode
				? row.slug
				: null,
		]);
		const group = groups.get(key) ?? [];
		group.push(row);
		groups.set(key, group);
	}
	return [...groups.values()];
}

function wrapLines(lines: string[]): string[] {
	return lines.flatMap((line) => {
		if (line.length <= 100) return [line];
		const leadingIndent = line.match(/^\s*/)?.[0] ?? '';
		const continuationIndent = leadingIndent || '  ';
		const words = line.trimStart().split(' ');
		const result: string[] = [];
		let current = '';
		for (const word of words) {
			if (!current) {
				current = leadingIndent + word;
				continue;
			}
			if (current.length + word.length + 1 > 100 && current.trim()) {
				result.push(current.trimEnd());
				current = continuationIndent + word;
			} else {
				current += ' ' + word;
			}
		}
		if (current.trim()) result.push(current.trimEnd());
		return result;
	});
}

function environmentRows(view: CanonicalStatusView, targets: readonly TargetEnv[]): string[] {
	return targets.map((target) => {
		const row = view.environments[target];
		const schema = `${row.schemaLifecycle} ${row.appliedCount ?? '?'}/${row.expectedCount}`;
		const publication =
			row.evidence !== 'LIVE'
				? 'Sin verificar'
				: `${row.invitationAttentionCount} pendientes`;
		return `${ENV_LABELS[target].padEnd(13)}${schema.padEnd(25)}${publication.padEnd(23)}${row.evidence}`;
	});
}

function productionWarnings(
	view: CanonicalStatusView,
	backupHealth?: CriticalBackupHealth,
): string[] {
	const lines: string[] = [];
	const backup = backupHealth ?? evaluateCriticalBackupHealth();
	if (backup.attention)
		lines.push(`- Respaldo de Producción: ${backup.summary}. Detalles: --verbose.`);
	if (view.environments.production.authorizationIntegrity === 'MISSING')
		lines.push(
			'- Autorización: faltan registros locales del propietario (informativo; detalles: --verbose).',
		);
	return lines;
}

function publicationGroupLines(group: CanonicalPromotionRow[]): string[] {
	const row = group[0];
	const target = publicationTarget(row);
	const label = target === 'registro' ? 'Registro' : ENV_LABELS[target];
	const reason = PUBLICATION_REASON_LABELS[row.reasonCode]
		.replaceAll('Production', 'Producción')
		.replace(/\.$/, '');
	return [
		`- ${label}: ${group.length} invitaciones · ${publicationStatusLabel(row)} · ${reason}${row.preflightBlockCode ? ` (${row.preflightBlockCode})` : ''}.`,
		`  Inspeccionar: pnpm dbs ${row.slug}${target === 'registro' ? '' : ` --targets ${target}`}${row.handoff.ownerApplyRequired ? ' · Aplicación: propietario/TTY' : ''}`,
	];
}

export function formatCanonicalSummary(
	view: CanonicalStatusView,
	backupHealth?: CriticalBackupHealth,
): string {
	const targets = view.selectedTargets ?? ENVS;
	const plan = buildOperationalActionPlan(view);
	const queue = releasePromotions(view.promotions);
	const dependent = queue.filter(
		(row) =>
			targets.includes('production') &&
			row.action === 'BLOCKED' &&
			row.reasonCode === 'PRODUCTION_PREFLIGHT_BLOCKED' &&
			row.preflightBlockCode === 'SCHEMA_INCOMPATIBLE' &&
			plan.actions.some((action) => action.id === 'schema-production'),
	);
	const lines = [
		'CELEBRA-ME · Estado operativo',
		`Evidencia: ${view.freshnessMeta?.status ?? view.evidence} · ${view.freshnessMeta?.lastVerifiedAt ?? view.generatedAt}`,
		'',
		'Entorno      Esquema                  Publicaciones          Evidencia',
		...environmentRows(view, targets),
	];
	if (view.selectedTargets)
		lines.push(
			`No evaluados: ${ENVS.filter((env) => !targets.includes(env)).join(', ') || 'ninguno'}`,
		);
	lines.push('', 'Requiere atención:');
	for (const action of plan.actions.filter(
		(action) => action.subject === null || action.domain !== 'publication',
	)) {
		const suffix =
			action.id === 'schema-production' && dependent.length
				? `; bloquea ${dependent.length} invitaciones`
				: '';
		lines.push(`- ${action.title}: ${SEMANTIC_LABELS[action.semantic]}${suffix}.`);
		const next = action.steps.find((step) => step.command && step.type !== 'Apply');
		lines.push(
			`  Revisar: ${next?.command ?? 'pnpm dbs -- --verbose'}${action.steps.some((step) => step.requiresOwner) ? ' · Aplicación: propietario/TTY' : ''}`,
		);
	}
	lines.push(
		...groupPublicationRows(queue.filter((row) => !dependent.includes(row))).flatMap(
			publicationGroupLines,
		),
	);
	if (!plan.actions.length && !queue.length)
		lines.push('  No hay acciones pendientes en los controles evaluados.');
	if (targets.includes('production')) lines.push(...productionWarnings(view, backupHealth));
	lines.push(
		'',
		'Detalle: pnpm dbs <slug> · Listado completo: --verbose · Causas técnicas: --diagnostics',
	);
	return wrapLines(lines).join('\n') + '\n';
}
