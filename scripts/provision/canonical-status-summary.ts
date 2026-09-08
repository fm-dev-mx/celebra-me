/** Human summary of canonical decisions. Does not probe or classify environments. */
import {
	buildOperationalActionPlan,
	releasePromotions,
	type OperationalAction,
} from '../../src/lib/status/action-plan';
import {
	ENV_LABELS,
	SEMANTIC_LABELS,
	PUBLICATION_REASON_LABELS,
} from '../../src/lib/status/labels';
import type {
	CanonicalPromotionRow,
	CanonicalStatusView,
	EvidenceState,
	SchemaLifecycleState,
	TargetEnv,
} from '../../src/lib/status/types';
import {
	evaluateCriticalBackupHealth,
	type CriticalBackupHealth,
} from '../db/critical-backup-health';

const ENVS: readonly TargetEnv[] = ['local', 'preview', 'production'];

const SCHEMA_LABELS: Record<SchemaLifecycleState, string> = {
	CURRENT: '✓ Al día',
	BEHIND: '! Atrasado',
	SCHEMA_DRIFT: '! Divergente',
	UNVERIFIED: '? Sin verificar',
};

const EVIDENCE_LABELS: Record<EvidenceState, string> = {
	LIVE: 'En vivo',
	CACHED: 'Caché',
	UNVERIFIED: 'Sin verificar',
};

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
		if (line.length <= 100 || line.trimStart().startsWith('pnpm ')) return [line];
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
		const schema = `${SCHEMA_LABELS[row.schemaLifecycle]} ${row.appliedCount ?? '?'}/${row.expectedCount}`;
		const publication =
			row.evidence !== 'LIVE'
				? '? Sin verificar'
				: row.invitationAttentionCount
					? `${row.invitationAttentionCount} pendientes`
					: '✓ Al día';
		return `${ENV_LABELS[target].padEnd(13)}${schema.padEnd(26)}${publication.padEnd(21)}${EVIDENCE_LABELS[row.evidence]}`;
	});
}

interface SummaryItem {
	title: string;
	lines: string[];
}

/** Commands stay on their own lines so wrapping cannot corrupt a pasted invocation. */
function commandLines(inspect: string | null, apply: string | null, owner: boolean): string[] {
	const lines: string[] = [];
	if (inspect) lines.push('   Revisar:', '     ' + inspect);
	if (apply) {
		lines.push(
			`   Aplicar [${owner ? 'propietario/TTY' : 'autorización del destino'}; tras revisión]:`,
		);
		lines.push(`     ${apply}`);
	}
	if (!inspect && !apply)
		lines.push('   Revisión manual: no hay un comando canónico de corrección.');
	return lines;
}

function operationalItem(action: OperationalAction, dependentCount: number): SummaryItem {
	const suffix =
		action.id === 'schema-production' && dependentCount
			? `; bloquea ${dependentCount} invitaciones`
			: '';
	const inspect =
		action.steps.find((step) => step.type === 'Plan' && step.command) ??
		action.steps.find((step) => step.type !== 'Apply' && step.command);
	const apply = action.steps.find((step) => step.type === 'Apply' && step.command);
	return {
		title: `${action.title}: ${SEMANTIC_LABELS[action.semantic]}${suffix}`,
		lines: commandLines(
			inspect?.command ?? null,
			apply?.command ?? null,
			apply?.requiresOwner ?? false,
		),
	};
}

function publicationGroupItem(group: CanonicalPromotionRow[]): SummaryItem {
	const row = group[0];
	const target = publicationTarget(row);
	const label = target === 'registro' ? 'Registro' : ENV_LABELS[target];
	const pending = publicationStatusLabel(row) === 'Pendiente de sincronizar';
	const reason = PUBLICATION_REASON_LABELS[row.reasonCode]
		.replaceAll('Production', 'Producción')
		.replace(/\.$/, '');
	const grouped = group.length > 1;
	const inspect = publicationInspectionCommand(row);
	const apply = pending ? row.handoff.applyCommand : null;
	const template = (command: string | null) =>
		command && grouped ? command.replaceAll(`--slug ${row.slug}`, '--slug <slug>') : command;
	return {
		title: `${label}: ${group.length} invitaciones · ${publicationStatusLabel(row)}${row.preflightBlockCode ? ` (${row.preflightBlockCode})` : ''}`,
		lines: [
			...(pending ? [] : [`   ${reason}`]),
			...(grouped
				? [`   <slug>: ${group.map((item) => item.slug).join(', ')}`]
				: [`   Invitación: ${row.slug}`]),
			...commandLines(template(inspect), template(apply), row.handoff.ownerApplyRequired),
		],
	};
}

function productionBackupItem(backup: CriticalBackupHealth): SummaryItem | null {
	if (!backup.attention) return null;
	return {
		title: `Respaldo de Producción: ${backup.summary}`,
		lines: [
			'   Actualizar [respaldo y retención local; requiere autorización]:',
			'     pnpm db:prod:backup:daily',
		],
	};
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
	const items = plan.actions
		.filter((action) => action.subject === null || action.domain !== 'publication')
		.map((action) => operationalItem(action, dependent.length));
	items.push(
		...groupPublicationRows(queue.filter((row) => !dependent.includes(row))).map(
			publicationGroupItem,
		),
	);
	if (targets.includes('production')) {
		const backup = productionBackupItem(backupHealth ?? evaluateCriticalBackupHealth());
		if (backup) items.push(backup);
	}
	const lines = [
		'CELEBRA-ME · Estado de entornos',
		`Evidencia: ${view.freshnessMeta?.status ?? view.evidence} · ${view.freshnessMeta?.lastVerifiedAt ?? view.generatedAt}`,
		'─'.repeat(80),
		'Entorno      Esquema                   Publicaciones        Evidencia',
		...environmentRows(view, targets),
	];
	if (view.selectedTargets)
		lines.push(
			`No evaluados: ${ENVS.filter((env) => !targets.includes(env)).join(', ') || 'ninguno'}`,
		);
	lines.push('─'.repeat(80));
	if (items.length) {
		lines.push(`PRÓXIMOS PASOS · ${items.length} grupos de atención`);
		items.forEach((item, index) => lines.push(`${index + 1}. ${item.title}`, ...item.lines));
	} else lines.push('✓ Sin acciones pendientes en los controles evaluados.');
	if (
		targets.includes('production') &&
		view.environments.production.authorizationIntegrity === 'MISSING'
	) {
		lines.push(
			'Información: faltan registros locales de autorización; sin reparación automática (--verbose).',
		);
	}
	lines.push(
		'',
		'Detalle: pnpm dbs <slug> · Más: pnpm dbs -- --verbose · Diagnóstico: --diagnostics',
	);
	return wrapLines(lines).join('\n') + '\n';
}
