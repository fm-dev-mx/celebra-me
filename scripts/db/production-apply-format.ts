/**
 * Spanish operator presentation for pnpm prod:apply.
 * Never include URLs, credentials, or raw connection strings.
 */
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
	const reason = item.detail ? ` — ${item.detail}` : '';
	return `${item.domain}:${item.id}  ${readinessLabel(item.readiness)}${extra}${reason}`;
}

export function formatProductionApplyPlan(plan: ProductionApplyPlan): string {
	const mutations = mutationItemsOf(plan);
	const rows: Array<readonly [string, string]> = [
		['Entorno', 'Production'],
		['Plan', shortSha(plan.planId)],
		['Mutaciones', String(mutations.length)],
		['Alcance', plan.scope.inspectAll ? 'inspección (sin apply)' : describeScope(plan)],
	];
	const lines = [formatKeyValueBlock('Plan Production (solo lectura)', rows)];
	for (const item of plan.items) {
		if (item.readiness === 'NOT_APPLICABLE') continue;
		lines.push(itemLine(item));
	}
	lines.push('');
	lines.push(`${operatorSymbol('info')} ${productionApplyHandoff(plan)}`);
	if (mutations.length > 0 && !plan.scope.inspectAll) {
		lines.push(
			`${operatorSymbol('info')} Para aplicar: pnpm prod:apply -- ${describeScope(plan)} --apply`,
		);
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
		items: plan.items.map((item) => ({ ...item })),
	};
}
