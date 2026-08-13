import { ENV_LABELS, PUBLICATION_REASON_LABELS } from './labels';
import {
	identityDiagnoseCommand,
	noneNeeded,
	step,
	type OperatorRemediation,
	unverifiedRefresh,
} from './operator-remediation';
import type { CanonicalPromotionRow, CanonicalStatusView } from './types';

function contentParityCommand(slug: string, eventType: string): string {
	return `pnpm invitation:content-parity -- --slug ${slug} --event-type ${eventType}`;
}

function unknownPublicationRemediation(row: CanonicalPromotionRow): OperatorRemediation {
	const environmentLabel = 'registro';
	if (row.reasonCode === 'PRODUCTION_PREFLIGHT_UNVERIFIED') {
		return {
			semantic: 'unverified',
			meaning: PUBLICATION_REASON_LABELS.PRODUCTION_PREFLIGHT_UNVERIFIED,
			why: 'El preflight canónico falló, expiró o devolvió una salida no verificable.',
			environmentLabel,
			nextAction: 'Repita únicamente el dry-run canónico. No promocione sin evidencia viva.',
			steps: row.handoff.dryRunCommand
				? [
						step(
							'Verify',
							row.handoff.dryRunCommand,
							'Solo lectura; no promocione si vuelve a fallar.',
							false,
							false,
							'Revalidar Production',
						),
					]
				: [],
			verifyWhen: 'El preflight devuelve PROMOTABLE, IN_SYNC o un bloqueo explícito.',
			noCanonicalRemediation: row.handoff.dryRunCommand == null,
		};
	}
	if (row.reasonCode === 'CANONICAL_UNAVAILABLE') {
		return {
			semantic: 'unverified',
			meaning: PUBLICATION_REASON_LABELS.CANONICAL_UNAVAILABLE,
			why: 'classifyLiveInvitation no pudo usar una huella canónica.',
			environmentLabel,
			nextAction:
				'No hay remediación canónica en este panel. Corrija la definición del registro de invitaciones en el repositorio.',
			steps: [
				step(
					'Manual/HITL',
					null,
					'Corrija la definición canónica antes de promocionar.',
					false,
					false,
					'Revisión manual',
				),
			],
			verifyWhen:
				'La huella canónica se construye y decidePromotionAction deja de ser UNKNOWN.',
			noCanonicalRemediation: true,
		};
	}
	const needsRevalidation = row.handoff.dryRunCommand === 'pnpm dbs';
	if (needsRevalidation) {
		return {
			semantic: 'unverified',
			meaning: PUBLICATION_REASON_LABELS.EVIDENCE_INCOMPLETE,
			why: row.uncertaintyNotes.length > 0 ? row.uncertaintyNotes.join(' · ') : null,
			environmentLabel,
			nextAction:
				'Revalide evidencia en vivo. No promocione mientras el entorno no haya sido sondado.',
			steps: [
				step(
					'Diagnose',
					row.handoff.dryRunCommand,
					'No promocione mientras la evidencia esté incompleta.',
					false,
					false,
					'Revalidar publicación',
				),
			],
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
				: 'El entorno está en vivo pero no se pudo construir la huella promocional.',
		environmentLabel,
		nextAction:
			'No hay remediación canónica. El acceso al entorno tuvo éxito; la clasificación promocional sigue incompleta. No promocione.',
		steps: [
			...(row.handoff.optionalDiagnosticCommand
				? [
						step(
							'Diagnose',
							row.handoff.optionalDiagnosticCommand,
							'Opcional; no remedia UNKNOWN.',
							false,
							true,
							'Diagnóstico opcional',
						),
					]
				: []),
			step(
				'Manual/HITL',
				null,
				'No hay remediación canónica para esta clasificación UNKNOWN.',
				false,
				false,
				'Revisión manual',
			),
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
		const command = conflictEnv
			? identityDiagnoseCommand(conflictEnv)
			: identityDiagnoseCommand('local');
		return {
			semantic: 'blocked',
			meaning: PUBLICATION_REASON_LABELS.IDENTITY_CONFLICT,
			why: conflictEnv ? `Conflicto en ${ENV_LABELS[conflictEnv]}.` : null,
			environmentLabel,
			nextAction: command
				? 'Diagnostique identidad. No promocione.'
				: 'El diagnóstico de identidad rechaza Production. No hay comando canónico contra Production.',
			steps: [
				step(
					command ? 'Diagnose' : 'Manual/HITL',
					command,
					'No promocione hasta resolver el conflicto.',
					false,
					false,
					command ? 'Diagnosticar identidad' : 'Revisión manual',
				),
			],
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
			steps: [
				step(
					'Diagnose',
					contentParityCommand(row.slug, row.eventType),
					'Compare el contenido antes de reconciliar.',
					false,
					false,
					'Comparar contenido',
				),
			],
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
			steps: [
				step(
					'Diagnose',
					contentParityCommand(row.slug, row.eventType),
					'No promocione desde un estado Production-ahead.',
					false,
					false,
					'Comparar contenido',
				),
			],
			verifyWhen:
				'Preview deja de estar behind/absent mientras Production está match, o la decisión deja de ser BLOCKED.',
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
			? [
					step(
						'Verify',
						row.handoff.dryRunCommand,
						'Confirme el dry-run antes de cualquier apply.',
						false,
						false,
						'Verificar promoción',
					),
				]
			: [],
		verifyWhen: 'Local coincide con el canónico, o la decisión deja de ser BLOCKED.',
		noCanonicalRemediation:
			row.handoff.dryRunCommand == null && row.handoff.applyCommand == null,
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
				? [
						step(
							row.handoff.dryRunStepType,
							row.handoff.dryRunCommand,
							'Confirme el dry-run antes de cualquier apply.',
							row.handoff.ownerApplyRequired,
							false,
							'Verificar promoción',
						),
					]
				: []),
			...(row.handoff.applyCommand
				? [
						step(
							'Plan',
							row.handoff.applyCommand.replace(/\s+--apply\b/, ''),
							'Dry-run aprobado.',
							row.handoff.ownerApplyRequired,
							false,
							'Planificar promoción',
						),
						step(
							'Apply',
							row.handoff.applyCommand,
							'Plan revisado; requiere TTY del propietario.',
							row.handoff.ownerApplyRequired,
							false,
							'Aplicar promoción',
						),
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
		steps: [
			step(
				'Manual/HITL',
				null,
				'Siga la acción de cada tarjeta; no promocione filas BLOCKED o UNKNOWN.',
				false,
				false,
				'Revisar cola',
			),
		],
		verifyWhen: 'promotions.length = 0 con evidencia suficiente.',
		noCanonicalRemediation: true,
	};
}
