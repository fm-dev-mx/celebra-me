/**
 * invitation-update-presenter.ts — Spanish Terminal Presenter for Managed Invitation CLI
 *
 * Formats status reports, dry-run plans, apply confirmations, and execution results
 * into clear, user-friendly Spanish terminal output without raw object dumps.
 */

import type { FunctionalChange } from './invitation-update-plan.ts';

const useColor = (): boolean => {
	if (process.env.NO_COLOR || !process.stdout.isTTY) return false;
	return true;
};

const colors = {
	cyan: (str: string) => (useColor() ? `\x1b[36m${str}\x1b[0m` : str),
	green: (str: string) => (useColor() ? `\x1b[32m${str}\x1b[0m` : str),
	yellow: (str: string) => (useColor() ? `\x1b[33m${str}\x1b[0m` : str),
	red: (str: string) => (useColor() ? `\x1b[31m${str}\x1b[0m` : str),
	bold: (str: string) => (useColor() ? `\x1b[1m${str}\x1b[0m` : str),
	dim: (str: string) => (useColor() ? `\x1b[2m${str}\x1b[0m` : str),
};

export interface StatusReportData {
	filters: { slug: string | null; targets: string[] };
	definitions: Array<{
		slug: string;
		title: string;
		createdAt: string;
		classification: string;
		environments: Record<
			string,
			{ status: string; managedStatus?: string; syncStatus?: string; reason?: string }
		>;
	}>;
	inventory?: Record<
		string,
		{
			verified: boolean;
			rows: Array<{
				slug: string;
				status: string;
				hasProvenance?: boolean;
				assetComplete?: boolean;
			}>;
		}
	>;
	readiness?: {
		verdict: string;
		reasons: string[];
		details: Record<string, boolean | string | null>;
	};
}

function formatDbWrites(writes: { inserts: number; updates: number; deletes: number }): string {
	const ins = `${writes.inserts} ${writes.inserts === 1 ? 'inserción' : 'inserciones'}`;
	const upd = `${writes.updates} ${writes.updates === 1 ? 'actualización' : 'actualizaciones'}`;
	const del = `${writes.deletes} ${writes.deletes === 1 ? 'eliminación' : 'eliminaciones'}`;
	return `${ins}, ${upd}, ${del}`;
}

function formatStorageMutations(mutations: {
	uploads: number;
	overwrites: number;
	moves?: number;
	deletes: number;
}): string {
	const upl = `${mutations.uploads} ${mutations.uploads === 1 ? 'subida' : 'subidas'}`;
	const ovr = `${mutations.overwrites} ${mutations.overwrites === 1 ? 'sobrescritura' : 'sobrescrituras'}`;
	const mov =
		mutations.moves !== undefined
			? `, ${mutations.moves} ${mutations.moves === 1 ? 'movimiento' : 'movimientos'}`
			: '';
	const del = `${mutations.deletes} ${mutations.deletes === 1 ? 'eliminación' : 'eliminaciones'}`;
	return `${upl}, ${ovr}${mov}, ${del}`;
}

function resolveManagedText(managed: string): string {
	switch (managed) {
		case 'MANAGED':
			return colors.green('Registrada');
		case 'UNAPPLIED_DEFINITION':
			return colors.yellow('Sin registrar (Falta provenance)');
		case 'NOT_PRESENT':
			return colors.dim('No registrada');
		default:
			return colors.dim('Sin verificar');
	}
}

function resolveSyncText(sync: string): string {
	switch (sync) {
		case 'IN_SYNC':
			return colors.green('En sincronía');
		case 'DRIFT':
			return colors.yellow('Con deriva');
		case 'BLOCKED':
			return colors.red('Bloqueada');
		case 'FAILED':
			return colors.red('Fallida');
		default:
			return colors.dim('No evaluada');
	}
}

function formatEnvironmentStatus(
	target: string,
	defSlug: string,
	envInfo:
		| { status: string; managedStatus?: string; syncStatus?: string; reason?: string }
		| undefined,
	inventoryLocal:
		| { verified: boolean; rows: Array<{ slug: string; status: string }> }
		| undefined,
): string {
	let localRowStatus: string | undefined;
	if (target === 'local' && inventoryLocal?.verified) {
		const row = inventoryLocal.rows.find((r) => r.slug === defSlug);
		localRowStatus = row ? row.status : 'NOT_PRESENT';
	}
	const managed = envInfo?.managedStatus ?? localRowStatus ?? envInfo?.status ?? 'UNVERIFIED';
	const sync =
		envInfo?.syncStatus ??
		(envInfo?.status === 'IN_SYNC'
			? 'IN_SYNC'
			: envInfo?.status === 'DRIFT'
				? 'DRIFT'
				: 'UNEVALUATED');

	return `   Estado en ${colors.bold(target)}:\n     Estado administrado : ${resolveManagedText(managed)}\n     Sincronización      : ${resolveSyncText(sync)}`;
}

function formatReadinessDetails(readiness: NonNullable<StatusReportData['readiness']>): string[] {
	const lines: string[] = [];
	const verdictColor =
		readiness.verdict === 'READY'
			? colors.green
			: readiness.verdict === 'NO-GO'
				? colors.yellow
				: colors.red;
	lines.push(`   Evaluación Integridad: ${verdictColor(readiness.verdict)}`);
	lines.push(
		`     - Trazabilidad Provenance : ${readiness.details.hasProvenance ? colors.green('Sí') : colors.yellow('No')}`,
	);
	lines.push(
		`     - Archivos de Storage     : ${readiness.details.storageBinaryVerified ? colors.green('Verificados') : colors.yellow('Incompletos / Sin verificar')}`,
	);
	lines.push(
		`     - Fotografía Hero         : ${readiness.details.heroValid ? colors.green('Válida') : colors.yellow('Pendiente')}`,
	);
	lines.push(
		`     - Mapas Ubicación         : ${readiness.details.mapsValid ? colors.green('Válidos') : colors.yellow('Pendientes')}`,
	);

	if (readiness.reasons.length > 0) {
		lines.push('   Observaciones / Desviaciones:');
		for (const reason of readiness.reasons) {
			lines.push(`     • ${colors.yellow(reason)}`);
		}
	}
	return lines;
}

export function formatStatusReport(data: StatusReportData): string {
	const lines: string[] = [];
	lines.push(colors.bold(colors.cyan('=== Estado de Invitaciones Administradas ===')));
	lines.push('');

	if (data.filters.slug) {
		lines.push(`Filtro de Invitación : ${colors.bold(data.filters.slug)}`);
	}
	lines.push(`Entornos Seleccionados : ${data.filters.targets.join(', ')}`);
	lines.push('');

	if (data.definitions.length === 0) {
		lines.push(
			colors.yellow(
				'No se encontraron definiciones de invitación para el filtro especificado.',
			),
		);
		return lines.join('\n');
	}

	for (const def of data.definitions) {
		lines.push(`📌 ${colors.bold(def.title)} (${colors.dim(def.slug)})`);
		lines.push(`   Definición Canónica : Encontrada (Creada: ${def.createdAt.slice(0, 10)})`);

		for (const target of data.filters.targets) {
			lines.push(
				formatEnvironmentStatus(
					target,
					def.slug,
					def.environments[target],
					data.inventory?.local,
				),
			);
		}

		if (data.readiness && data.filters.slug === def.slug) {
			lines.push(...formatReadinessDetails(data.readiness));
		}
		lines.push('');
	}

	return lines.join('\n');
}

export interface TargetPlanData {
	target: string;
	planId?: string;
	status:
		| 'CAMBIOS PENDIENTES'
		| 'SIN CAMBIOS'
		| 'NO EVALUADO'
		| 'BLOQUEADO'
		| 'CAMBIOS APLICADOS'
		| 'ERROR — CAMBIOS REVERTIDOS'
		| 'ERROR — REQUIERE REVISIÓN';
	reason?: string;
	plannedOperations: number;
	expectedDatabaseWrites: { inserts: number; updates: number; deletes: number };
	expectedStorageMutations: {
		uploads: number;
		overwrites: number;
		moves?: number;
		deletes: number;
	};
	actions: Array<{ resource: string; name: string; action: string; detail: string }>;
	functionalChanges?: OperationalPlanData['functionalChanges'];
	publishedVersion?: number;
	mergeConflicts?: Array<{
		path: string;
		previousCanonicalValue: unknown;
		packageValue: unknown;
		targetValue: unknown;
	}>;
}

export interface OperationalPlanData {
	planId?: string;
	invitation: string;
	targets: string[];
	isZeroDrift: boolean;
	plannedOperations: number;
	expectedDatabaseWrites: { inserts: number; updates: number; deletes: number };
	expectedStorageMutations: {
		uploads: number;
		overwrites: number;
		moves?: number;
		deletes: number;
	};
	actions: Array<{ resource: string; name: string; action: string; detail: string }>;
	functionalChanges?: FunctionalChange[];
	publishedVersion?: number;
	targetPlans?: TargetPlanData[];
}

export function formatTargetsSpanish(targets: string[]): string {
	const labels = targets.map((t) =>
		t === 'local' ? 'Local' : t === 'preview' ? 'Preview' : t === 'production' ? 'Producción' : t,
	);
	if (labels.length === 0) return '';
	if (labels.length === 1) return labels[0]!;
	if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
	return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`;
}

export function consolidateTargetFunctionalChanges(
	targetPlans: TargetPlanData[],
): OperationalPlanData['functionalChanges'] {
	if (!targetPlans || targetPlans.length === 0) return [];
	const map = new Map<string, NonNullable<OperationalPlanData['functionalChanges']>[number]>();

	for (const tp of targetPlans) {
		if (!tp.functionalChanges) continue;
		for (const change of tp.functionalChanges) {
			const key = `${change.scope}:${change.operation}:${change.section}:${change.field ?? change.entity}:${String(change.newValue ?? '')}`;
			const existing = map.get(key);
			if (!existing) {
				const entry = {
					...change,
					targets: [tp.target],
					targetPreviousValues: { [tp.target]: change.previousValue },
				};
				map.set(key, entry);
			} else {
				if (!existing.targets?.includes(tp.target)) {
					existing.targets?.push(tp.target);
				}
				if (existing.targetPreviousValues) {
					existing.targetPreviousValues[tp.target] = change.previousValue;
				}
			}
		}
	}

	return Array.from(map.values());
}

// eslint-disable-next-line complexity -- Formats all functional change categories for CLI output.
export function formatFunctionalChanges(
	changes?: OperationalPlanData['functionalChanges'],
): string[] {
	if (!changes || changes.length === 0) return [];
	const lines: string[] = [];

	const updates = changes.filter((c) => c.operation === 'update');
	const inserts = changes.filter((c) => c.operation === 'insert');
	const deletes = changes.filter((c) => c.operation === 'delete' && c.scope === 'database');
	const moves = changes.filter((c) => c.operation === 'move');
	const uploads = changes.filter((c) => c.operation === 'upload');
	const overwrites = changes.filter((c) => c.operation === 'overwrite');
	const storageDeletes = changes.filter((c) => c.operation === 'delete' && c.scope === 'storage');

	if (updates.length > 0) {
		lines.push(colors.bold(`ACTUALIZACIONES · ${updates.length}`));
		lines.push('');
		for (const u of updates) {
			lines.push(`  • ${u.section} — ${u.entity}`);
			const targetPrevEntries = u.targetPreviousValues ? Object.entries(u.targetPreviousValues) : [];
			const distinctPrevValues = new Set(targetPrevEntries.map(([, v]) => String(v)));

			if (targetPrevEntries.length > 1 && distinctPrevValues.size > 1) {
				for (const [t, prev] of targetPrevEntries) {
					const envLabel = t === 'local' ? 'Local' : t === 'preview' ? 'Preview' : 'Producción';
					lines.push(`    ${envLabel.padEnd(10)} : ${String(prev ?? '(vacío)')}`);
				}
				if (u.newValue !== undefined) lines.push(`    Nuevo      : ${String(u.newValue)}`);
			} else {
				if (u.previousValue !== undefined) lines.push(`    Antes    : ${String(u.previousValue)}`);
				if (u.newValue !== undefined) lines.push(`    Ahora    : ${String(u.newValue)}`);
				if (u.targets && u.targets.length > 1) {
					lines.push(`    Entornos : ${formatTargetsSpanish(u.targets)}`);
				}
			}
		}
		lines.push('');
	}

	if (inserts.length > 0) {
		lines.push(colors.bold(`INSERCIONES · ${inserts.length}`));
		lines.push('');
		for (const i of inserts) {
			lines.push(`  • ${i.section} — ${i.entity}`);
			if (i.newValue !== undefined) lines.push(`    Valor : ${String(i.newValue)}`);
			if (i.targets && i.targets.length > 1) {
				lines.push(`    Entornos : ${formatTargetsSpanish(i.targets)}`);
			}
		}
		lines.push('');
	}

	if (deletes.length > 0) {
		lines.push(colors.bold(`ELIMINACIONES · ${deletes.length}`));
		lines.push('');
		for (const d of deletes) {
			lines.push(`  • ${d.section} — ${d.entity}`);
			if (d.previousValue !== undefined)
				lines.push(`    Anterior : ${String(d.previousValue)}`);
			if (d.targets && d.targets.length > 1) {
				lines.push(`    Entornos : ${formatTargetsSpanish(d.targets)}`);
			}
		}
		lines.push('');
	}

	if (moves.length > 0) {
		lines.push(colors.bold(`REORDENAMIENTOS · ${moves.length}`));
		lines.push('');
		for (const move of moves) {
			lines.push(`  • ${move.section} — ${move.entity}`);
			if (move.previousValue !== undefined)
				lines.push(`    Antes : ${String(move.previousValue)}`);
			if (move.newValue !== undefined) lines.push(`    Ahora : ${String(move.newValue)}`);
			if (move.targets && move.targets.length > 1) {
				lines.push(`    Entornos : ${formatTargetsSpanish(move.targets)}`);
			}
		}
		lines.push('');
	}

	if (uploads.length > 0) {
		lines.push(colors.bold(`SUBIDAS STORAGE · ${uploads.length}`));
		lines.push('');
		for (const u of uploads) {
			lines.push(`  • ${u.section} — ${u.entity}`);
			if (u.newValue) lines.push(`    Detalle : ${String(u.newValue)}`);
			if (u.targets && u.targets.length > 1) {
				lines.push(`    Entornos : ${formatTargetsSpanish(u.targets)}`);
			}
		}
		lines.push('');
	}

	if (overwrites.length > 0) {
		lines.push(colors.bold(`SOBRESCRITURAS STORAGE · ${overwrites.length}`));
		lines.push('');
		for (const o of overwrites) {
			lines.push(`  • ${o.section} — ${o.entity}`);
			if (o.newValue) lines.push(`    Detalle : ${String(o.newValue)}`);
			if (o.targets && o.targets.length > 1) {
				lines.push(`    Entornos : ${formatTargetsSpanish(o.targets)}`);
			}
		}
		lines.push('');
	}

	if (storageDeletes.length > 0) {
		lines.push(colors.bold(`ELIMINACIONES STORAGE · ${storageDeletes.length}`));
		lines.push('');
		for (const sd of storageDeletes) {
			lines.push(`  • ${sd.section} — ${sd.entity}`);
			if (sd.targets && sd.targets.length > 1) {
				lines.push(`    Entornos : ${formatTargetsSpanish(sd.targets)}`);
			}
		}
		lines.push('');
	}

	return lines;
}

function resolveStatusColor(status: TargetPlanData['status']): string {
	switch (status) {
		case 'CAMBIOS APLICADOS':
		case 'SIN CAMBIOS':
			return colors.green(status);
		case 'CAMBIOS PENDIENTES':
		case 'ERROR — CAMBIOS REVERTIDOS':
			return colors.yellow(status);
		case 'NO EVALUADO':
			return colors.dim(status);
		case 'BLOQUEADO':
		case 'ERROR — REQUIERE REVISIÓN':
			return colors.red(status);
		default:
			return status;
	}
}

// eslint-disable-next-line complexity -- Per-target lifecycle states require distinct truthful presentation branches.
export function formatDryRunPlan(plan: OperationalPlanData): string {
	const lines: string[] = [];
	lines.push(colors.bold(colors.cyan('=== Plan de Simulación (Dry-Run) ===')));
	lines.push('');
	lines.push(`Invitación   : ${colors.bold(plan.invitation)}`);
	lines.push(`Entorno(s)   : ${plan.targets.join(', ')}`);
	lines.push('');

	if (plan.targetPlans && plan.targetPlans.length > 0) {
		for (const tp of plan.targetPlans) {
			lines.push(colors.bold(`📌 Entorno: ${tp.target}`));
			if (tp.planId) {
				lines.push(`  ID de Plan   : ${colors.dim(tp.planId)}`);
			}
			lines.push(`  Estado       : ${resolveStatusColor(tp.status)}`);
			if (tp.reason) {
				lines.push(`  Motivo       : ${tp.reason}`);
			}
			if (tp.mergeConflicts && tp.mergeConflicts.length > 0) {
				lines.push('');
				lines.push(colors.bold('  Conflictos de merge (paquete vs destino):'));
				for (const conflict of tp.mergeConflicts) {
					lines.push(`    • ${conflict.path}`);
					lines.push(
						`        Ancestro : ${JSON.stringify(conflict.previousCanonicalValue ?? null)}`,
					);
					lines.push(
						`        Paquete  : ${JSON.stringify(conflict.packageValue ?? null)}`,
					);
					lines.push(
						`        Destino  : ${JSON.stringify(conflict.targetValue ?? null)}`,
					);
				}
				lines.push(
					colors.dim(
						'    Resuelva con --conflict-resolutions <archivo.json> ({ "resolutions": { "<path>": "package"|"target" } }).',
					),
				);
			}
			lines.push('');

			if (tp.status === 'CAMBIOS PENDIENTES' || tp.status === 'SIN CAMBIOS') {
				const functionalLines = formatFunctionalChanges(tp.functionalChanges);
				if (functionalLines.length > 0) {
					lines.push(...functionalLines.map((l) => `  ${l}`));
				}
				lines.push(`  Resumen Técnico de Operaciones (${tp.target}):`);
				lines.push(`    • Operaciones totales : ${tp.plannedOperations}`);
				lines.push(
					`    • Escrituras DB est.  : ${formatDbWrites(tp.expectedDatabaseWrites)}`,
				);
				lines.push(
					`    • Mutaciones Storage  : ${formatStorageMutations(tp.expectedStorageMutations)}`,
				);
				lines.push('');
			}
		}
	} else {
		if (plan.planId) {
			lines.push(`ID de Plan   : ${colors.dim(plan.planId)}`);
		}
		lines.push(
			`Estado Plan  : ${
				plan.isZeroDrift
					? colors.green('SIN CAMBIOS — Sin cambios requeridos (0 deriva)')
					: colors.yellow('CAMBIOS PENDIENTES')
			}`,
		);
		lines.push('');

		const functionalLines = formatFunctionalChanges(plan.functionalChanges);
		if (functionalLines.length > 0) {
			lines.push(...functionalLines);
		}

		lines.push(colors.bold('Resumen Técnico de Operaciones:'));
		lines.push(`  • Operaciones totales : ${plan.plannedOperations}`);
		lines.push(`  • Escrituras DB est.  : ${formatDbWrites(plan.expectedDatabaseWrites)}`);
		lines.push(
			`  • Mutaciones Storage  : ${formatStorageMutations(plan.expectedStorageMutations)}`,
		);
		lines.push('');

		if (
			plan.actions.length > 0 &&
			(!plan.functionalChanges || plan.functionalChanges.length === 0)
		) {
			lines.push(colors.bold('Desglose de Recursos:'));
			for (const action of plan.actions) {
				const badge =
					action.action === 'reuse' || action.action === 'skip'
						? colors.dim(`[${action.action.toUpperCase()}]`)
						: action.action === 'create'
							? colors.green('[CREAR]')
							: colors.yellow('[REEMPLAZAR]');
				lines.push(`  ${badge} ${action.resource} (${action.name}) — ${action.detail}`);
			}
			lines.push('');
		}
	}

	const blocked = plan.targetPlans?.some(
		(target) => target.status === 'BLOQUEADO' || target.status === 'NO EVALUADO',
	);
	lines.push(
		blocked
			? colors.red(
					'✖ Preflight incompleto. No se realizó ninguna modificación; resuelva los requisitos indicados y vuelva a planificar.',
				)
			: colors.green(
					'✔ Simulación completada con éxito. Ninguna modificación fue realizada en la base de datos ni en Storage.',
				),
	);
	return lines.join('\n');
}

export function formatApplyConfirmation(plan: OperationalPlanData): string {
	const lines: string[] = [];
	lines.push(colors.bold(colors.yellow('=== Confirmación de Aplicación ===')));
	lines.push('');
	lines.push(
		`Se aplicarán los siguientes cambios a la invitación "${colors.bold(plan.invitation)}" en ${plan.targets.join(', ')}:`,
	);
	if (plan.targetPlans?.length) {
		for (const target of plan.targetPlans.filter(
			(candidate) => candidate.status === 'CAMBIOS PENDIENTES',
		)) {
			lines.push(colors.bold(`📌 Entorno: ${target.target}`));
			lines.push(`  ID de Plan   : ${colors.dim(target.planId ?? 'NO DISPONIBLE')}`);
			lines.push(
				...formatFunctionalChanges(target.functionalChanges).map((line) => `  ${line}`),
			);
			lines.push(`  Operaciones lógicas : ${target.plannedOperations}`);
			lines.push(`  Escrituras DB est.  : ${formatDbWrites(target.expectedDatabaseWrites)}`);
			lines.push(
				`  Mutaciones Storage  : ${formatStorageMutations(target.expectedStorageMutations)}`,
			);
			lines.push('');
		}
	} else {
		if (plan.planId) lines.push(`ID de Plan Planificado: ${colors.dim(plan.planId)}`);
		lines.push('');
		lines.push(...formatFunctionalChanges(plan.functionalChanges));
		lines.push(`  - Operaciones lógicas a ejecutar : ${plan.plannedOperations}`);
		lines.push(
			`  - Escrituras DB estimadas        : ${formatDbWrites(plan.expectedDatabaseWrites)}`,
		);
		lines.push(
			`  - Mutaciones en Supabase Storage : ${formatStorageMutations(plan.expectedStorageMutations)}`,
		);
	}
	lines.push('');
	return lines.join('\n');
}

export interface TargetApplyResultData {
	target: string;
	planId?: string;
	status:
		| 'CAMBIOS APLICADOS'
		| 'SIN CAMBIOS'
		| 'NO EVALUADO'
		| 'BLOQUEADO'
		| 'ERROR — CAMBIOS REVERTIDOS'
		| 'ERROR — REQUIERE REVISIÓN'
		| 'CANCELADO POR EL OPERADOR'
		| 'CANCELLED'
		| 'UPDATED'
		| 'IN_SYNC'
		| 'BLOCKED'
		| 'FAILED';
	reason?: string;
	completedOperations: number;
	databaseWrites: { inserts: number; updates: number; deletes: number };
	storageMutations: { uploads: number; overwrites: number; moves?: number; deletes: number };
	publishedVersion?: number;
	functionalChanges?: OperationalPlanData['functionalChanges'];
}

export interface ApplyResultData {
	planId?: string;
	invitation: string;
	status:
		| 'CAMBIOS APLICADOS'
		| 'SIN CAMBIOS'
		| 'NO EVALUADO'
		| 'BLOQUEADO'
		| 'ERROR — CAMBIOS REVERTIDOS'
		| 'ERROR — REQUIERE REVISIÓN'
		| 'CANCELADO POR EL OPERADOR'
		| 'CANCELLED'
		| 'UPDATED'
		| 'IN_SYNC'
		| 'BLOCKED'
		| 'FAILED';
	environment: string;
	completedOperations: number;
	databaseWrites: { inserts: number; updates: number; deletes: number };
	storageMutations: { uploads: number; overwrites: number; moves?: number; deletes: number };
	publishedVersion?: number;
	reason?: string;
	functionalChanges?: OperationalPlanData['functionalChanges'];
	targetResults?: TargetApplyResultData[];
}

// eslint-disable-next-line complexity -- Formats single-target and multi-target apply results.
export function formatApplyResult(result: ApplyResultData): string {
	const lines: string[] = [];
	lines.push(colors.bold(colors.cyan('=== Resultado de Ejecución ===')));
	lines.push('');
	lines.push(`Invitación   : ${colors.bold(result.invitation)}`);
	lines.push(`Entorno(s)   : ${result.environment}`);
	lines.push('');

	if (result.targetResults && result.targetResults.length > 0) {
		for (const tr of result.targetResults) {
			lines.push(colors.bold(`📌 Entorno: ${tr.target}`));
			if (tr.planId) {
				lines.push(`  ID de Plan   : ${colors.dim(tr.planId)}`);
			}

			const normStatus: TargetPlanData['status'] =
				tr.status === 'UPDATED' || tr.status === 'CAMBIOS APLICADOS'
					? 'CAMBIOS APLICADOS'
					: tr.status === 'IN_SYNC' || tr.status === 'SIN CAMBIOS'
						? 'SIN CAMBIOS'
						: tr.status === 'NO EVALUADO'
							? 'NO EVALUADO'
							: tr.status === 'CANCELLED' || tr.status === 'CANCELADO POR EL OPERADOR'
								? 'CAMBIOS PENDIENTES'
								: tr.status === 'BLOQUEADO' || tr.status === 'BLOCKED'
									? 'BLOQUEADO'
									: tr.status === 'ERROR — CAMBIOS REVERTIDOS'
										? 'ERROR — CAMBIOS REVERTIDOS'
										: 'ERROR — REQUIERE REVISIÓN';

			const targetStatusText =
				tr.status === 'CANCELLED' || tr.status === 'CANCELADO POR EL OPERADOR'
					? colors.yellow('CANCELADO POR EL OPERADOR')
					: resolveStatusColor(normStatus);
			lines.push(`  Estado Final : ${targetStatusText}`);
			if (tr.reason) {
				lines.push(`  Motivo       : ${tr.reason}`);
			}
			lines.push('');

			const functionalLines = formatFunctionalChanges(tr.functionalChanges);
			if (functionalLines.length > 0) {
				lines.push(...functionalLines.map((l) => `  ${l}`));
			}

			lines.push(`  Resumen Técnico de Ejecución (${tr.target}):`);
			lines.push(`    • Operaciones completadas : ${tr.completedOperations}`);
			lines.push(`    • Escrituras Base de Datos: ${formatDbWrites(tr.databaseWrites)}`);
			lines.push(
				`    • Mutaciones Storage      : ${formatStorageMutations(tr.storageMutations)}`,
			);
			if (tr.publishedVersion !== undefined) {
				lines.push(`    • Versión pública          : v${tr.publishedVersion}`);
			}
			lines.push('');
		}
	} else {
		if (result.planId) {
			lines.push(`ID de Plan   : ${colors.dim(result.planId)}`);
		}

		const normalizedStatus =
			result.status === 'UPDATED' || result.status === 'CAMBIOS APLICADOS'
				? 'CAMBIOS APLICADOS'
				: result.status === 'IN_SYNC' || result.status === 'SIN CAMBIOS'
					? 'SIN CAMBIOS'
					: result.status === 'CANCELLED'
						? 'CANCELADO POR EL OPERADOR'
						: result.status === 'NO EVALUADO'
							? 'NO EVALUADO'
							: result.status === 'BLOQUEADO'
								? 'BLOQUEADO'
								: result.status === 'ERROR — CAMBIOS REVERTIDOS'
									? 'ERROR — CAMBIOS REVERTIDOS'
									: 'ERROR — REQUIERE REVISIÓN';

		const statusText =
			normalizedStatus === 'CAMBIOS APLICADOS'
				? colors.green('✔ CAMBIOS APLICADOS')
				: normalizedStatus === 'SIN CAMBIOS'
					? colors.green('✔ SIN CAMBIOS / YA ESTÁ AL DÍA')
					: normalizedStatus === 'CANCELADO POR EL OPERADOR'
						? colors.yellow('⏹ CANCELADO POR EL OPERADOR')
						: normalizedStatus === 'NO EVALUADO'
							? colors.dim('NO EVALUADO')
							: normalizedStatus === 'BLOQUEADO'
								? colors.red(`✖ BLOQUEADO (${result.reason ?? ''})`)
								: normalizedStatus === 'ERROR — CAMBIOS REVERTIDOS'
									? colors.yellow(
											`✖ ERROR — CAMBIOS REVERTIDOS (${result.reason ?? ''})`,
										)
									: colors.red(
											`✖ ERROR — REQUIERE REVISIÓN (${result.reason ?? ''})`,
										);

		lines.push(`Estado Final : ${statusText}`);
		lines.push('');

		const functionalLines = formatFunctionalChanges(result.functionalChanges);
		if (functionalLines.length > 0) {
			lines.push(...functionalLines);
		}

		if (normalizedStatus === 'SIN CAMBIOS') {
			lines.push(
				colors.green('La invitación ya está sincronizada. No hay cambios por aplicar.'),
			);
			lines.push(`Operaciones Lógicas Completadas : 0`);
			lines.push(
				`Escrituras Base de Datos        : ${formatDbWrites(result.databaseWrites)}`,
			);
			lines.push(
				`Mutaciones Storage             : ${formatStorageMutations(result.storageMutations)}`,
			);
			if (result.publishedVersion !== undefined) {
				lines.push(`Versión pública                 : v${result.publishedVersion}`);
			}
		} else if (normalizedStatus === 'CAMBIOS APLICADOS') {
			lines.push(`Operaciones Lógicas Completadas : ${result.completedOperations}`);
			lines.push(
				`Escrituras Base de Datos        : ${formatDbWrites(result.databaseWrites)}`,
			);
			lines.push(
				`Mutaciones Storage             : ${formatStorageMutations(result.storageMutations)}`,
			);
			if (result.publishedVersion !== undefined) {
				lines.push(`Versión pública                 : v${result.publishedVersion}`);
			}
		} else if (normalizedStatus === 'CANCELADO POR EL OPERADOR') {
			lines.push(
				colors.yellow(
					'La operación fue cancelada antes de realizar cualquier cambio. Base de datos y Storage intactos.',
				),
			);
		}
	}

	return lines.join('\n');
}
