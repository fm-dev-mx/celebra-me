/**
 * Spanish operator presentation for pnpm prod:apply.
 * Never include URLs, credentials, or raw connection strings.
 */
import {
	displayOperatorCommand,
	operatorCommandWriteLabel,
} from '../../src/lib/status/operator-command-display.ts';
import { formatKeyValueBlock, operatorSymbol, shortSha } from './operator-cli-ux.ts';
import {
	mutationItemsOf,
	productionApplyHandoff,
	type ProductionApplyItemOutcome,
	type ProductionApplyPlan,
	type ProductionApplyPlanItem,
	type ProductionApplyReadiness,
} from './production-apply-plan.ts';

function readinessLabel(readiness: ProductionApplyReadiness): string {
	switch (readiness) {
		case 'READY':
			return 'READY';
		case 'READY_AFTER_SCHEMA':
			return 'READY (después de schema)';
		case 'READY_AFTER_DISCARD':
			return 'READY (requiere descartar borrador inédito)';
		case 'IN_SYNC':
			return 'IN_SYNC';
		case 'BLOCKED':
			return 'BLOCKED';
		case 'UNKNOWN':
			return 'UNKNOWN';
		case 'NOT_APPLICABLE':
			return 'N/A';
	}
}

function itemLine(item: ProductionApplyPlanItem): string {
	const extra = item.pendingVersions?.length
		? ` · ${item.pendingVersions.join(', ')}`
		: item.packageHash
			? ` · pkg ${shortSha(item.packageHash)}`
			: '';
	const code = item.blockCode ? ` [${item.blockCode}]` : '';
	const reason = item.detail ? ` — ${item.detail}` : '';
	return `${item.domain}:${item.id}  ${readinessLabel(item.readiness)}${extra}${code}${reason}`;
}

const READINESS_GROUPS: ReadonlyArray<{
	readiness: ProductionApplyReadiness;
	label: string;
}> = [
	{ readiness: 'READY', label: 'Listo' },
	{ readiness: 'READY_AFTER_SCHEMA', label: 'Listo después de schema' },
	{ readiness: 'READY_AFTER_DISCARD', label: 'Listo (requiere descartar borrador inédito)' },
	{ readiness: 'IN_SYNC', label: 'En sync' },
	{ readiness: 'BLOCKED', label: 'Bloqueado' },
	{ readiness: 'UNKNOWN', label: 'Desconocido' },
];

function invitationCountsLine(plan: ProductionApplyPlan): string | null {
	const invitations = plan.items.filter((item) => item.domain === 'invitation');
	const archived = plan.excluded?.archivedSlugs.length ?? 0;
	const authoring = plan.excluded?.authoringSlugs?.length ?? 0;
	if (invitations.length === 0 && archived === 0 && authoring === 0) return null;
	const parts = READINESS_GROUPS.map(({ readiness }) => ({
		readiness,
		count: invitations.filter((item) => item.readiness === readiness).length,
	}))
		.filter(({ count }) => count > 0)
		.map(({ readiness, count }) => `${count} ${readiness}`);
	if (archived > 0) {
		parts.push(
			`${archived} archivada${archived === 1 ? '' : 's'} (excluida${archived === 1 ? '' : 's'})`,
		);
	}
	if (authoring > 0) {
		parts.push(`${authoring} en authoring (excluida${authoring === 1 ? '' : 's'})`);
	}
	return parts.join(' · ');
}

function excludedDefinitionLines(plan: ProductionApplyPlan): string[] {
	const lines: string[] = [];
	const archivedSlugs = plan.excluded?.archivedSlugs ?? [];
	if (archivedSlugs.length > 0) {
		lines.push(
			'',
			`${operatorSymbol('info')} Archivadas por decisión del propietario (fuera del plan): ${archivedSlugs.join(', ')}`,
			'  Para revisar una archivada: pnpm prod:apply -- --slug <slug>',
		);
	}
	const authoringSlugs = plan.excluded?.authoringSlugs ?? [];
	if (authoringSlugs.length > 0) {
		lines.push(
			'',
			`${operatorSymbol('info')} En authoring (lifecycle in_progress, solo Local): ${authoringSlugs.join(', ')}`,
			"  Para publicarlas: lifecycle: 'published' en su definición + candidato visual aceptado.",
		);
	}
	return lines;
}

export function formatProductionApplyPlan(plan: ProductionApplyPlan): string {
	const mutations = mutationItemsOf(plan);
	const rows: Array<readonly [string, string]> = [
		['Entorno', 'Production'],
		['Plan', shortSha(plan.planId)],
		['Mutaciones', String(mutations.length)],
		['Alcance', plan.scope.inspectAll ? 'inspección (sin apply)' : describeScope(plan)],
	];
	const counts = invitationCountsLine(plan);
	if (counts) rows.push(['Invitaciones', counts]);
	const lines = [formatKeyValueBlock('Plan Production (solo lectura)', rows)];
	const visible = plan.items.filter((item) => item.readiness !== 'NOT_APPLICABLE');
	for (const group of READINESS_GROUPS) {
		const grouped = visible.filter((item) => item.readiness === group.readiness);
		if (grouped.length === 0) continue;
		lines.push('');
		const mark =
			group.readiness === 'BLOCKED'
				? 'fail'
				: group.readiness === 'UNKNOWN'
					? 'warn'
					: group.readiness === 'IN_SYNC'
						? 'ok'
						: 'info';
		lines.push(`${operatorSymbol(mark)} ${group.label}`);
		for (const item of grouped) {
			lines.push(`  ${itemLine(item)}`);
		}
	}
	lines.push(...excludedDefinitionLines(plan));
	lines.push('');
	lines.push(`${operatorSymbol('info')} ${productionApplyHandoff(plan)}`);
	if (mutations.length > 0 && !plan.scope.inspectAll) {
		const discardAck = mutations.some((item) => item.readiness === 'READY_AFTER_DISCARD')
			? ' --acknowledge-discard-unpublished-draft'
			: '';
		const applyCommand = `pnpm prod:apply -- ${describeScope(plan)}${discardAck} --apply`;
		const display = displayOperatorCommand(applyCommand);
		lines.push(`${operatorSymbol('info')} Para aplicar:`);
		if (display.keepFullCommand) {
			lines.push(`  ${applyCommand}`);
		} else {
			lines.push(`  Task: ${display.task}`);
			lines.push(`  Escribir: ${operatorCommandWriteLabel(display)}`);
		}
	}
	lines.push(
		`${operatorSymbol('info')} Sin --apply no hay escrituras. Enter no autoriza Production.`,
	);
	return lines.join('\n');
}

function describeScope(plan: ProductionApplyPlan): string {
	if (plan.scope.allReady) return '--all-ready';
	const parts: string[] = [];
	if (plan.scope.schema) parts.push('--schema');
	if (plan.scope.slugs.length === 1) parts.push(`--slug ${plan.scope.slugs[0]}`);
	else if (plan.scope.slugs.length > 1) parts.push(`--slugs ${plan.scope.slugs.join(',')}`);
	if (plan.scope.patchFile) parts.push(`--patch ${plan.scope.patchFile}`);
	return parts.join(' ') || '(ninguno)';
}

export function formatProductionApplyResult(input: {
	plan: ProductionApplyPlan;
	outcomes: ReadonlyArray<{ id: string; outcome: ProductionApplyItemOutcome; detail?: string }>;
}): string {
	const lines = [
		formatKeyValueBlock('Resultado Production', [
			['Entorno', 'Production'],
			['Plan', shortSha(input.plan.planId)],
		]),
	];
	for (const row of input.outcomes) {
		lines.push(`${row.id}: ${row.outcome}${row.detail ? ` — ${row.detail}` : ''}`);
	}
	return lines.join('\n');
}

export function toPublicProductionApplyPlan(plan: ProductionApplyPlan): ProductionApplyPlan {
	return {
		planId: plan.planId,
		scope: { ...plan.scope, slugs: [...plan.scope.slugs] },
		excluded: {
			archivedSlugs: [...(plan.excluded?.archivedSlugs ?? [])],
			authoringSlugs: [...(plan.excluded?.authoringSlugs ?? [])],
		},
		items: plan.items.map((item) => {
			const { preflight: _preflight, ...rest } = item;
			return rest;
		}),
	};
}
