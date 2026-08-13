/**
 * invitation-promotion-orchestrator.ts — Single owner-only Production promote cycle.
 *
 * Sequence: reviewed preflight → release evidence → proportional recovery
 * → compact volatile revalidation → owner authorize → apply → verify.
 */
import { getProdDbUrl } from '../db/db-workflow-lib.ts';
import {
	ensureCriticalProductionBackup,
	revalidateCriticalProductionBackup,
	type CriticalProductionBackupPreparation,
} from '../db/critical-production-backup.ts';
import { CRITICAL_BACKUP_RPO_MS } from '../db/critical-backup-reuse.ts';
import { OperatorError, operatorSymbol, writeHuman } from '../db/operator-cli-ux.ts';
import {
	requireOwnerProductionApply,
	type OwnerProductionApplyInput,
} from '../db/owner-production-apply.ts';
import {
	clearProductionWritePermit,
	withProductionPermitScope,
	type ProductionPermitBinding,
} from '../db/production-write-permit.ts';
import { ensureValidReleaseCheckEvidence } from '../db/release-check.ts';
import type { AssetPolicy } from './asset-reconciliation.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import {
	runPromotionApply,
	runPromotionPreflight,
	type PromotionApplyReport,
	type PromotionPreflightReport,
} from './invitation-promote.ts';
import {
	buildPromotionTechnicalReview,
	formatPromotionPlanCompact,
} from './invitation-promotion-format.ts';
import {
	classifyPromotionRecoveryRisk,
	type PromotionRecoveryRisk,
	type PromotionRecoveryRiskInput,
} from './promotion-recovery-risk.ts';
import {
	revalidatePromotionVolatilePreconditions,
	type RevalidatePromotionVolatilePreconditionsInput,
} from './promotion-volatile-revalidation.ts';
import type { ConflictResolutions, UpdateScope } from './semantic-delta.ts';
import { resolvePromotionUpdateScope } from './invitation-update-options.ts';

const PROMOTION_OPERATION_TYPE = 'promotion';

export interface OrchestrateInvitationPromotionInput {
	packageData: InvitationPackageData;
	ownerUserId?: string;
	approvalsDirs?: string[];
	assetPolicy?: AssetPolicy;
	pruneAssets?: boolean;
	updateScope?: UpdateScope;
	conflictResolutions?: ConflictResolutions;
	/** Optional explicit manifest; when omitted, shared coverage capture prepares one. */
	backupManifestPath?: string;
	deliveryScope?: string;
	title?: string;
	route?: string;
	quiet?: boolean;
	getProductionDbUrl?: () => { url: string };
	runPreflight?: typeof runPromotionPreflight;
	runApply?: typeof runPromotionApply;
	requireOwnerApply?: (input: OwnerProductionApplyInput) => Promise<void>;
	ensureReleaseEvidence?: typeof ensureValidReleaseCheckEvidence;
	ensureBackup?: typeof ensureCriticalProductionBackup;
	revalidateBackup?: typeof revalidateCriticalProductionBackup;
	classifyRecoveryRisk?: (input: PromotionRecoveryRiskInput) => PromotionRecoveryRisk;
	revalidateVolatile?: (
		input: RevalidatePromotionVolatilePreconditionsInput,
	) => Promise<PromotionPreflightReport>;
	/**
	 * Composite prod:apply owns the permit and binds children to its revalidated
	 * plan. Standalone promotion instead binds to this package hash.
	 */
	authorizedProductionPermit?: ProductionPermitBinding;
}

/**
 * Owner-only Production content promotion with shared preparation gates.
 * Callers must not invoke runPromotionApply before this orchestrator authorizes.
 */
// eslint-disable-next-line complexity -- Ordered promote cycle is intentionally one gate sequence.
export async function orchestrateInvitationPromotion(
	input: OrchestrateInvitationPromotionInput,
): Promise<PromotionApplyReport> {
	const quiet = input.quiet === true;
	const getProductionDbUrl = input.getProductionDbUrl ?? getProdDbUrl;
	const runPreflight = input.runPreflight ?? runPromotionPreflight;
	const runApply = input.runApply ?? runPromotionApply;
	const ensureRelease = input.ensureReleaseEvidence ?? ensureValidReleaseCheckEvidence;
	const ensureBackup = input.ensureBackup ?? ensureCriticalProductionBackup;
	const revalidateBackup = input.revalidateBackup ?? revalidateCriticalProductionBackup;
	const classifyRecoveryRisk = input.classifyRecoveryRisk ?? classifyPromotionRecoveryRisk;
	const revalidateVolatile = input.revalidateVolatile ?? revalidatePromotionVolatilePreconditions;
	const retryCommand = 'pnpm prod:apply -- --slug <slug>';

	if (process.env.CELEBRA_TASK_SCOPE) {
		throw new OperatorError({
			title: 'Autorización de Preview no válida en Production',
			cause: 'CELEBRA_TASK_SCOPE autoriza automatización de Preview y no aprueba promoción a Production.',
			code: 'CONFIRMATION_REQUIRED',
			remediation: ['Quite CELEBRA_TASK_SCOPE y ejecute en una TTY del propietario.'],
			retryCommand,
		});
	}

	const updateScope = resolvePromotionUpdateScope({
		updateScope: input.updateScope,
		deliveryScope: input.deliveryScope,
	});

	if (!quiet) {
		writeHuman(`${operatorSymbol('info')} Preflight: evaluando release aprobada…`);
		if (updateScope && updateScope !== 'content-only') {
			writeHuman(
				`${operatorSymbol('info')} Alcance de actualización: ${updateScope}` +
					(input.assetPolicy ? ` · política de archivos: ${input.assetPolicy}` : ''),
			);
		}
	}
	const reviewed = await runPreflight({
		packageData: input.packageData,
		ownerUserId: input.ownerUserId,
		approvalsDirs: input.approvalsDirs,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope,
		conflictResolutions: input.conflictResolutions,
		backupManifestPath: input.backupManifestPath,
		requireBackup: false,
		getProductionDbUrl,
	});

	if (reviewed.status === 'BLOCKED') {
		return {
			...reviewed,
			status: 'BLOCKED',
			blockCode: reviewed.blockCode ?? 'PRODUCTION_PLAN_BLOCKED',
			reason: reviewed.reason ?? 'Promotion apply requires a successful preflight.',
		};
	}

	if (reviewed.status === 'IN_SYNC') {
		if (!quiet) {
			writeHuman(
				`${operatorSymbol('ok')} Production ya coincide con la release aprobada. No se escribió.`,
			);
		}
		return {
			...reviewed,
			status: 'IN_SYNC',
			applyResult: reviewed.engineResult,
			verification: {
				ok: true,
				detail: 'Production already matches the approved managed release; no mutation performed.',
				schema: reviewed.schema,
				managedConflicts: 0,
				provenancePackageHash: input.packageData.packageHash,
			},
		};
	}

	if (!reviewed.targetDbUrl || !reviewed.engineResult) {
		throw new OperatorError({
			title: 'Preflight incompleto',
			cause: 'El plan PROMOTABLE no incluyó destino o plan de motor.',
			code: 'PRODUCTION_PLAN_BLOCKED',
			remediation: ['Reejecute el preflight con credenciales Production válidas.'],
			retryCommand,
		});
	}

	if (!quiet) {
		writeHuman(
			formatPromotionPlanCompact(reviewed, {
				title: input.title,
				route: input.route,
				deliveryScope: input.deliveryScope,
			}),
		);
		writeHuman(`${operatorSymbol('info')} Release: asegurando evidencia de release-check…`);
	}
	ensureRelease();

	const recoveryRisk = classifyRecoveryRisk({
		reviewed,
		updateScope,
		deliveryScope: input.deliveryScope,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
	});
	let backup: CriticalProductionBackupPreparation | undefined;
	if (recoveryRisk.level === 'critical') {
		backup = ensureBackup({
			prodDbUrl: reviewed.targetDbUrl,
			purpose: 'promote-pre',
			planId: reviewed.engineResult.plan.planId,
			reuseExisting: true,
			maxAgeMs: CRITICAL_BACKUP_RPO_MS,
			retryCommand,
			operationLabel: 'la autorización de la promoción',
			failureTitle: 'Respaldo crítico previo fallido',
		});
	}

	if (!quiet) {
		writeHuman(`${operatorSymbol('info')} Revalidando precondiciones volátiles del plan…`);
	}
	const revalidated = await revalidateVolatile({
		reviewed,
		packageData: input.packageData,
		approvalsDirs: input.approvalsDirs,
		getProductionDbUrl,
	});

	if (!revalidated.targetDbUrl) {
		throw new OperatorError({
			title: 'Destino Production no disponible',
			cause: 'La revalidación no resolvió la URL de Production.',
			code: 'PRODUCTION_CREDENTIALS_UNAVAILABLE',
			remediation: ['Configure PROD_DB_URL y vuelva a ejecutar.'],
			retryCommand,
		});
	}

	if (backup) {
		revalidateBackup({
			prodDbUrl: revalidated.targetDbUrl,
			manifestPath: backup.manifestPath,
			maxAgeMs: CRITICAL_BACKUP_RPO_MS,
			retryCommand,
		});
	}

	const prepared: PromotionPreflightReport = {
		...revalidated,
		backup: backup
			? {
					required: true,
					acceptable: true,
					manifestPath: backup.manifestPath,
					createdAt: backup.coverage.manifest?.createdAt,
					projectRef: backup.coverage.manifest?.projectRef,
					canonicalCommand: reviewed.backup.canonicalCommand,
					detail: backup.reused
						? 'Verified critical Production backup coverage was reused.'
						: 'A new verified critical Production backup was captured.',
				}
			: {
					required: false,
					acceptable: true,
					canonicalCommand: reviewed.backup.canonicalCommand,
					detail: 'Full critical backup not required for routine content-only promotion; recovery uses managed provenance and retained preimage evidence.',
				},
	};

	if (!quiet) {
		writeHuman(`${operatorSymbol('ok')} Revalidación sin cambios materiales en el plan.`);
	}

	await (input.requireOwnerApply ?? requireOwnerProductionApply)({
		apply: true,
		dbUrl: prepared.targetDbUrl!,
		operationType: PROMOTION_OPERATION_TYPE,
		operationVerb: 'PROMOTE',
		bindingHex: input.packageData.packageHash,
		applyActionLabel: 'Promover',
		omitSummary: true,
		summaryTitle: 'Promoción de contenido — Production',
		summary: [
			['Operación', 'Promoción de invitación administrada'],
			['Slug', input.packageData.invitation.slug],
			[
				'Respaldo',
				backup
					? backup.reused
						? 'Cobertura crítica reutilizada'
						: 'Respaldo crítico nuevo'
					: 'No requerido · recuperación por procedencia/preimagen',
			],
			[
				'Riesgo de recuperación',
				`${recoveryRisk.level} · ${recoveryRisk.reasons.join(', ')}`,
			],
			['Autorización', 'Confirmación interactiva del propietario'],
		],
		technicalReview: buildPromotionTechnicalReview(prepared),
	});

	const permitBinding = input.authorizedProductionPermit ?? {
		bindingHex: input.packageData.packageHash,
		operationType: PROMOTION_OPERATION_TYPE,
	};
	const apply = () =>
		withProductionPermitScope(permitBinding, () =>
			runApply({
				preflight: prepared,
				packageData: input.packageData,
				ownerUserId: input.ownerUserId,
				assetPolicy: input.assetPolicy,
				pruneAssets: input.pruneAssets,
				updateScope,
				conflictResolutions: input.conflictResolutions,
			}),
		);

	if (input.authorizedProductionPermit) return apply();
	try {
		return await apply();
	} finally {
		clearProductionWritePermit();
	}
}
