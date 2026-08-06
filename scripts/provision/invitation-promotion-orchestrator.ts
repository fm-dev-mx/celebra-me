/**
 * invitation-promotion-orchestrator.ts — Single owner-only Production promote cycle.
 *
 * Sequence: reviewed preflight → release evidence → critical backup → rebuild/drift
 * → owner authorize → apply → verify. Domains stay in invitation-promote.ts; this
 * module owns ordered preparation only.
 */
import { getProdDbUrl } from '../db/db-workflow-lib.ts';
import {
	ensureCriticalProductionBackup,
	revalidateCriticalProductionBackup,
} from '../db/critical-production-backup.ts';
import { CRITICAL_BACKUP_RPO_MS } from '../db/critical-backup-reuse.ts';
import { OperatorError, operatorSymbol, writeHuman } from '../db/operator-cli-ux.ts';
import {
	requireOwnerProductionApply,
	type OwnerProductionApplyInput,
} from '../db/owner-production-apply.ts';
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
import type { ConflictResolutions, UpdateScope } from './semantic-delta.ts';

const PROMOTION_OPERATION_TYPE = 'promotion';

/**
 * Prefer explicit --update-scope; otherwise honor definition deliveryScope so first-time
 * Production promotes with content-and-assets upload missing binaries (not preserve-block).
 */
export function resolvePromotionUpdateScope(input: {
	updateScope?: UpdateScope;
	deliveryScope?: string;
}): UpdateScope | undefined {
	if (input.updateScope) return input.updateScope;
	if (
		input.deliveryScope === 'content-only' ||
		input.deliveryScope === 'content-and-assets' ||
		input.deliveryScope === 'assets-only'
	) {
		return input.deliveryScope;
	}
	return undefined;
}

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
}

function assertPlanIdentity(
	reviewed: PromotionPreflightReport,
	rebuilt: PromotionPreflightReport,
): void {
	const reviewedPlanId = reviewed.engineResult?.plan.planId;
	const rebuiltPlanId = rebuilt.engineResult?.plan.planId;
	if (!reviewedPlanId || !rebuiltPlanId || reviewedPlanId !== rebuiltPlanId) {
		throw new OperatorError({
			title: 'El plan de promoción cambió',
			cause: 'La evidencia de Production o la release ya no coincide con el plan revisado. Se requiere un nuevo preflight.',
			code: 'PLAN_DRIFT',
			remediation: [
				'Vuelva a ejecutar pnpm invitation:promote para obtener un plan nuevo.',
				'No confirme un plan que ya no coincide con la evidencia actual.',
			],
			retryCommand: 'pnpm invitation:promote',
		});
	}
	if (
		reviewed.packageHash !== rebuilt.packageHash ||
		reviewed.sourceHash !== rebuilt.sourceHash ||
		reviewed.projectionHash !== rebuilt.projectionHash
	) {
		throw new OperatorError({
			title: 'La identidad de la release cambió',
			cause: 'Los hashes del paquete ya no coinciden con el plan revisado.',
			code: 'PLAN_DRIFT',
			remediation: [
				'Regenere el paquete o vuelva a seleccionar la invitación.',
				'Reejecute el flujo interactivo desde el principio.',
			],
			retryCommand: 'pnpm invitation:promote',
		});
	}
	if (rebuilt.status === 'BLOCKED') {
		throw new OperatorError({
			title: 'La promoción quedó bloqueada tras la revalidación',
			cause: rebuilt.reason ?? rebuilt.blockCode ?? 'Preflight bloqueado.',
			code: rebuilt.blockCode ?? 'PRODUCTION_PLAN_BLOCKED',
			remediation: [
				'Corrija el bloqueo reportado (schema, aprobación, divergencia o respaldo).',
				'Reejecute pnpm invitation:promote.',
			],
			retryCommand: 'pnpm invitation:promote',
		});
	}
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
	const retryCommand = 'pnpm invitation:promote';

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

	const backup = ensureBackup({
		prodDbUrl: reviewed.targetDbUrl,
		purpose: 'promote-pre',
		planId: reviewed.engineResult.plan.planId,
		reuseExisting: true,
		maxAgeMs: CRITICAL_BACKUP_RPO_MS,
		retryCommand,
		operationLabel: 'la autorización de la promoción',
		failureTitle: 'Respaldo crítico previo fallido',
	});

	if (!quiet) {
		writeHuman(`${operatorSymbol('info')} Revalidando evidencia del plan…`);
	}
	const rebuilt = await runPreflight({
		packageData: input.packageData,
		ownerUserId: input.ownerUserId,
		approvalsDirs: input.approvalsDirs,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope,
		conflictResolutions: input.conflictResolutions,
		backupManifestPath: backup.manifestPath,
		requireBackup: true,
		getProductionDbUrl,
	});
	assertPlanIdentity(reviewed, rebuilt);

	if (!rebuilt.targetDbUrl) {
		throw new OperatorError({
			title: 'Destino Production no disponible',
			cause: 'La revalidación no resolvió la URL de Production.',
			code: 'PRODUCTION_CREDENTIALS_UNAVAILABLE',
			remediation: ['Configure PROD_DB_URL y vuelva a ejecutar.'],
			retryCommand,
		});
	}

	revalidateBackup({
		prodDbUrl: rebuilt.targetDbUrl,
		manifestPath: backup.manifestPath,
		maxAgeMs: CRITICAL_BACKUP_RPO_MS,
		retryCommand,
	});

	if (!quiet) {
		writeHuman(`${operatorSymbol('ok')} Revalidación sin cambios materiales en el plan.`);
	}

	await (input.requireOwnerApply ?? requireOwnerProductionApply)({
		apply: true,
		dbUrl: rebuilt.targetDbUrl,
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
				backup.reused ? 'Cobertura crítica reutilizada' : 'Respaldo crítico nuevo',
			],
			['Autorización', 'Confirmación interactiva del propietario'],
		],
		technicalReview: buildPromotionTechnicalReview(rebuilt),
	});

	return runApply({
		preflight: rebuilt,
		packageData: input.packageData,
		ownerUserId: input.ownerUserId,
		assetPolicy: input.assetPolicy,
		pruneAssets: input.pruneAssets,
		updateScope,
		conflictResolutions: input.conflictResolutions,
	});
}
