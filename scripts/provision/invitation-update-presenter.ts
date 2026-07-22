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
		environments: Record<string, { status: string; reason?: string }>;
	}>;
	inventory?: Record<string, { verified: boolean; rows: Array<{ slug: string; status: string; hasProvenance?: boolean; assetComplete?: boolean }> }>;
	readiness?: {
		verdict: string;
		reasons: string[];
		details: Record<string, boolean | string | null>;
	};
}

function formatEnvironmentStatus(
	target: string,
	defSlug: string,
	envInfo: { status: string; reason?: string } | undefined,
	inventoryLocal: { verified: boolean; rows: Array<{ slug: string; status: string }> } | undefined,
): string {
	let localRowStatus: string | undefined;
	if (target === 'local' && inventoryLocal?.verified) {
		const row = inventoryLocal.rows.find((r) => r.slug === defSlug);
		localRowStatus = row ? row.status : 'NOT_PRESENT';
	}
	const effectiveStatus = localRowStatus || envInfo?.status || 'UNVERIFIED';
	const isSuccess = ['MANAGED', 'READY', 'IN_SYNC', 'UPDATED'].includes(effectiveStatus);
	const isWarning = ['UNAPPLIED_DEFINITION', 'NO-GO', 'NOT_PRESENT'].includes(effectiveStatus);
	const statusBadge = isSuccess ? colors.green(`[${effectiveStatus}]`) : isWarning ? colors.yellow(`[${effectiveStatus}]`) : colors.dim(`[${effectiveStatus}]`);
	return `   Estado en ${colors.bold(target)} : ${statusBadge}`;
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
	expectedStorageMutations: { uploads: number; overwrites: number; deletes: number };
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
	lines.push(`  • Escrituras DB est.  : ${plan.expectedDatabaseWrites.inserts} inserciones, ${plan.expectedDatabaseWrites.updates} actualizaciones, ${plan.expectedDatabaseWrites.deletes} eliminaciones`);
	lines.push(
		`  • Mutaciones Storage  : ${plan.expectedStorageMutations.uploads} subidas, ${plan.expectedStorageMutations.overwrites} sobrescrituras, ${plan.expectedStorageMutations.deletes} eliminaciones`,
	);
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
	lines.push(
		`  - Escrituras DB estimadas        : ${plan.expectedDatabaseWrites.inserts} inserciones, ${plan.expectedDatabaseWrites.updates} actualizaciones, ${plan.expectedDatabaseWrites.deletes} eliminaciones`,
	);
	lines.push(
		`  - Mutaciones en Supabase Storage : ${plan.expectedStorageMutations.uploads} subidas, ${plan.expectedStorageMutations.overwrites} sobrescrituras, ${plan.expectedStorageMutations.deletes} eliminaciones`,
	);
	lines.push('');
	return lines.join('\n');
}

export interface ApplyResultData {
	invitation: string;
	status: 'UPDATED' | 'IN_SYNC' | 'CANCELLED' | 'BLOCKED' | 'FAILED';
	environment: string;
	completedOperations: number;
	databaseWrites: { inserts: number; updates: number; deletes: number };
	storageMutations: { uploads: number; overwrites: number; deletes: number };
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

	if (result.status === 'UPDATED' || result.status === 'IN_SYNC') {
		lines.push(`Operaciones Lógicas Completadas : ${result.completedOperations}`);
		lines.push(
			`Escrituras Base de Datos        : ${result.databaseWrites.inserts} inserciones, ${result.databaseWrites.updates} actualizaciones, ${result.databaseWrites.deletes} eliminaciones`,
		);
		lines.push(
			`Mutaciones Storage             : ${result.storageMutations.uploads} subidas, ${result.storageMutations.overwrites} sobrescrituras, ${result.storageMutations.deletes} eliminaciones`,
		);
		if (result.publishedVersion !== undefined) {
			lines.push(`Versión Pública Publicada        : v${result.publishedVersion}`);
		}
	} else if (result.status === 'CANCELLED') {
		lines.push(colors.yellow('La operación fue cancelada antes de realizar cualquier cambio. Base de datos y Storage intactos.'));
	}

	return lines.join('\n');
}
