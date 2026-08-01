import type {
	AssetHealthRow,
	EnvironmentHealthRow,
	EvidenceFreshness,
	InvitationHealthRow,
	MigrationEnvHealth,
	ObservabilityAction,
	ObservabilityHealthCounts,
	ObservabilityIssue,
	ObservabilityIssueSeverity,
	ObservabilitySnapshot,
	ObservabilitySourceState,
	OverallStatus,
	ValidationEvidenceView,
} from './types.ts';

const REFRESH_TTL_MS = 60_000;
const SEVERITY_ORDER: Record<ObservabilityIssueSeverity, number> = {
	blocking: 0,
	warning: 1,
	unverified: 2,
};

type EntityState = 'ok' | ObservabilityIssueSeverity;

export interface PublicSnapshotInput {
	generatedAt: string;
	overallStatus: OverallStatus;
	source: ObservabilitySourceState;
	environments: EnvironmentHealthRow[];
	invitations: InvitationHealthRow[];
	migrations: MigrationEnvHealth[];
	assets: AssetHealthRow[];
	regression: ValidationEvidenceView;
	screenshots: ValidationEvidenceView;
	degraded: boolean;
}

function healthCounts(states: readonly EntityState[]): ObservabilityHealthCounts {
	return states.reduce<ObservabilityHealthCounts>(
		(counts, state) => {
			counts[state] += 1;
			return counts;
		},
		{ total: states.length, ok: 0, warning: 0, blocking: 0, unverified: 0 },
	);
}

function environmentState(row: EnvironmentHealthRow): EntityState {
	if (row.environment === 'local') {
		if (row.connection !== 'ok' || row.schemaLifecycle === 'SCHEMA_DRIFT') return 'blocking';
		if (row.schemaLifecycle === 'UNVERIFIED' || row.renderEffectiveParity === 'UNVERIFIABLE') {
			return 'unverified';
		}
	}
	if (row.connection !== 'ok' || row.schemaLifecycle === 'UNVERIFIED') return 'unverified';
	if (row.schemaLifecycle === 'BEHIND' || row.renderEffectiveParity !== 'ALL_ALIGNED')
		return 'warning';
	return 'ok';
}

function invitationState(row: InvitationHealthRow): EntityState {
	const local = row.environments.local.status;
	if (local === 'NOT_PRESENT' || local === 'IDENTITY_CONFLICT') return 'blocking';
	if (local === 'UNREACHABLE' || local === 'CREDENTIALS_REQUIRED' || local === 'UNVERIFIED') {
		return 'unverified';
	}
	if (
		local === 'BEHIND_CANONICAL' ||
		local === 'DIVERGED' ||
		local === 'DIVERGED_FROM_REFERENCE'
	) {
		return 'warning';
	}

	// Remotes: ignore presence-only / unprobed UNVERIFIED; surface connectivity and hard drift.
	for (const env of ['preview', 'production'] as const) {
		const status = row.environments[env].status;
		if (status === 'UNREACHABLE' || status === 'CREDENTIALS_REQUIRED') return 'unverified';
		if (
			status === 'NOT_PRESENT' ||
			status === 'IDENTITY_CONFLICT' ||
			status === 'BEHIND_CANONICAL' ||
			status === 'DIVERGED' ||
			status === 'DIVERGED_FROM_REFERENCE'
		) {
			return 'warning';
		}
	}
	return 'ok';
}

function migrationState(row: MigrationEnvHealth): EntityState {
	if (row.environment === 'local' && row.schemaLifecycle === 'SCHEMA_DRIFT') return 'blocking';
	if (!row.configured || !row.reachable || row.schemaLifecycle === 'UNVERIFIED')
		return 'unverified';
	if (row.schemaLifecycle === 'BEHIND' || row.schemaLifecycle === 'SCHEMA_DRIFT')
		return 'warning';
	return 'ok';
}

function assetState(row: AssetHealthRow): EntityState {
	if (
		row.status === 'MISSING' &&
		['VERSIONED_MANAGED_ASSET', 'VERSIONED_LOCAL_ASSET'].includes(row.assetStrategy)
	)
		return 'blocking';
	if (row.status === 'UNVERIFIED') return 'unverified';
	if (row.status === 'PARTIAL' || row.status === 'MISSING') return 'warning';
	return 'ok';
}

function validationState(freshness: EvidenceFreshness): EntityState {
	if (freshness === 'FAIL') return 'blocking';
	if (freshness === 'STALE') return 'warning';
	if (freshness === 'NOT_RUN' || freshness === 'INVALID') return 'unverified';
	return 'ok';
}

function issue(input: Omit<ObservabilityIssue, 'id'>): ObservabilityIssue {
	const suffix =
		input.slug ?? input.environment ?? input.scope.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	return { ...input, id: `${input.code.toLowerCase()}:${suffix}` };
}

function safeActionForInvitation(slug: string): ObservabilityAction {
	return {
		id: `inspect:${slug}`,
		label: 'Inspeccionar invitación',
		command: `pnpm dbs --compact ${slug}`,
		reason: 'Diagnóstico de sólo lectura para comparar identidad y contenido.',
	};
}

// eslint-disable-next-line complexity -- A single ordered classifier keeps issue policy auditable.
function collectIssues(input: PublicSnapshotInput): {
	issues: ObservabilityIssue[];
	actions: ObservabilityAction[];
	integrityFailures: number;
} {
	const issues: ObservabilityIssue[] = [];
	const actions = new Map<string, ObservabilityAction>();
	let integrityFailures = 0;

	const slugs = new Set<string>();
	for (const row of input.invitations) {
		if (slugs.has(row.slug)) integrityFailures += 1;
		slugs.add(row.slug);
		for (const env of ['local', 'preview', 'production'] as const) {
			if (!row.environments[env]) integrityFailures += 1;
		}
	}
	for (const row of input.environments) {
		if (row.activeInvitationRows < 0) integrityFailures += 1;
		if (row.connection !== 'ok' && row.renderEffectiveParity !== 'UNVERIFIABLE') {
			integrityFailures += 1;
		}
	}
	for (const view of [input.regression, input.screenshots]) {
		const snapshot = view.snapshot;
		if (
			snapshot &&
			(snapshot.total < 0 || snapshot.passed + snapshot.failed !== snapshot.total)
		) {
			integrityFailures += 1;
		}
	}

	if (integrityFailures > 0) {
		issues.push(
			issue({
				code: 'DATA_INTEGRITY',
				severity: 'blocking',
				domain: 'data_quality',
				scope: 'Snapshot',
				title: 'El snapshot contiene datos contradictorios',
				description: `Fallaron ${integrityFailures} invariantes internas; no use este estado para tomar decisiones.`,
				actionIds: [],
			}),
		);
	}

	if (input.source.degraded) {
		issues.push(
			issue({
				code: 'SOURCE_UNVERIFIED',
				severity: 'unverified',
				domain: 'source',
				scope: 'Repositorio',
				title: 'No se verificó la fuente',
				description: 'No fue posible confirmar rama y revisión del repositorio.',
				actionIds: [],
			}),
		);
	} else if (input.source.workingTreeDirty) {
		issues.push(
			issue({
				code: 'SOURCE_DIRTY',
				severity: 'warning',
				domain: 'source',
				scope: 'Repositorio',
				title: 'El árbol de trabajo tiene cambios',
				description:
					'La evidencia puede no corresponder exactamente con la revisión actual.',
				actionIds: [],
			}),
		);
	}
	if (input.degraded) {
		issues.push(
			issue({
				code: 'PROBE_DEGRADED',
				severity: 'unverified',
				domain: 'data_quality',
				scope: 'Agregación',
				title: 'Una o más señales no respondieron',
				description:
					'El resto del snapshot sigue disponible, pero la cobertura es incompleta.',
				actionIds: [],
			}),
		);
	}

	for (const row of input.environments) {
		const state = environmentState(row);
		if (state === 'ok') continue;
		const label =
			row.environment === 'local'
				? 'Local'
				: row.environment === 'preview'
					? 'Preview'
					: 'Producción';
		const code =
			row.connection !== 'ok'
				? 'ENV_CONNECTION'
				: row.schemaLifecycle !== 'CURRENT'
					? 'ENV_SCHEMA'
					: 'ENV_PARITY';
		issues.push(
			issue({
				code,
				severity: state,
				domain: 'environment',
				scope: label,
				environment: row.environment,
				title:
					code === 'ENV_CONNECTION'
						? `No se verificó la conexión de ${label}`
						: code === 'ENV_SCHEMA'
							? `El esquema de ${label} requiere atención`
							: `La paridad de ${label} no está alineada`,
				description:
					code === 'ENV_CONNECTION'
						? 'No hay evidencia confiable de disponibilidad para este entorno.'
						: code === 'ENV_SCHEMA'
							? `Estado de esquema: ${row.schemaLifecycle}.`
							: `Estado de paridad: ${row.renderEffectiveParity}.`,
				actionIds: [],
			}),
		);
	}

	for (const row of input.invitations) {
		const state = invitationState(row);
		if (state === 'ok') continue;
		const actionableStatuses = [
			row.environments.local.status,
			...(['preview', 'production'] as const)
				.map((env) => row.environments[env].status)
				.filter((status) => status !== 'UNVERIFIED'),
		];
		const code = actionableStatuses.includes('IDENTITY_CONFLICT')
			? 'INVITATION_IDENTITY_CONFLICT'
			: actionableStatuses.includes('NOT_PRESENT')
				? 'INVITATION_MISSING'
				: actionableStatuses.includes('BEHIND_CANONICAL')
					? 'INVITATION_BEHIND'
					: actionableStatuses.some(
								(status) =>
									status === 'DIVERGED' || status === 'DIVERGED_FROM_REFERENCE',
						  )
						? 'INVITATION_DIVERGED'
						: 'INVITATION_UNVERIFIED';
		const action = safeActionForInvitation(row.slug);
		actions.set(action.id, action);
		issues.push(
			issue({
				code,
				severity: state,
				domain: 'invitation',
				scope: row.slug,
				slug: row.slug,
				title:
					code === 'INVITATION_IDENTITY_CONFLICT'
						? 'Hay identidades duplicadas'
						: code === 'INVITATION_MISSING'
							? 'Falta la invitación en un entorno'
							: code === 'INVITATION_BEHIND'
								? 'La invitación está detrás de la fuente canónica'
								: code === 'INVITATION_DIVERGED'
									? 'La invitación tiene contenido divergente'
									: 'No se verificó completamente la invitación',
				description:
					'Revise la comparación por entorno antes de publicar o promover contenido.',
				actionIds: [action.id],
			}),
		);
	}

	for (const row of input.migrations) {
		if (row.environment === 'repository') continue;
		const state = migrationState(row);
		if (state === 'ok') continue;
		const environment = row.environment as 'local' | 'preview' | 'production';
		const label =
			environment === 'local'
				? 'Local'
				: environment === 'preview'
					? 'Preview'
					: 'Producción';
		const code =
			row.schemaLifecycle === 'SCHEMA_DRIFT'
				? 'MIGRATION_DRIFT'
				: row.schemaLifecycle === 'BEHIND'
					? 'MIGRATION_BEHIND'
					: 'MIGRATION_UNVERIFIED';
		const action: ObservabilityAction = {
			id: `audit:${environment}`,
			label: `Auditar ${label}`,
			command: `pnpm db:${environment === 'production' ? 'prod' : environment}:audit`,
			reason: 'Auditoría protegida y de sólo lectura del historial de migraciones.',
		};
		actions.set(action.id, action);
		issues.push(
			issue({
				code,
				severity: state,
				domain: 'migration',
				scope: label,
				environment,
				title:
					code === 'MIGRATION_DRIFT'
						? `El historial de ${label} presenta drift`
						: code === 'MIGRATION_BEHIND'
							? `${label} tiene migraciones pendientes`
							: `No se verificaron las migraciones de ${label}`,
				description:
					'Confirme el historial con la auditoría protegida antes de cualquier cambio.',
				actionIds: [action.id],
			}),
		);
	}

	for (const row of input.assets) {
		const state = assetState(row);
		if (state === 'ok') continue;
		const code =
			row.status === 'MISSING'
				? 'ASSET_MISSING'
				: row.status === 'PARTIAL'
					? 'ASSET_PARTIAL'
					: 'ASSET_UNVERIFIED';
		const action = safeActionForInvitation(row.slug);
		actions.set(action.id, action);
		issues.push(
			issue({
				code,
				severity: state,
				domain: 'asset',
				scope: row.slug,
				slug: row.slug,
				title:
					code === 'ASSET_MISSING'
						? 'Faltan assets requeridos'
						: code === 'ASSET_PARTIAL'
							? 'El inventario de assets está incompleto'
							: 'No se verificaron los assets',
				description:
					'Compare la estrategia declarada con el inventario local y la referencia registrada.',
				actionIds: [action.id],
			}),
		);
	}

	for (const view of [input.regression, input.screenshots]) {
		const state = validationState(view.freshness);
		if (state === 'ok') continue;
		const code =
			view.freshness === 'FAIL'
				? 'VALIDATION_FAILED'
				: view.freshness === 'STALE'
					? 'VALIDATION_STALE'
					: view.freshness === 'INVALID'
						? 'VALIDATION_INVALID'
						: 'VALIDATION_NOT_RUN';
		const command =
			view.validationType === 'regression'
				? 'pnpm test:local-render-corpus'
				: 'pnpm screenshot:local-render-corpus';
		const action: ObservabilityAction = {
			id: `validate:${view.validationType}`,
			label: view.validationType === 'regression' ? 'Validar regresión' : 'Validar capturas',
			command,
			reason: 'Regenera evidencia local canónica sin modificar bases de datos.',
		};
		actions.set(action.id, action);
		issues.push(
			issue({
				code,
				severity: state,
				domain: 'validation',
				scope: view.validationType === 'regression' ? 'Regresión' : 'Capturas',
				title:
					code === 'VALIDATION_FAILED'
						? 'La última validación falló'
						: code === 'VALIDATION_STALE'
							? 'La evidencia está obsoleta'
							: code === 'VALIDATION_INVALID'
								? 'La evidencia no es válida'
								: 'Aún no existe evidencia',
				description: 'Genere evidencia compatible con la revisión y el corpus actuales.',
				actionIds: [action.id],
			}),
		);
	}

	issues.sort(
		(a, b) =>
			SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
			a.domain.localeCompare(b.domain) ||
			a.scope.localeCompare(b.scope),
	);
	return { issues, actions: [...actions.values()], integrityFailures };
}

export function buildPublicObservabilitySnapshot(
	input: PublicSnapshotInput,
): ObservabilitySnapshot {
	const collected = collectIssues(input);
	return {
		schemaVersion: 2,
		generatedAt: input.generatedAt,
		overallStatus: collected.integrityFailures > 0 ? 'BLOCKED' : input.overallStatus,
		cache: {
			state: 'fresh',
			refreshAfter: new Date(
				new Date(input.generatedAt).getTime() + REFRESH_TTL_MS,
			).toISOString(),
		},
		source: {
			branch: input.source.branch?.slice(0, 128) ?? null,
			commitShaShort: input.source.commitSha?.slice(0, 10) ?? null,
			workingTreeDirty: input.source.workingTreeDirty,
		},
		health: {
			environments: healthCounts(input.environments.map(environmentState)),
			invitations: healthCounts(input.invitations.map(invitationState)),
			migrations: healthCounts(
				input.migrations
					.filter((row) => row.environment !== 'repository')
					.map(migrationState),
			),
			assets: healthCounts(input.assets.map(assetState)),
			validations: healthCounts([
				validationState(input.regression.freshness),
				validationState(input.screenshots.freshness),
			]),
		},
		issues: collected.issues,
		validationEvidence: [input.regression, input.screenshots].map((view) => ({
			type: view.validationType,
			freshness: view.freshness,
			completedAt: view.snapshot?.completedAt ?? null,
			passed: view.snapshot?.passed ?? null,
			total: view.snapshot?.total ?? null,
		})),
		recommendedActions: collected.actions,
	};
}
