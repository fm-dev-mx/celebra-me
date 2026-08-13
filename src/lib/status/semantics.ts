/**
 * Operator presentation of already-classified canonical status.
 * Does not classify schema, publication, readiness, or authorization.
 */
import {
	DIAGNOSTIC_LABELS,
	ENV_LABELS,
	PUBLICATION_REASON_LABELS,
	READINESS_LABELS,
} from './labels';
import type {
	AuthorizationIntegrity,
	CanonicalDiagnostic,
	CanonicalDisposableProof,
	CanonicalEnvSummary,
	CanonicalPromotionRow,
	CanonicalStatusView,
	DiagnosticCode,
	EvidenceState,
	SchemaLifecycleState,
	SchemaOperationReadiness,
	StatusSemantic,
	TargetEnv,
} from './types';

export type OperatorStepType = 'Diagnose' | 'Verify' | 'Plan' | 'Apply' | 'Manual/HITL';

export interface OperatorActionStep {
	type: OperatorStepType;
	label: string;
	command: string | null;
	prerequisite: string | null;
	requiresOwner: boolean;
	optional: boolean;
}

export interface OperatorRemediation {
	semantic: StatusSemantic;
	meaning: string;
	why: string | null;
	environmentLabel: string | null;
	nextAction: string;
	steps: OperatorActionStep[];
	verifyWhen: string;
	noCanonicalRemediation: boolean;
}

const REFRESH_COMMAND = 'pnpm dbs';
const DISPOSABLE_PROOF_COMMAND = 'pnpm db:migrate -- --target disposable-test --apply';

export function step(
	type: OperatorStepType,
	command: string | null,
	prerequisite: string | null,
	requiresOwner = false,
	optional = false,
	label: string = type,
): OperatorActionStep {
	return { type, label, command, prerequisite, requiresOwner, optional };
}

export { manualPatchRemediation } from './manual-patch-semantics';

function noneNeeded(meaning: string, environmentLabel: string | null): OperatorRemediation {
	return {
		semantic: 'verified',
		meaning,
		why: null,
		environmentLabel,
		nextAction: 'No se requiere intervención.',
		steps: [],
		verifyWhen: meaning,
		noCanonicalRemediation: false,
	};
}

function unverifiedRefresh(
	meaning: string,
	why: string,
	environmentLabel: string | null,
	verifyWhen: string,
): OperatorRemediation {
	return {
		semantic: 'unverified',
		meaning,
		why,
		environmentLabel,
		nextAction:
			'Obtenga evidencia de solo lectura. Esta consulta no aplica migraciones ni promociones.',
		steps: [step('Diagnose', REFRESH_COMMAND, 'Consulta read-only; no ejecuta mutaciones.', false, false, 'Revalidar evidencia')],
		verifyWhen,
		noCanonicalRemediation: false,
	};
}

function identityDiagnoseCommand(env: TargetEnv): string | null {
	if (env === 'production') return null;
	return `pnpm invitation:diagnose-identity -- --target ${env}`;
}

function contentParityCommand(slug: string, eventType: string): string {
	return `pnpm invitation:content-parity -- --slug ${slug} --event-type ${eventType}`;
}

function draftAuditCommand(slug: string, env: TargetEnv): string {
	return `pnpm invitation:draft-audit -- --slug ${slug} --target ${env}`;
}

export function schemaLifecycleSemantic(
	lifecycle: SchemaLifecycleState,
	evidence: EvidenceState,
): StatusSemantic {
	if (evidence === 'UNVERIFIED' || lifecycle === 'UNVERIFIED') return 'unverified';
	if (lifecycle === 'CURRENT') return 'verified';
	return 'blocked';
}

export function readinessSemantic(readiness: SchemaOperationReadiness): StatusSemantic {
	if (readiness === 'READY') return 'verified';
	if (readiness === 'UNVERIFIED' || readiness === 'NOT_CONFIGURED') return 'unverified';
	return 'blocked';
}

export function authorizationSemantic(status: AuthorizationIntegrity): StatusSemantic {
	if (status === 'NOT_APPLICABLE') return 'neutral';
	if (status === 'RECORDED' || status === 'GRANDFATHERED') return 'verified';
	if (status === 'UNVERIFIED') return 'unverified';
	return 'blocked';
}

export function evidenceSemantic(evidence: EvidenceState): StatusSemantic {
	if (evidence === 'LIVE') return 'verified';
	return 'unverified';
}

export function schemaRemediation(row: CanonicalEnvSummary): OperatorRemediation {
	const environmentLabel = ENV_LABELS[row.environment];
	const semantic = schemaLifecycleSemantic(row.schemaLifecycle, row.evidence);
	if (semantic === 'verified') {
		return noneNeeded(
			`El historial de migraciones está CURRENT (${row.appliedCount ?? '—'}/${row.expectedCount}).`,
			environmentLabel,
		);
	}
	if (semantic === 'unverified') {
		return unverifiedRefresh(
			'El historial de migraciones no está verificado.',
			row.evidence === 'UNVERIFIED'
				? 'No hay una sonda en vivo de schema_migrations para este entorno.'
				: 'classifySchemaLifecycle devolvió UNVERIFIED.',
			environmentLabel,
			'Esquema CURRENT con evidencia LIVE o en caché vigente.',
		);
	}
	if (row.schemaLifecycle === 'SCHEMA_DRIFT') {
		return {
			semantic: 'blocked',
			meaning: 'Hay migraciones extra o divergencia de historial.',
			why:
				row.extraMigrations.length > 0
					? `Versiones extra: ${row.extraMigrations.join(', ')}.`
					: 'classifySchemaLifecycle devolvió SCHEMA_DRIFT.',
			environmentLabel,
			nextAction:
				'Audite objetos de esquema. No aplique migraciones solo para poner el indicador en verde.',
			steps: [
				step(
					'Diagnose',
					row.schemaNextAction ?? `pnpm db:${row.environment === 'production' ? 'prod' : row.environment}:audit`,
					'No aplique migraciones solo para corregir drift.',
					false,
					false,
					'Auditar esquema',
				),
			],
			verifyWhen: 'Esquema CURRENT sin extraMigrations, con evidencia suficiente.',
			noCanonicalRemediation: false,
		};
	}
	const pending =
		row.pendingMigrations.length > 0
			? `Pendientes: ${row.pendingMigrations.join(', ')}.`
			: 'classifySchemaLifecycle devolvió BEHIND.';
	const productionPreflight = row.environment === 'production';
	return {
		semantic: 'blocked',
		meaning: 'El historial de migraciones está detrás del repositorio.',
		why: pending,
		environmentLabel,
		nextAction: productionPreflight
			? 'Ejecute el preflight de solo lectura. El apply de Production exige TTY del propietario y no corre desde este panel.'
			: 'Ejecute el preflight de migración. El apply queda fuera de esta vista.',
		steps: row.schemaNextAction
			? [
					step(
						'Verify',
						row.schemaNextAction,
						'Confirme el preflight antes de cualquier apply.',
						productionPreflight,
						false,
						'Verificar migración',
					),
					...(productionPreflight
						? [
								step('Plan', 'pnpm prod:apply -- --schema', 'Preflight sin mutaciones aprobado.', true, false, 'Planificar apply'),
								step('Apply', 'pnpm prod:apply -- --schema --apply', 'Plan revisado; requiere TTY del propietario.', true, false, 'Aplicar migración'),
						  ]
						: []),
				  ]
			: [],
		verifyWhen: 'Esquema CURRENT con evidencia suficiente.',
		noCanonicalRemediation: row.schemaNextAction == null,
	};
}

export function readinessRemediation(row: CanonicalEnvSummary): OperatorRemediation {
	const environmentLabel = ENV_LABELS[row.environment];
	const semantic = readinessSemantic(row.schemaOperationReadiness);
	if (semantic === 'verified') {
		return noneNeeded('La operación de migración está lista (prueba disposable vigente y sin pendientes).', environmentLabel);
	}
	if (row.schemaOperationReadiness === 'UNVERIFIED') {
		return unverifiedRefresh(
			'La idoneidad de migración no está verificada.',
			'No hay evidencia suficiente de conectividad o historial para clasificar la operación.',
			environmentLabel,
			'Preparación Lista con evidencia suficiente.',
		);
	}
	if (row.schemaOperationReadiness === 'NOT_CONFIGURED') {
		return {
			semantic: 'unverified',
			meaning: 'Este entorno no tiene credenciales configuradas.',
			why: 'deriveSchemaOperationFields clasificó NOT_CONFIGURED.',
			environmentLabel,
			nextAction: 'Verifique disponibilidad e identidad. No infiera un estado sano por ausencia de filas.',
			steps: row.schemaNextAction
				? [step('Diagnose', row.schemaNextAction, 'Verifique disponibilidad e identidad antes de operar.', false, false, 'Diagnosticar entorno')]
				: [],
			verifyWhen: 'El entorno está configurado, alcanzable y clasificado.',
			noCanonicalRemediation: row.schemaNextAction == null,
		};
	}
	if (row.schemaOperationReadiness === 'UNREACHABLE') {
		return {
			semantic: 'blocked',
			meaning: 'El entorno no es alcanzable.',
			why: 'La sonda de conectividad falló o expiró.',
			environmentLabel,
			nextAction: 'Diagnostique alcance e identidad. No migre ni promocione con evidencia ausente.',
			steps: row.schemaNextAction
				? [step('Diagnose', row.schemaNextAction, 'No migre ni promocione con evidencia ausente.', false, false, 'Diagnosticar alcance')]
				: [],
			verifyWhen: 'El entorno es alcanzable y la preparación deja de ser UNREACHABLE.',
			noCanonicalRemediation: row.schemaNextAction == null,
		};
	}
	if (row.schemaOperationReadiness === 'NEEDS_DISPOSABLE_PROOF') {
		return {
			semantic: 'blocked',
			meaning: 'Falta una prueba disposable vigente. CURRENT en persistentes no autoriza migrar.',
			why: 'deriveSchemaOperationFields exige prueba disposable antes de operar.',
			environmentLabel,
			nextAction:
				'Aplique migraciones en disposable-test (no es Local persistente). Luego vuelva a verificar.',
			steps: [
				step(
					'Apply',
					row.schemaNextAction ?? DISPOSABLE_PROOF_COMMAND,
					'Se ejecuta únicamente en disposable-test.',
					false,
					false,
					'Generar prueba disposable',
				),
				step('Verify', REFRESH_COMMAND, 'Después de completar la prueba disposable.', false, false, 'Revalidar preparación'),
			],
			verifyWhen: 'Prueba disposable VÁLIDA y preparación Lista.',
			noCanonicalRemediation: false,
		};
	}
	if (row.schemaOperationReadiness === 'SCHEMA_DRIFT') {
		return schemaRemediation({ ...row, schemaLifecycle: 'SCHEMA_DRIFT' });
	}
	return {
		semantic: 'blocked',
		meaning: 'Hay migraciones pendientes y la prueba disposable está vigente.',
		why:
			row.pendingMigrations.length > 0
				? `Pendientes: ${row.pendingMigrations.join(', ')}.`
				: READINESS_LABELS.PENDING_MIGRATIONS,
		environmentLabel,
		nextAction:
			row.environment === 'production'
				? 'Preflight de solo lectura. El apply de Production exige TTY del propietario.'
				: 'Ejecute el preflight de migración. El apply queda fuera de esta vista.',
		steps: row.schemaNextAction
			? [
					step('Verify', row.schemaNextAction, 'Confirme el preflight antes de cualquier apply.', row.environment === 'production', false, 'Verificar migración'),
					...(row.environment === 'production'
						? [
								step('Plan', 'pnpm prod:apply -- --schema', 'Preflight sin mutaciones aprobado.', true, false, 'Planificar apply'),
								step('Apply', 'pnpm prod:apply -- --schema --apply', 'Plan revisado; requiere TTY del propietario.', true, false, 'Aplicar migración'),
						  ]
						: []),
				  ]
			: [],
		verifyWhen: 'Preparación Lista y esquema CURRENT.',
		noCanonicalRemediation: row.schemaNextAction == null,
	};
}

export function authorizationRemediation(row: CanonicalEnvSummary): OperatorRemediation {
	const environmentLabel = ENV_LABELS[row.environment];
	const semantic = authorizationSemantic(row.authorizationIntegrity);
	if (semantic === 'neutral') {
		return {
			semantic: 'neutral',
			meaning: 'La integridad de autorización del propietario solo aplica a Production.',
			why: null,
			environmentLabel,
			nextAction: 'No se requiere intervención.',
			steps: [],
			verifyWhen: 'Sigue siendo No aplica en Local y Preview.',
			noCanonicalRemediation: false,
		};
	}
	if (row.authorizationIntegrity === 'RECORDED') {
		return noneNeeded(
			'Las migraciones posteriores al corte del libro tienen evidencia de apply del propietario.',
			environmentLabel,
		);
	}
	if (row.authorizationIntegrity === 'GRANDFATHERED') {
		return noneNeeded(
			'No hay migraciones posteriores al corte del libro. El historial previo queda aceptado, no rellenado.',
			environmentLabel,
		);
	}
	if (row.authorizationIntegrity === 'UNVERIFIED') {
		return unverifiedRefresh(
			'La autorización de Production no está verificada.',
			'Hace falta historial de migraciones en vivo para compararlo con el libro del propietario.',
			environmentLabel,
			'Autorización Registrada o Previa al libro, con evidencia suficiente.',
		);
	}
	const missing =
		row.authorizationMissingVersions.length > 0
			? `Versiones sin registro: ${row.authorizationMissingVersions.join(', ')}.`
			: 'Hay historial de Production posterior al corte sin evidencia de apply del propietario.';
	return {
		semantic: 'blocked',
		meaning: 'CURRENT no es evidencia de autorización del propietario.',
		why: missing,
		environmentLabel,
		nextAction:
			'No existe un comando canónico para registrar applies históricos. Un apply futuro de Production escribe el libro. No rellene el libro a mano ni trate CURRENT como autorización.',
		steps: [step('Manual/HITL', null, 'No se pueden registrar applies históricos desde este panel.', true, false, 'Revisión Owner')],
		verifyWhen:
			'authorizationIntegrity deja de ser MISSING (RECORDED tras un apply autorizado que cubra las versiones, o evidencia equivalente del libro).',
		noCanonicalRemediation: true,
	};
}

export function evidenceRemediation(row: CanonicalEnvSummary): OperatorRemediation {
	const environmentLabel = ENV_LABELS[row.environment];
	if (row.evidence === 'LIVE') {
		return noneNeeded('La sonda remota de este entorno está en vivo.', environmentLabel);
	}
	if (row.evidence === 'CACHED') {
		return {
			semantic: 'unverified',
			meaning: 'La evidencia es reciente pero ya no es una sonda en vivo.',
			why: row.probedAt ? `Última sonda: ${row.probedAt}.` : 'Hay una vista en caché.',
			environmentLabel,
			nextAction:
				'Vuelva a consultar si necesita evidencia en vivo. Ejecutar la consulta no implica que los indicadores queden verificados.',
			steps: [step('Diagnose', REFRESH_COMMAND, 'Consulta read-only; no ejecuta mutaciones.', false, false, 'Revalidar evidencia')],
			verifyWhen: 'Evidencia LIVE para este entorno.',
			noCanonicalRemediation: false,
		};
	}
	return unverifiedRefresh(
		'No hay evidencia remota de este entorno.',
		'La vista local-first no sonda Preview ni Production hasta una actualización explícita.',
		environmentLabel,
		'Evidencia LIVE o en caché vigente, con estados clasificados.',
	);
}

export function invitationAttentionRemediation(row: CanonicalEnvSummary): OperatorRemediation {
	const environmentLabel = ENV_LABELS[row.environment];
	if (row.evidence === 'UNVERIFIED') {
		return unverifiedRefresh(
			'La publicación de este entorno no está verificada.',
			'Un conteo 0 sin sonda en vivo no significa que el registro esté en sync.',
			environmentLabel,
			'Conteo de atención clasificado con evidencia LIVE o en caché vigente.',
		);
	}
	if (row.identityConflictsCount > 0) {
		const command = identityDiagnoseCommand(row.environment);
		return {
			semantic: 'blocked',
			meaning: 'Hay conflictos de identidad en filas activas.',
			why: `${row.identityConflictsCount} conflicto(s) de identidad.`,
			environmentLabel,
			nextAction: command
				? 'Diagnostique identidad en este entorno. No promocione.'
				: 'El diagnóstico de identidad rechaza Production. No hay un comando canónico contra Production.',
			steps: [step(command ? 'Diagnose' : 'Manual/HITL', command, 'No promocione hasta resolver el conflicto de identidad.', false, false, command ? 'Diagnosticar identidad' : 'Revisión manual')],
			verifyWhen: 'identityConflictsCount = 0 y classifyLiveInvitation deja de devolver conflict.',
			noCanonicalRemediation: command == null,
		};
	}
	if (row.invitationAttentionCount === 0) {
		return noneNeeded('Las invitaciones del registro coinciden con el canónico en este entorno.', environmentLabel);
	}
	return {
		semantic: 'neutral',
		meaning: `${row.invitationAttentionCount} invitación(es) del registro no están en match.`,
		why: 'El conteo incluye behind, absent, diverged, conflict u unknown. La cola de publicación decide la acción.',
		environmentLabel,
		nextAction: 'Inspeccione las tarjetas de la cola de publicación. Este conteo no es una operación.',
		steps: [step('Manual/HITL', null, 'La cola de publicación define la acción; este conteo no es una operación.', false, false, 'Revisar cola')],
		verifyWhen: 'invitationAttentionCount = 0 con evidencia suficiente.',
		noCanonicalRemediation: true,
	};
}

export function disposableRemediation(proof: CanonicalDisposableProof): OperatorRemediation {
	if (proof.status === 'valid') {
		return noneNeeded('La prueba disposable-test está vigente.', 'disposable-test');
	}
	return {
		semantic: 'blocked',
		meaning:
			proof.status === 'stale'
				? 'La prueba disposable existe pero está obsoleta respecto al repositorio.'
				: 'No hay prueba disposable vigente.',
		why: proof.reason,
		environmentLabel: 'disposable-test',
		nextAction:
			'Aplique migraciones en disposable-test. Esto no indica deuda de esquema en Local, Preview o Production.',
		steps: [
			step('Apply', DISPOSABLE_PROOF_COMMAND, 'Se ejecuta únicamente en disposable-test.', false, false, 'Generar prueba disposable'),
			step('Verify', REFRESH_COMMAND, 'Después de completar disposable-test.', false, false, 'Revalidar estado'),
		],
		verifyWhen: 'Prueba disposable VÁLIDA.',
		noCanonicalRemediation: false,
	};
}

function unknownPublicationRemediation(row: CanonicalPromotionRow): OperatorRemediation {
	const environmentLabel = 'registro';
		if (row.reasonCode === 'CANONICAL_UNAVAILABLE') {
			return {
				semantic: 'unverified',
				meaning: PUBLICATION_REASON_LABELS.CANONICAL_UNAVAILABLE,
				why: 'classifyLiveInvitation no pudo usar una huella canónica.',
				environmentLabel,
				nextAction:
					'No hay remediación canónica en este panel. Corrija la definición del registro de invitaciones en el repositorio.',
				steps: [step('Manual/HITL', null, 'Corrija la definición canónica antes de promocionar.', false, false, 'Revisión manual')],
				verifyWhen: 'La huella canónica se construye y decidePromotionAction deja de ser UNKNOWN.',
				noCanonicalRemediation: true,
			};
		}
		const needsRevalidation = row.handoff.dryRunCommand === 'pnpm dbs';
		const diagnosticCause = row.uncertaintyNotes.find((note) =>
			/^[A-Z][A-Z0-9_]+$/.test(note),
		);
		if (needsRevalidation) {
			return {
				semantic: 'unverified',
				meaning: PUBLICATION_REASON_LABELS.EVIDENCE_INCOMPLETE,
				why: row.uncertaintyNotes.length > 0 ? row.uncertaintyNotes.join(' · ') : null,
				environmentLabel,
				nextAction:
					'Revalide evidencia en vivo. No promocione mientras el entorno no haya sido sondado.',
				steps: row.handoff.dryRunCommand
					? [step('Diagnose', row.handoff.dryRunCommand, 'No promocione mientras la evidencia esté incompleta.', false, false, 'Revalidar publicación')]
					: [],
				verifyWhen: 'decidePromotionAction deja de ser UNKNOWN.',
				noCanonicalRemediation: false,
			};
		}
		return {
			semantic: 'unverified',
			meaning: PUBLICATION_REASON_LABELS.EVIDENCE_INCOMPLETE,
			why:
				row.uncertaintyNotes.length > 0
					? row.uncertaintyNotes.join(' · ')
					: diagnosticCause
						? `Causa: ${diagnosticCause}.`
						: 'El entorno está en vivo pero no se pudo construir la huella promocional.',
			environmentLabel,
			nextAction:
				'No hay remediación canónica. El acceso al entorno tuvo éxito; la clasificación promocional sigue incompleta. No promocione.',
			steps: [
				...(row.handoff.optionalDiagnosticCommand
					? [step('Diagnose', row.handoff.optionalDiagnosticCommand, 'Opcional; no remedia UNKNOWN.', false, true, 'Diagnóstico opcional')]
					: []),
				step('Manual/HITL', null, 'No hay remediación canónica para esta clasificación UNKNOWN.', false, false, 'Revisión manual'),
			],
			verifyWhen: 'decidePromotionAction deja de ser UNKNOWN.',
			noCanonicalRemediation: true,
		};
}

function blockedPublicationRemediation(row: CanonicalPromotionRow): OperatorRemediation {
	const environmentLabel = 'registro';
		if (row.reasonCode === 'IDENTITY_CONFLICT') {
			const conflictEnv = (['local', 'preview', 'production'] as const).find(
				(env) => row.environments[env] === 'conflict',
			);
			const command = conflictEnv ? identityDiagnoseCommand(conflictEnv) : identityDiagnoseCommand('local');
			return {
				semantic: 'blocked',
				meaning: PUBLICATION_REASON_LABELS.IDENTITY_CONFLICT,
				why: conflictEnv ? `Conflicto en ${ENV_LABELS[conflictEnv]}.` : null,
				environmentLabel,
				nextAction: command
					? 'Diagnostique identidad. No promocione.'
					: 'El diagnóstico de identidad rechaza Production. No hay comando canónico contra Production.',
				steps: [step(command ? 'Diagnose' : 'Manual/HITL', command, 'No promocione hasta resolver el conflicto.', false, false, command ? 'Diagnosticar identidad' : 'Revisión manual')],
				verifyWhen: 'Ningún entorno queda en conflict.',
				noCanonicalRemediation: command == null,
			};
		}
		if (row.reasonCode === 'MANAGED_DIVERGENCE') {
			return {
				semantic: 'blocked',
				meaning: PUBLICATION_REASON_LABELS.MANAGED_DIVERGENCE,
				why: null,
				environmentLabel,
				nextAction:
					'Compare contenido semántico. invitation:reconcile exige un archivo de decisiones y no cubre Production.',
				steps: [step('Diagnose', contentParityCommand(row.slug, row.eventType), 'Compare el contenido antes de reconciliar.', false, false, 'Comparar contenido')],
				verifyWhen: 'Ningún entorno queda en diverged.',
				noCanonicalRemediation: false,
			};
		}
		if (row.reasonCode === 'PRODUCTION_AHEAD_OF_PREVIEW') {
			return {
				semantic: 'blocked',
				meaning: PUBLICATION_REASON_LABELS.PRODUCTION_AHEAD_OF_PREVIEW,
				why: `Preview está ${row.environments.preview}.`,
				environmentLabel,
				nextAction: 'No promocione. No hay una ruta canónica Preview-first desde este estado.',
				steps: [step('Diagnose', contentParityCommand(row.slug, row.eventType), 'No promocione desde un estado Production-ahead.', false, false, 'Comparar contenido')],
				verifyWhen: 'Preview deja de estar behind/absent mientras Production está match, o la decisión deja de ser BLOCKED.',
				noCanonicalRemediation: true,
			};
		}
		return {
			semantic: 'blocked',
			meaning: PUBLICATION_REASON_LABELS[row.reasonCode],
			why: null,
			environmentLabel,
			nextAction: row.handoff.steps.join(' → ') || 'No promocione.',
			steps: row.handoff.dryRunCommand
				? [step('Verify', row.handoff.dryRunCommand, 'Confirme el dry-run antes de cualquier apply.', false, false, 'Verificar promoción')]
				: [],
			verifyWhen: 'Local coincide con el canónico, o la decisión deja de ser BLOCKED.',
			noCanonicalRemediation: row.handoff.dryRunCommand == null && row.handoff.applyCommand == null,
		};
}

function promotionActionRemediation(row: CanonicalPromotionRow): OperatorRemediation {
	const environmentLabel = 'registro';
	return {
		semantic: 'unverified',
		meaning: PUBLICATION_REASON_LABELS[row.reasonCode],
		why: row.uncertaintyNotes.length > 0 ? row.uncertaintyNotes.join(' · ') : null,
		environmentLabel,
		nextAction: row.handoff.ownerApplyRequired
			? 'Ejecute dry-run de solo lectura para verificar. El apply en Producción exige TTY del propietario (no ejecutable desde el panel UI).'
			: 'Ejecute dry-run para verificar. Luego ejecute apply autorizado para promocionar.',
		steps: [
			...(row.handoff.dryRunCommand
				? [step(row.handoff.dryRunStepType, row.handoff.dryRunCommand, 'Confirme el dry-run antes de cualquier apply.', row.handoff.ownerApplyRequired, false, 'Verificar promoción')]
				: []),
			...(row.handoff.applyCommand
				? [
						step('Plan', row.handoff.applyCommand.replace(/\s+--apply\b/, ''), 'Dry-run aprobado.', row.handoff.ownerApplyRequired, false, 'Planificar promoción'),
						step('Apply', row.handoff.applyCommand, 'Plan revisado; requiere TTY del propietario.', row.handoff.ownerApplyRequired, false, 'Aplicar promoción'),
				  ]
				: []),
		],
		verifyWhen: 'decidePromotionAction = NONE (IN_SYNC) con evidencia suficiente.',
		noCanonicalRemediation: row.handoff.dryRunCommand == null,
	};
}

export function publicationRemediation(row: CanonicalPromotionRow): OperatorRemediation {
	if (row.action === 'UNKNOWN') return unknownPublicationRemediation(row);
	if (row.action === 'BLOCKED') return blockedPublicationRemediation(row);
	return promotionActionRemediation(row);
}

export function publicationQueueRemediation(view: CanonicalStatusView): OperatorRemediation {
	const remoteUnverified =
		view.environments.local.evidence === 'UNVERIFIED' &&
		view.environments.preview.evidence === 'UNVERIFIED' &&
		view.environments.production.evidence === 'UNVERIFIED';
	if (remoteUnverified && view.promotions.length === 0) {
		return unverifiedRefresh(
			'La cola de publicación no está verificada.',
			'Una cola vacía sin sonda remota no significa que el registro esté en sync.',
			'registro',
			'Cola clasificada con evidencia LIVE o en caché vigente.',
		);
	}
	if (view.promotions.length === 0) {
		return noneNeeded('No hay invitaciones del registro que requieran acción.', 'registro');
	}
	const blocked = view.promotions.some((row) => row.action === 'BLOCKED');
	return {
		semantic: blocked ? 'blocked' : 'neutral',
		meaning: `${view.promotions.length} invitación(es) del registro requieren atención.`,
		why: null,
		environmentLabel: 'registro',
		nextAction: 'Siga la acción de cada tarjeta. No promocione filas BLOCKED o UNKNOWN.',
		steps: [step('Manual/HITL', null, 'Siga la acción de cada tarjeta; no promocione filas BLOCKED o UNKNOWN.', false, false, 'Revisar cola')],
		verifyWhen: 'promotions.length = 0 con evidencia suficiente.',
		noCanonicalRemediation: true,
	};
}

const DIAGNOSTIC_GAP: ReadonlySet<DiagnosticCode> = new Set([
	'BASELINE_UNAVAILABLE',
	'BASELINE_VERSION_INCOMPATIBLE',
	'DELIVERY_SCOPE_BLOCKED',
	'REQUIRED_PUBLISHED_ASSET_MISSING',
	'UNPUBLISHED_ASSET_PENDING',
	'ASSET_IDENTITY_UNVERIFIED',
	'DETAIL_BUDGET_EXCEEDED',
]);

export function diagnosticRemediation(item: CanonicalDiagnostic): OperatorRemediation {
	const environmentLabel = item.environment ? ENV_LABELS[item.environment] : null;
	if (item.code === 'PRODUCTION_AUTHORIZATION_MISSING') {
		return {
			semantic: 'blocked',
			meaning: DIAGNOSTIC_LABELS[item.code],
			why: item.cause,
			environmentLabel,
			nextAction:
				'No existe un comando canónico para registrar applies históricos. Un apply futuro de Production escribe el libro.',
			steps: [step('Manual/HITL', null, 'No existe un comando canónico para registrar applies históricos.', true, false, 'Revisión Owner')],
			verifyWhen: 'authorizationIntegrity deja de ser MISSING.',
			noCanonicalRemediation: true,
		};
	}
	if (item.code === 'ENVIRONMENT_IDENTITY_CONFLICT' && item.environment) {
		return {
			semantic: 'blocked',
			meaning: DIAGNOSTIC_LABELS[item.code],
			why: item.cause,
			environmentLabel,
			nextAction: 'Verifique identidad y alcance del entorno.',
			steps: [step('Diagnose', `pnpm db:availability:verify -- --targets ${item.environment}`, 'Verifique identidad y alcance antes de operar.', false, false, 'Verificar disponibilidad')],
			verifyWhen: 'environmentIdentityOk = true.',
			noCanonicalRemediation: false,
		};
	}
	if (
		(item.code === 'INVITATION_IDENTITY_CONFLICT' || item.code === 'AUTHORITATIVE_COUNT_MISMATCH') &&
		item.environment
	) {
		const command = identityDiagnoseCommand(item.environment);
		return {
			semantic: 'blocked',
			meaning: DIAGNOSTIC_LABELS[item.code],
			why: item.cause,
			environmentLabel,
			nextAction: command ? 'Diagnostique identidad. No promocione.' : 'No hay diagnóstico de identidad canónico contra Production.',
			steps: [step(command ? 'Diagnose' : 'Manual/HITL', command, 'No promocione hasta resolver el conflicto.', false, false, command ? 'Diagnosticar identidad' : 'Revisión manual')],
			verifyWhen: 'Los conflictos de identidad quedan en 0.',
			noCanonicalRemediation: command == null,
		};
	}
	if (item.code === 'DRAFT_INVALID' && item.slug && item.environment) {
		return {
			semantic: 'blocked',
			meaning: DIAGNOSTIC_LABELS[item.code],
			why: item.cause,
			environmentLabel,
			nextAction: 'Audite el contrato del borrador. Esta señal no cambia la cola de publicación.',
			steps: [step('Diagnose', draftAuditCommand(item.slug, item.environment), 'Audite el contrato antes de publicar.', false, false, 'Auditar borrador')],
			verifyWhen: 'El diagnóstico DRAFT_INVALID desaparece tras corregir el borrador y volver a consultar.',
			noCanonicalRemediation: false,
		};
	}
	if (item.code === 'MANAGED_DRIFT' && item.slug) {
		return {
			semantic: 'blocked',
			meaning: DIAGNOSTIC_LABELS[item.code],
			why: item.cause,
			environmentLabel,
			nextAction:
				'Consulte el slug y, desde la tarjeta de publicación, compare con invitation:content-parity (requiere --event-type). Esta señal no decide PROMOTE_*.',
			steps: [step('Manual/HITL', null, 'Compare desde la tarjeta de publicación con el comando canónico.', false, false, 'Revisión manual')],
			verifyWhen: 'La señal MANAGED_DRIFT desaparece o la cola deja de estar BLOCKED por divergencia.',
			noCanonicalRemediation: true,
		};
	}
	if (item.code === 'LIFECYCLE_METADATA_STALE') {
		return {
			semantic: 'unverified',
			meaning: DIAGNOSTIC_LABELS[item.code],
			why: item.cause,
			environmentLabel,
			nextAction: 'Señal de enriquecimiento. No cambia IN_SYNC ni autoriza una promoción.',
			steps: [step('Manual/HITL', null, 'Es una nota de enriquecimiento; no cambia la decisión de publicación.', false, false, 'Revisión manual')],
			verifyWhen: 'El metadato de ciclo de vida coincide con la publicación, o se acepta como nota.',
			noCanonicalRemediation: true,
		};
	}
	if (DIAGNOSTIC_GAP.has(item.code)) {
		return {
			semantic: item.code === 'DETAIL_BUDGET_EXCEEDED' ? 'unverified' : 'blocked',
			meaning: DIAGNOSTIC_LABELS[item.code],
			why: item.cause,
			environmentLabel,
			nextAction:
				'No hay una remediación canónica de un solo comando para esta señal. Sigue siendo enriquecimiento; no cambia la cola ni la idoneidad.',
			steps: [step('Manual/HITL', null, 'No hay una remediación canónica de un solo comando.', false, false, 'Revisión manual')],
			verifyWhen: 'La señal desaparece en un diagnóstico posterior, o se documenta como brecha.',
			noCanonicalRemediation: true,
		};
	}
	return {
		semantic: 'unverified',
		meaning: DIAGNOSTIC_LABELS[item.code],
		why: item.cause,
		environmentLabel,
		nextAction: 'Señal de enriquecimiento. No cambia la cola de publicación ni la idoneidad.',
		steps: [step('Manual/HITL', null, 'Es una señal de enriquecimiento; revise el diagnóstico.', false, false, 'Revisión manual')],
		verifyWhen: 'La señal desaparece tras una consulta con evidencia suficiente.',
		noCanonicalRemediation: true,
	};
}
