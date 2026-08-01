/**
 * Safe recommended diagnostic / lifecycle commands for unhealthy states.
 * Commands are copyable text only — never executable UI controls.
 */

import type {
	AssetHealthRow,
	EnvironmentHealthRow,
	EvidenceFreshness,
	InvitationHealthRow,
	MigrationEnvHealth,
	OverallStatus,
	RecommendedCommand,
	ValidationEvidenceView,
} from './types.ts';

function pushUnique(out: RecommendedCommand[], item: RecommendedCommand): void {
	if (out.some((existing) => existing.id === item.id)) return;
	out.push(item);
}

export function buildRecommendedCommands(input: {
	overallStatus: OverallStatus;
	environments: readonly EnvironmentHealthRow[];
	invitations: readonly InvitationHealthRow[];
	migrations: readonly MigrationEnvHealth[];
	assets: readonly AssetHealthRow[];
	regression: ValidationEvidenceView;
	screenshots: ValidationEvidenceView;
}): RecommendedCommand[] {
	const out: RecommendedCommand[] = [];

	const addEvidence = (freshness: EvidenceFreshness, kind: 'regression' | 'screenshots') => {
		if (freshness === 'PASS') return;
		if (kind === 'regression') {
			pushUnique(out, {
				id: 'regression-evidence',
				label: 'Evidencia de regresión',
				command: 'pnpm test:local-render-corpus',
				reason:
					freshness === 'NOT_RUN'
						? 'No hay snapshot de regresión'
						: freshness === 'STALE'
							? 'La evidencia de regresión está obsoleta'
							: freshness === 'FAIL'
								? 'La última regresión falló'
								: 'La evidencia de regresión no es válida',
			});
		} else {
			pushUnique(out, {
				id: 'screenshot-evidence',
				label: 'Evidencia de capturas',
				command: 'pnpm screenshot:local-render-corpus',
				reason:
					freshness === 'NOT_RUN'
						? 'No hay snapshot de capturas'
						: freshness === 'STALE'
							? 'La evidencia de capturas está obsoleta'
							: freshness === 'FAIL'
								? 'La última corrida de capturas falló'
								: 'La evidencia de capturas no es válida',
			});
		}
	};

	addEvidence(input.regression.freshness, 'regression');
	addEvidence(input.screenshots.freshness, 'screenshots');

	for (const migration of input.migrations) {
		if (migration.environment === 'repository') continue;
		if (migration.schemaLifecycle === 'BEHIND') {
			pushUnique(out, {
				id: `schema-behind-${migration.environment}`,
				label: `Esquema ${migration.environment} atrasado`,
				command:
					migration.environment === 'local'
						? 'pnpm db:local:migrate'
						: 'Consulte el flujo de migraciones documentado (sin editar migraciones aplicadas)',
				reason: `Migraciones pendientes en ${migration.environment}`,
			});
		}
		if (migration.schemaLifecycle === 'SCHEMA_DRIFT') {
			pushUnique(out, {
				id: `schema-drift-${migration.environment}`,
				label: `Deriva de esquema en ${migration.environment}`,
				command:
					'Restaure la migración original y agregue una migración correctiva (no edite aplicadas)',
				reason: 'Contenido de migración aplicada distinto del repositorio',
			});
		}
	}

	for (const env of input.environments) {
		if (env.connection === 'credentials_required' || env.connection === 'unreachable') {
			pushUnique(out, {
				id: `env-${env.environment}`,
				label: `Entorno ${env.environment}`,
				command: 'pnpm dbs --compact',
				reason: `Entorno ${env.environment} no verificable`,
			});
		}
	}

	const missingLocal = input.invitations.filter((row) => row.environments.local.status === 'NOT_PRESENT');
	if (missingLocal.length > 0) {
		pushUnique(out, {
			id: 'local-corpus-missing',
			label: 'Corpus Local incompleto',
			command: 'pnpm invitation:local-corpus --dry-run',
			reason: `${missingLocal.length} invitación(es) del corpus ausentes en Local`,
		});
	}

	for (const row of input.invitations) {
		if (row.recommendedCommand) {
			pushUnique(out, {
				id: `invite-${row.slug}`,
				label: `Invitación ${row.slug}`,
				command: row.recommendedCommand,
				reason: row.failureCause ?? 'Requiere diagnóstico',
			});
		}
	}

	const missingAssets = input.assets.filter((a) => a.status === 'MISSING');
	if (missingAssets.length > 0) {
		pushUnique(out, {
			id: 'assets-missing',
			label: 'Assets faltantes',
			command: 'pnpm invitation:local-corpus --dry-run',
			reason: `${missingAssets.length} invitación(es) con assets requeridos faltantes`,
		});
	}

	const canonicalBehindProd = input.invitations.filter(
		(row) =>
			row.referenceClassification === 'CANONICAL_MANAGED' &&
			row.environments.production.status === 'BEHIND_CANONICAL',
	);
	if (canonicalBehindProd.length > 0) {
		pushUnique(out, {
			id: 'canonical-lifecycle',
			label: 'Ciclo canónico (Local → Preview → validación → promote)',
			command:
				'pnpm invitation:update -- --slug <slug> --target preview  # luego validar y pnpm invitation:promote',
			reason:
				'Producción atrasada: nunca invitation:update directo a Production; usar promote tras Preview',
		});
	}

	if (input.overallStatus === 'HEALTHY' && out.length === 0) {
		pushUnique(out, {
			id: 'status-ok',
			label: 'Estado general',
			command: 'pnpm dbs --compact',
			reason: 'Consulta rápida de estado (solo lectura)',
		});
	}

	return out;
}
