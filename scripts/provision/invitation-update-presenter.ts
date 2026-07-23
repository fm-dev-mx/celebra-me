/**
 * invitation-update-presenter.ts — Spanish Terminal Presenter for Managed Invitation CLI
 *
 * Formats status reports, dry-run plans, apply confirmations, and execution results
 * into clear, user-friendly Spanish terminal output without raw object dumps.
 */

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
		environments: Record<string, { status: string; managedStatus?: string; syncStatus?: string; reason?: string }>;
	}>;
	inventory?: Record<string, { verified: boolean; rows: Array<{ slug: string; status: string; hasProvenance?: boolean; assetComplete?: boolean }> }>;
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

function formatStorageMutations(mutations: { uploads: number; overwrites: number; moves?: number; deletes: number }): string {
	const upl = `${mutations.uploads} ${mutations.uploads === 1 ? 'subida' : 'subidas'}`;
	const ovr = `${mutations.overwrites} ${mutations.overwrites === 1 ? 'sobrescritura' : 'sobrescrituras'}`;
	const mov = mutations.moves !== undefined ? `, ${mutations.moves} ${mutations.moves === 1 ? 'movimiento' : 'movimientos'}` : '';
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
	envInfo: { status: string; managedStatus?: string; syncStatus?: string; reason?: string } | undefined,
	inventoryLocal: { verified: boolean; rows: Array<{ slug: string; status: string }> } | undefined,
): string {
	let localRowStatus: string | undefined;
	if (target === 'local' && inventoryLocal?.verified) {
		const row = inventoryLocal.rows.find((r) => r.slug === defSlug);
		localRowStatus = row ? row.status : 'NOT_PRESENT';
	}
	const managed = envInfo?.managedStatus ?? localRowStatus ?? envInfo?.status ?? 'UNVERIFIED';
	const sync = envInfo?.syncStatus ?? (envInfo?.status === 'IN_SYNC' ? 'IN_SYNC' : envInfo?.status === 'DRIFT' ? 'DRIFT' : 'UNEVALUATED');

	return `   Estado en ${colors.bold(target)}:\n     Estado administrado : ${resolveManagedText(managed)}\n     Sincronización      : ${resolveSyncText(sync)}`;
}

function formatReadinessDetails(readiness: NonNullable<StatusReportData['readiness']>): string[] {
	const lines: string[] = [];
	const verdictColor = readiness.verdict === 'READY' ? colors.green : readiness.verdict === 'NO-GO' ? colors.yellow : colors.red;
	lines.push(`   Evaluación Integridad: ${verdictColor(readiness.verdict)}`);
	lines.push(`     - Trazabilidad Provenance : ${readiness.details.hasProvenance ? colors.green('Sí') : colors.yellow('No')}`);
	lines.push(`     - Archivos de Storage     : ${readiness.details.storageBinaryVerified ? colors.green('Verificados') : colors.yellow('Incompletos / Sin verificar')}`);
	lines.push(`     - Fotografía Hero         : ${readiness.details.heroValid ? colors.green('Válida') : colors.yellow('Pendiente')}`);
	lines.push(`     - Mapas Ubicación         : ${readiness.details.mapsValid ? colors.green('Válidos') : colors.yellow('Pendientes')}`);

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
		lines.push(colors.yellow('No se encontraron definiciones de invitación para el filtro especificado.'));
		return lines.join('\n');
	}

	for (const def of data.definitions) {
		lines.push(`📌 ${colors.bold(def.title)} (${colors.dim(def.slug)})`);
		lines.push(`   Definición Canónica : Encontrada (Creada: ${def.createdAt.slice(0, 10)})`);

		for (const target of data.filters.targets) {
			lines.push(formatEnvironmentStatus(target, def.slug, def.environments[target], data.inventory?.local));
		}

		if (data.readiness && data.filters.slug === def.slug) {
			lines.push(...formatReadinessDetails(data.readiness));
		}
		lines.push('');
	}

	return lines.join('\n');
}

export interface OperationalPlanData {
	invitation: string;
	targets: string[];
	isZeroDrift: boolean;
	plannedOperations: number;
	expectedDatabaseWrites: { inserts: number; updates: number; deletes: number };
	expectedStorageMutations: { uploads: number; overwrites: number; moves?: number; deletes: number };
	actions: Array<{ resource: string; name: string; action: string; detail: string }>;
	publishedVersion?: number;
}

export function formatDryRunPlan(plan: OperationalPlanData): string {
	const lines: string[] = [];
	lines.push(colors.bold(colors.cyan('=== Plan de Simulación (Dry-Run) ===')));
	lines.push('');
	lines.push(`Invitación   : ${colors.bold(plan.invitation)}`);
	lines.push(`Entorno(s)   : ${plan.targets.join(', ')}`);
	lines.push(`Estado Plan  : ${plan.isZeroDrift ? colors.green('Sin cambios requeridos (0 deriva)') : colors.yellow('Cambios pendientes')}`);
	lines.push('');

	lines.push(colors.bold('Operaciones Lógicas Planificadas:'));
	lines.push(`  • Operaciones totales : ${plan.plannedOperations}`);
	lines.push(`  • Escrituras DB est.  : ${formatDbWrites(plan.expectedDatabaseWrites)}`);
	lines.push(`  • Mutaciones Storage  : ${formatStorageMutations(plan.expectedStorageMutations)}`);
	lines.push('');

	if (plan.actions.length > 0) {
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

	lines.push(colors.green('✔ Simulación completada con éxito. Ninguna modificación fue realizada en la base de datos ni en Storage.'));
	return lines.join('\n');
}

export function formatApplyConfirmation(plan: OperationalPlanData): string {
	const lines: string[] = [];
	lines.push(colors.bold(colors.yellow('=== Confirmación de Aplicación ===')));
	lines.push('');
	lines.push(`Se aplicarán los siguientes cambios a la invitación "${colors.bold(plan.invitation)}" en ${plan.targets.join(', ')}:`);
	lines.push(`  - Operaciones lógicas a ejecutar : ${plan.plannedOperations}`);
	lines.push(`  - Escrituras DB estimadas        : ${formatDbWrites(plan.expectedDatabaseWrites)}`);
	lines.push(`  - Mutaciones en Supabase Storage : ${formatStorageMutations(plan.expectedStorageMutations)}`);
	lines.push('');
	return lines.join('\n');
}

export interface ApplyResultData {
	invitation: string;
	status: 'UPDATED' | 'IN_SYNC' | 'CANCELLED' | 'BLOCKED' | 'FAILED';
	environment: string;
	completedOperations: number;
	databaseWrites: { inserts: number; updates: number; deletes: number };
	storageMutations: { uploads: number; overwrites: number; moves?: number; deletes: number };
	publishedVersion?: number;
	reason?: string;
}

export function formatApplyResult(result: ApplyResultData): string {
	const lines: string[] = [];
	lines.push(colors.bold(colors.cyan('=== Resultado de Ejecución ===')));
	lines.push('');
	lines.push(`Invitación   : ${colors.bold(result.invitation)}`);
	lines.push(`Entorno      : ${result.environment}`);

	const statusText =
		result.status === 'UPDATED'
			? colors.green('✔ ACTUALIZADO CORRECTAMENTE')
			: result.status === 'IN_SYNC'
				? colors.green('✔ YA ESTÁ AL DÍA (Sin cambios requeridos)')
				: result.status === 'CANCELLED'
					? colors.yellow('⏹ CANCELADO POR EL OPERADOR')
					: colors.red(`✖ BLOQUEADO / FALLIDO: ${result.reason ?? ''}`);

	lines.push(`Estado Final : ${statusText}`);
	lines.push('');

	if (result.status === 'IN_SYNC') {
		lines.push(colors.green('La invitación ya está sincronizada. No hay cambios por aplicar.'));
		lines.push(`Operaciones Lógicas Completadas : 0`);
		lines.push(`Escrituras Base de Datos        : ${formatDbWrites(result.databaseWrites)}`);
		lines.push(`Mutaciones Storage             : ${formatStorageMutations(result.storageMutations)}`);
		if (result.publishedVersion !== undefined) {
			lines.push(`Versión pública                 : v${result.publishedVersion}`);
		}
	} else if (result.status === 'UPDATED') {
		lines.push(`Operaciones Lógicas Completadas : ${result.completedOperations}`);
		lines.push(`Escrituras Base de Datos        : ${formatDbWrites(result.databaseWrites)}`);
		lines.push(`Mutaciones Storage             : ${formatStorageMutations(result.storageMutations)}`);
		if (result.publishedVersion !== undefined) {
			lines.push(`Versión pública                 : v${result.publishedVersion}`);
		}
	} else if (result.status === 'CANCELLED') {
		lines.push(colors.yellow('La operación fue cancelada antes de realizar cualquier cambio. Base de datos y Storage intactos.'));
	}

	return lines.join('\n');
}
