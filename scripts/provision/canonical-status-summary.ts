/** Human summary of canonical decisions. Does not probe or classify environments. */
import {
	buildOperationalActionPlan,
	releasePromotions,
	type OperationalAction,
} from '../../src/lib/status/action-plan';
import { ENV_LABELS, SEMANTIC_LABELS } from '../../src/lib/status/labels';
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
import { useCliColor } from '../db/operator-cli-ux';
import { formatOperatorCommandLines } from './operator-command-lines';

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
function wrapLines(lines: string[]): string[] {
	return lines.flatMap((line) => {
		// eslint-disable-next-line no-control-regex
		const visible = line.replace(/\x1b\[[0-9;]*m/g, '');
		if (
			visible.length <= 100 ||
			visible.trimStart().startsWith('pnpm ') ||
			line.startsWith('     ')
		)
			return [line];
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
					? `${row.invitationAttentionCount} requieren atención`
					: '✓ Al día';
		return `${ENV_LABELS[target].padEnd(13)}${schema.padEnd(26)}${publication.padEnd(25)}${EVIDENCE_LABELS[row.evidence]}`;
	});
}

interface SummaryItem {
	title: string;
	lines: string[];
	category: 'PREPARACIÓN' | 'DESPLIEGUES' | 'ESQUEMA' | 'DATOS' | 'PUBLICACIÓN' | 'VERIFICACIÓN';
}

function summaryColors(env: NodeJS.ProcessEnv = process.env) {
	const enabled = useCliColor(env);
	return {
		command: (value: string) => (enabled ? `\x1b[1m\x1b[36m${value}\x1b[0m` : value),
	};
}

interface CommandDisplayContext {
	columns: number;
	platform: NodeJS.Platform;
	isTTY: boolean;
}

type CanonicalSummaryOptions = {
	backupHealth?: CriticalBackupHealth;
	env?: NodeJS.ProcessEnv;
	columns?: number;
	platform?: NodeJS.Platform;
	isTTY?: boolean;
};

function commandDisplayContext(options?: CanonicalSummaryOptions): CommandDisplayContext {
	return {
		columns: Math.max(40, options?.columns ?? process.stdout.columns ?? 100),
		platform: options?.platform ?? process.platform,
		isTTY: options?.isTTY ?? Boolean(process.stdout.isTTY),
	};
}

function coloredCommandLines(
	command: string,
	color: (value: string) => string,
	display: CommandDisplayContext,
): string[] {
	return formatOperatorCommandLines(command, { ...display, indent: '     ' }).map((line) => {
		const indent = line.match(/^\s*/)?.[0] ?? '';
		return indent + color(line.slice(indent.length));
	});
}

function operationalCategory(action: OperationalAction): SummaryItem['category'] {
	if (
		action.domain === 'evidence' ||
		action.domain === 'disposable' ||
		action.domain === 'readiness'
	)
		return 'PREPARACIÓN';
	if (action.domain === 'schema') return 'ESQUEMA';
	if (action.domain === 'patch') return 'DATOS';
	if (action.domain === 'publication') return 'PUBLICACIÓN';
	return 'VERIFICACIÓN';
}

function operationalItem(
	action: OperationalAction,
	dependentCount: number,
	color: (value: string) => string,
	display: CommandDisplayContext,
): SummaryItem {
	const suffix =
		action.id === 'schema-production' && dependentCount
			? `; bloquea ${dependentCount} invitaciones`
			: '';
	const deployment = action.deploymentPrerequisite;
	const stepLines = action.steps.flatMap((step) => {
		const authority = step.requiresOwner
			? ' [OWNER / TTY / HITL]'
			: step.type === 'Manual/HITL'
				? ' [HITL]'
				: '';
		const prerequisite = step.prerequisite ? [`   Requisito: ${step.prerequisite}`] : [];
		if (!step.command) {
			return [
				`   ${step.label}${authority}: revisión manual; sin comando canónico.`,
				...prerequisite,
			];
		}
		return [
			`   ${step.label}${authority}:`,
			...coloredCommandLines(step.command, color, display),
			...prerequisite,
		];
	});
	return {
		title: `${action.title}: ${SEMANTIC_LABELS[action.semantic]}${suffix}`,
		category: operationalCategory(action),
		lines: [
			...(['schema', 'patch', 'publication'].includes(action.domain)
				? [
						`   Despliegue previo: ${deployment === 'YES' ? 'Sí' : deployment === 'NO' ? 'No' : 'UNVERIFIED'}`,
					]
				: []),
			...(action.domain === 'patch'
				? [
						'   Orden relativo entre parches: UNVERIFIED (el manifest no declara dependencias).',
					]
				: []),
			...(action.why ? [`   Motivo: ${action.why}`] : []),
			...(action.deploymentStatus === 'UNVERIFIED' && action.deploymentPrerequisite === 'YES'
				? ['   Evidencia del despliegue: UNVERIFIED']
				: action.deploymentStatus === 'SATISFIED'
					? ['   Evidencia del despliegue: SATISFIED']
					: []),
			...stepLines,
			`   Verificar cuando: ${action.verifyWhen}`,
		],
	};
}

function productionBackupItem(
	backup: CriticalBackupHealth,
	color: (value: string) => string,
	display: CommandDisplayContext,
): SummaryItem | null {
	if (!backup.attention) return null;
	return {
		title: `Respaldo de Producción: ${backup.summary}`,
		category: 'PREPARACIÓN',
		lines: [
			'   Actualizar [respaldo y retención local; requiere autorización]:',
			...coloredCommandLines('pnpm db:prod:backup:daily', color, display),
		],
	};
}

function deploymentItems(
	view: CanonicalStatusView,
	targets: readonly TargetEnv[],
	color: (value: string) => string,
	display: CommandDisplayContext,
): SummaryItem[] {
	return targets.flatMap((environment) => {
		const row = view.environments[environment];
		if (
			row.pendingMigrations.length === 0 ||
			row.migrationDeployment.required === 'NO' ||
			row.migrationDeployment.status === 'SATISFIED'
		)
			return [];
		const releaseCheck = view.repositoryHeadSha
			? `pnpm ops:release-checks ${view.repositoryHeadSha}`
			: null;
		return [
			{
				category: 'DESPLIEGUES' as const,
				title: `Código · ${ENV_LABELS[environment]}: ${
					row.migrationDeployment.required === 'YES' ? 'Requerido' : 'UNVERIFIED'
				}`,
				lines: [
					`   Despliegue previo: ${
						row.migrationDeployment.required === 'YES' ? 'Sí' : 'UNVERIFIED'
					}`,
					`   Evidencia del despliegue: ${row.migrationDeployment.status}`,
					`   Motivo: ${row.migrationDeployment.reason}`,
					...(row.migrationDeployment.requiredAppCapabilities.length
						? [
								`   Capacidades: ${row.migrationDeployment.requiredAppCapabilities.join(', ')}`,
							]
						: []),
					'   Desplegar: acción humana externa; comando canónico UNVERIFIED.',
					...(releaseCheck
						? [
								'   Verificar release:',
								...coloredCommandLines(releaseCheck, color, display),
							]
						: ['   Verificar release: UNVERIFIED (Git HEAD no disponible).']),
				],
			},
		];
	});
}

const SUMMARY_CATEGORIES: readonly SummaryItem['category'][] = [
	'PREPARACIÓN',
	'DESPLIEGUES',
	'ESQUEMA',
	'DATOS',
	'PUBLICACIÓN',
	'VERIFICACIÓN',
];

function appendActionItems(lines: string[], items: SummaryItem[]): void {
	if (items.length === 0) {
		lines.push('✓ Sin acciones pendientes en los controles evaluados.');
		return;
	}
	lines.push(`PRÓXIMOS PASOS · ${items.length} operaciones requieren atención`);
	let stage = 0;
	for (const category of SUMMARY_CATEGORIES) {
		const categoryItems = items.filter((item) => item.category === category);
		if (!categoryItems.length) continue;
		stage += 1;
		lines.push(`${stage}. ${category}`);
		for (const item of categoryItems) {
			lines.push(`• ${item.title}`, ...item.lines);
		}
	}
}

export function formatCanonicalSummary(
	view: CanonicalStatusView,
	options?: CanonicalSummaryOptions,
): string {
	const colors = summaryColors(options?.env);
	const display = commandDisplayContext(options);
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
	const items = plan.actions.map((action) =>
		operationalItem(action, dependent.length, colors.command, display),
	);
	items.push(...deploymentItems(view, targets, colors.command, display));
	if (targets.includes('production')) {
		const backup = productionBackupItem(
			options?.backupHealth ?? evaluateCriticalBackupHealth(),
			colors.command,
			display,
		);
		if (backup) items.unshift(backup);
	}
	const lines = [
		'CELEBRA-ME · Estado de entornos',
		`Evidencia: ${view.freshnessMeta?.status ?? view.evidence} · ${view.freshnessMeta?.lastVerifiedAt ?? view.generatedAt}`,
		'─'.repeat(80),
		'Entorno      Esquema                   Atención                 Evidencia',
		...environmentRows(view, targets),
	];
	if (view.selectedTargets)
		lines.push(
			`No evaluados: ${ENVS.filter((env) => !targets.includes(env)).join(', ') || 'ninguno'}`,
		);
	lines.push('─'.repeat(80));
	appendActionItems(lines, items);
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
