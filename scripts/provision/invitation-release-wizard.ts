/**
 * Destination-driven interactive wizard for pnpm invitation:release.
 * Operator selects outcomes; this module owns package binding, ordering, and menus.
 */
import { confirm, select } from '@inquirer/prompts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getProdDbUrl } from '../db/db-workflow-lib.ts';
import { operatorSymbol, writeHuman } from '../db/operator-cli-ux.ts';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	planAndApplyLocalContent,
	planAndApplyPreviewContent,
} from './invitation-content-apply.ts';
import {
	buildPreflightBlockedResults,
	deriveLifecycleFinalStatus,
	executeTargetPlans,
	type LifecycleExecutionError,
	type TargetExecutionOutcome,
} from './invitation-lifecycle-execution.ts';
import { getInvitationDefinition, listInvitationDefinitions } from './invitations/registry.ts';
import { resolveInvitationPackageInput } from './invitation-package-input.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import {
	defaultDestinationFromPromotionAction,
	describeDestination,
	isStaleProvenanceBlockReason,
	resolveDestinationReadiness,
	type ReleaseDestination,
	type WizardMenuDestination,
} from './invitation-release-destination.ts';
import { approvePreviewArtifactFromLiveVerification } from './preview-approval-service.ts';
import { getDefaultPreviewApprovalStore } from './preview-approval-store.ts';
import {
	PREVIEW_LIVE_CHECKLIST_KEYS,
	verifyPreviewArtifactLive,
} from './preview-live-verification.ts';
import {
	inspectPreviewProvenanceReceipt,
	reconcileStalePreviewProvenance,
} from './preview-provenance-receipt-service.ts';
import { authorizePreviewWriteApply } from './preview-write-auth.ts';
import {
	formatApplyResult,
	formatDryRunPlan,
	toOperationalPlanData,
	type TargetApplyResultData,
	type TargetPlanData,
} from './invitation-update-presenter.ts';
import type { OperationalPlan } from './invitation-update-plan.ts';
import type { ConflictResolutions, UpdateScope } from './semantic-delta.ts';
import type { AssetPolicy } from './asset-reconciliation.ts';
import { defaultAssetPolicy, requireResolvedUpdateScope } from './invitation-update-options.ts';
import { runPromotionPreflight } from './invitation-promote.ts';
import { formatPromotionPlanCompact } from './invitation-promotion-format.ts';
import { isTargetDivergenceConflictMessage } from './promotion-comparison.ts';
import {
	planLocal,
	planPreview,
	promptConflictResolutions,
	resolvePromotionActionForSlug,
	reviewAndConfirm,
	sumTargetResults,
} from './wizard/wizard-planning.ts';

export interface ReleaseWizardSession {
	slug: string;
	packageData: InvitationPackageData;
	packagePath?: string;
	sourceHash: string;
	packageHash: string;
	updateScope: UpdateScope;
	assetPolicy: AssetPolicy;
	pruneAssets?: boolean;
	conflictResolutions?: ConflictResolutions;
	acknowledgeDiscardUnpublishedDraft?: boolean;
}

function persistSessionPackage(packageData: InvitationPackageData): string {
	const relative = `.agent/tmp/packages/invitation-${packageData.invitation.slug}-${packageData.packageHash.slice(0, 16)}.json`;
	const absolute = resolve(process.cwd(), relative);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
	return absolute;
}

async function maybeRecoverConflicts(
	session: ReleaseWizardSession,
	targetPlans: TargetPlanData[],
): Promise<boolean> {
	const conflicts = targetPlans.flatMap((tp) => tp.mergeConflicts ?? []);
	const onlyMergeBlocks =
		conflicts.length > 0 &&
		targetPlans
			.filter((tp) => tp.status === 'BLOQUEADO')
			.every((tp) => (tp.mergeConflicts?.length ?? 0) > 0);
	if (!onlyMergeBlocks) return false;

	const action = await select({
		message: 'El plan está bloqueado por conflictos. ¿Qué desea hacer?',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			{ name: 'Resolver conflictos campo a campo', value: 'resolve' as const },
			{ name: 'Volver', value: 'back' as const },
		],
	});
	if (action !== 'resolve') return false;
	session.conflictResolutions = await promptConflictResolutions(conflicts);
	return true;
}

async function maybeRecoverUnpublishedDraftDivergence(
	session: ReleaseWizardSession,
	targetPlans: TargetPlanData[],
): Promise<boolean> {
	if (session.acknowledgeDiscardUnpublishedDraft) return false;
	const blocked = targetPlans.filter((tp) => tp.status === 'BLOQUEADO');
	if (blocked.length === 0) return false;
	const allDivergence = blocked.every((tp) => isTargetDivergenceConflictMessage(tp.reason ?? ''));
	if (!allDivergence) return false;

	const confirmed = await confirm({
		message:
			'El destino tiene un borrador inédito distinto del paquete y de lo publicado. ¿Descartar esas ediciones y aplicar el paquete?',
		default: false,
	});
	if (!confirmed) return false;
	session.acknowledgeDiscardUnpublishedDraft = true;
	return true;
}

async function maybeRecoverStaleProvenance(session: ReleaseWizardSession): Promise<boolean> {
	if (!session.packagePath) return false;
	let diagnosis;
	try {
		diagnosis = await inspectPreviewProvenanceReceipt({ packagePath: session.packagePath });
	} catch (error) {
		writeHuman(
			`${operatorSymbol('warn')} No se pudo diagnosticar provenance: ${error instanceof Error ? error.message : String(error)}`,
		);
		return false;
	}
	if (diagnosis.status !== 'RECOVERABLE' || !diagnosis.recoveryEligible) {
		writeHuman(
			`${operatorSymbol('fail')} Provenance no recuperable automáticamente: ${diagnosis.message}`,
		);
		return false;
	}

	writeHuman(
		`${operatorSymbol('warn')} Baseline de Preview desfasado respecto a un receipt de verificación. Solo se actualizará metadata (sin contenido ni Storage).`,
	);
	try {
		await authorizePreviewWriteApply({
			slug: session.slug,
			operation: 'apply',
			confirmPrompt: `Confirm Preview baseline reconcile for "${session.slug}"? Type YES to proceed: `,
			isInteractive: true,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('PREVIEW_WRITE_CANCELLED')) {
			writeHuman(`${operatorSymbol('info')} Reconciliación cancelada.`);
			return false;
		}
		throw error;
	}

	const applied = await reconcileStalePreviewProvenance({
		packagePath: session.packagePath,
		apply: true,
	});
	if (!applied.applied || applied.status !== 'IN_SYNC') {
		writeHuman(`${operatorSymbol('fail')} La reconciliación no dejó Preview en sincronía.`);
		return false;
	}
	writeHuman(`${operatorSymbol('ok')} Provenance de Preview reconciliada.`);
	return true;
}

async function ensurePreviewApprovalForProduction(session: ReleaseWizardSession): Promise<boolean> {
	const alreadyReady = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	if (alreadyReady.productionReady) {
		writeHuman(
			`${operatorSymbol('ok')} Preview ya está aprobado exactamente para este packageHash. Production: pnpm prod:apply -- --slug ${session.slug} --apply`,
		);
		return true;
	}

	const pending = getDefaultPreviewApprovalStore().get(session.packageHash);
	if (pending?.approvalState === 'pending_hosted_validation') {
		await runLiveApproval(session);
		const readiness = await resolveDestinationReadiness({
			slug: session.slug,
			packagePath: session.packagePath,
		});
		return readiness.productionReady;
	}

	writeHuman(
		`${operatorSymbol('info')} Preview ya coincide con el canónico. Ejecutando verificación Preview para materializar la aprobación…`,
	);
	const preview = await planPreview(session);
	if (preview.targetPlan.status === 'BLOQUEADO') {
		if (isStaleProvenanceBlockReason(preview.targetPlan.reason)) {
			const recovered = await maybeRecoverStaleProvenance(session);
			if (!recovered) return false;
			return ensurePreviewApprovalForProduction(session);
		}
		writeHuman(
			`${operatorSymbol('fail')} Preview bloqueado: ${preview.targetPlan.reason ?? 'motivo desconocido'}`,
		);
		return false;
	}

	if (!preview.targetDbUrl || !preview.plan) {
		writeHuman(`${operatorSymbol('fail')} No hay plan Preview para la verificación.`);
		return false;
	}

	try {
		await authorizePreviewWriteApply({
			slug: session.slug,
			operation: 'apply',
			confirmPrompt: `Confirm Preview verify for "${session.slug}"? Type YES to proceed: `,
			isInteractive: true,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('PREVIEW_WRITE_CANCELLED')) {
			writeHuman(`${operatorSymbol('info')} Verificación cancelada.`);
			return false;
		}
		throw error;
	}

	await planAndApplyPreviewContent({
		packageData: session.packageData,
		targetDbUrl: preview.targetDbUrl,
		apply: true,
		plan: preview.plan,
		updateScope: session.updateScope,
		assetPolicy: session.assetPolicy,
		pruneAssets: session.pruneAssets,
		conflictResolutions: session.conflictResolutions,
		acknowledgeDiscardUnpublishedDraft: session.acknowledgeDiscardUnpublishedDraft,
	});
	await maybeCompletePreviewApproval(session);
	const readiness = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	return readiness.productionReady;
}

async function runLiveApproval(session: ReleaseWizardSession): Promise<void> {
	const pending = getDefaultPreviewApprovalStore().get(session.packageHash);
	if (!pending) {
		writeHuman(
			`${operatorSymbol('warn')} No hay aprobación pendiente para este packageHash. Vuelva a aplicar Preview.`,
		);
		return;
	}
	const live = await verifyPreviewArtifactLive(pending);
	writeHuman(`Verificación Preview en vivo · ${pending.slug}`);
	for (const key of PREVIEW_LIVE_CHECKLIST_KEYS) {
		writeHuman(`  ${live.checklistResults[key] ? 'OK' : 'FALLO'}  ${key}`);
	}
	if (!live.ok) {
		writeHuman(
			`${operatorSymbol('fail')} La verificación en vivo falló. No se puede aprobar esta release.`,
		);
		return;
	}
	const decision = await select({
		message: `¿Aprobar la release verificada de Preview para "${session.slug}"?`,
		default: 'cancel',
		choices: [
			{ name: 'Cancelar (no aprobar ahora)', value: 'cancel' as const },
			{ name: 'Aprobar Preview para Production', value: 'approve' as const },
		],
	});
	if (decision !== 'approve') {
		writeHuman(`${operatorSymbol('info')} Aprobación omitida. Puede aprobar más tarde.`);
		return;
	}
	await authorizePreviewWriteApply({
		slug: session.slug,
		operation: 'approve',
		confirmPrompt: `Confirm Preview approval for "${session.slug}"? Type YES to proceed: `,
		isInteractive: true,
	});
	const finalized = approvePreviewArtifactFromLiveVerification({
		packageHash: session.packageHash,
		reviewedBy: process.env.USERNAME?.trim() || process.env.USER?.trim() || 'preview-owner',
		intendedProductionProjectRef: SUPABASE_PROJECT_REFS.production,
		live,
	});
	writeHuman(
		`${operatorSymbol('ok')} Aprobación completada · ${finalized.slug} · ${finalized.packageHash.slice(0, 16)}…`,
	);
}

/** Skip live verify/approve when resolveDestinationReadiness already says Production-ready. */
async function maybeCompletePreviewApproval(session: ReleaseWizardSession): Promise<void> {
	const readiness = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	if (readiness.productionReady) {
		writeHuman(
			`${operatorSymbol('ok')} Preview ya tiene aprobación exacta para este packageHash. No se vuelve a verificar ni aprobar. Production: pnpm prod:apply -- --slug ${session.slug} --apply`,
		);
		return;
	}
	await runLiveApproval(session);
}

async function applyLocalOutcome(session: ReleaseWizardSession): Promise<void> {
	for (;;) {
		const { plan, targetPlan } = await planLocal(session);
		const planData = toOperationalPlanData(session.slug, ['local'], [targetPlan], {
			updateScope: session.updateScope,
			assetPolicy: session.assetPolicy,
		});
		if (targetPlan.status === 'BLOQUEADO') {
			const recovered = await maybeRecoverConflicts(session, [targetPlan]);
			if (recovered) continue;
			const discarded = await maybeRecoverUnpublishedDraftDivergence(session, [targetPlan]);
			if (discarded) continue;
			console.log(formatDryRunPlan(planData, { verbose: false }));
			return;
		}
		if (targetPlan.status === 'SIN CAMBIOS') {
			writeHuman(`${operatorSymbol('ok')} Local ya está sincronizado. No hay cambios.`);
			return;
		}
		const decision = await reviewAndConfirm(planData);
		if (decision === 'cancel' || decision === 'back') return;
		if (!plan) return;

		const confirmed = await confirm({
			message: `¿Aplicar la release administrada de "${session.slug}" en Local?`,
			default: false,
		});
		if (!confirmed) {
			writeHuman(`${operatorSymbol('info')} Cancelado. No se escribieron cambios.`);
			return;
		}
		const executed = await planAndApplyLocalContent({
			slug: session.slug,
			apply: true,
			plan,
			updateScope: session.updateScope,
			assetPolicy: session.assetPolicy,
			pruneAssets: session.pruneAssets,
			conflictResolutions: session.conflictResolutions,
			acknowledgeDiscardUnpublishedDraft: session.acknowledgeDiscardUnpublishedDraft,
			expectedSourceHash: session.sourceHash,
			expectedPackageHash: session.packageHash,
		});
		const targetResults: TargetApplyResultData[] = [
			{
				target: 'local',
				planId: executed.plan.planId,
				status: executed.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS APLICADOS',
				completedOperations: executed.completedOperations,
				databaseWrites: {
					inserts: executed.databaseInserts,
					updates: executed.databaseUpdates,
					deletes: executed.databaseDeletes,
				},
				storageMutations: {
					uploads: executed.storageUploads,
					overwrites: executed.storageOverwrites,
					moves: executed.storageMoves,
					deletes: executed.storageDeletes,
				},
				publishedVersion: executed.publishedVersion,
				functionalChanges: executed.functionalChanges,
			},
		];
		console.log(
			formatApplyResult({
				invitation: session.slug,
				status: deriveLifecycleFinalStatus(targetResults),
				environment: 'local',
				completedOperations: executed.completedOperations,
				databaseWrites: targetResults[0]!.databaseWrites,
				storageMutations: targetResults[0]!.storageMutations,
				targetResults,
				functionalChanges: executed.functionalChanges,
			}),
		);
		return;
	}
}

async function applyPreparePreviewOutcome(session: ReleaseWizardSession): Promise<void> {
	for (;;) {
		const local = await planLocal(session);
		const preview = await planPreview(session);
		const targetPlans = [local.targetPlan, preview.targetPlan];
		const planData = toOperationalPlanData(session.slug, ['local', 'preview'], targetPlans, {
			updateScope: session.updateScope,
			assetPolicy: session.assetPolicy,
		});

		if (targetPlans.some((tp) => tp.status === 'BLOQUEADO')) {
			const recovered = await maybeRecoverConflicts(session, targetPlans);
			if (recovered) continue;
			const discarded = await maybeRecoverUnpublishedDraftDivergence(session, targetPlans);
			if (discarded) continue;
			const previewBlocked = targetPlans.find(
				(tp) => tp.target === 'preview' && tp.status === 'BLOQUEADO',
			);
			if (isStaleProvenanceBlockReason(previewBlocked?.reason)) {
				const reconciled = await maybeRecoverStaleProvenance(session);
				if (reconciled) continue;
			}
			const blocked = buildPreflightBlockedResults(['local', 'preview'], targetPlans);
			console.log(formatDryRunPlan(planData, { verbose: false }));
			if (blocked) {
				console.log(
					formatApplyResult({
						invitation: session.slug,
						status: 'BLOQUEADO',
						environment: 'local, preview',
						completedOperations: 0,
						databaseWrites: { inserts: 0, updates: 0, deletes: 0 },
						storageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
						reason: targetPlans.find((tp) => tp.status === 'BLOQUEADO')?.reason,
						targetResults: blocked,
					}),
				);
			}
			return;
		}

		const decision = await reviewAndConfirm(planData);
		if (decision === 'cancel' || decision === 'back') return;

		const executionPlans = new Map<'local' | 'preview', OperationalPlan>();
		if (local.plan) executionPlans.set('local', local.plan);
		if (preview.plan) executionPlans.set('preview', preview.plan);

		const summary = await executeTargetPlans({
			targets: ['local', 'preview'],
			targetPlans,
			sanitizeError: (error) => (error instanceof Error ? error.message : String(error)),
			executeTarget: async (target): Promise<TargetExecutionOutcome> => {
				if (target === 'local') {
					const confirmed = await confirm({
						message: `¿Aplicar Local para "${session.slug}"?`,
						default: false,
					});
					if (!confirmed) {
						throw Object.assign(new Error('OPERATOR_CANCELLED'), {
							mutationStarted: false,
							cancelled: true,
						}) as LifecycleExecutionError;
					}
					const localPlan = executionPlans.get('local');
					if (!localPlan) {
						throw Object.assign(new Error('No existe plan Local.'), {
							mutationStarted: false,
						}) as LifecycleExecutionError;
					}
					const executed = await planAndApplyLocalContent({
						slug: session.slug,
						apply: true,
						plan: localPlan,
						updateScope: session.updateScope,
						assetPolicy: session.assetPolicy,
						pruneAssets: session.pruneAssets,
						conflictResolutions: session.conflictResolutions,
						acknowledgeDiscardUnpublishedDraft:
							session.acknowledgeDiscardUnpublishedDraft,
						expectedSourceHash: session.sourceHash,
						expectedPackageHash: session.packageHash,
					});
					return {
						executionPlanId: executed.plan.planId,
						receiptPlanId: executed.receipt?.planId ?? '',
						result: {
							target: 'local',
							planId: executed.plan.planId,
							status: executed.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS APLICADOS',
							completedOperations: executed.completedOperations,
							databaseWrites: {
								inserts: executed.databaseInserts,
								updates: executed.databaseUpdates,
								deletes: executed.databaseDeletes,
							},
							storageMutations: {
								uploads: executed.storageUploads,
								overwrites: executed.storageOverwrites,
								moves: executed.storageMoves,
								deletes: executed.storageDeletes,
							},
							publishedVersion: executed.publishedVersion,
							functionalChanges: executed.functionalChanges,
						},
					};
				}

				if (!preview.targetDbUrl) {
					throw Object.assign(new Error('Preview DB URL no disponible.'), {
						mutationStarted: false,
					}) as LifecycleExecutionError;
				}
				try {
					await authorizePreviewWriteApply({
						slug: session.slug,
						operation: 'apply',
						confirmPrompt: `Confirm Preview apply for "${session.slug}"? Type YES to proceed: `,
						isInteractive: true,
					});
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : String(error);
					if (message.includes('PREVIEW_WRITE_CANCELLED')) {
						throw Object.assign(new Error('OPERATOR_CANCELLED'), {
							mutationStarted: false,
							cancelled: true,
						}) as LifecycleExecutionError;
					}
					throw error;
				}
				const previewPlan = executionPlans.get('preview');
				if (!previewPlan) {
					throw Object.assign(new Error('No existe plan Preview.'), {
						mutationStarted: false,
					}) as LifecycleExecutionError;
				}
				const executed = await planAndApplyPreviewContent({
					packageData: session.packageData,
					targetDbUrl: preview.targetDbUrl,
					apply: true,
					plan: previewPlan,
					updateScope: session.updateScope,
					assetPolicy: session.assetPolicy,
					pruneAssets: session.pruneAssets,
					conflictResolutions: session.conflictResolutions,
					acknowledgeDiscardUnpublishedDraft: session.acknowledgeDiscardUnpublishedDraft,
				});
				const appliedPlan = executed.plan;
				if (!appliedPlan) {
					throw Object.assign(new Error('Preview apply returned no plan.'), {
						mutationStarted: true,
					}) as LifecycleExecutionError;
				}
				return {
					executionPlanId: appliedPlan.planId,
					receiptPlanId: executed.receipt?.planId ?? '',
					result: {
						target: 'preview',
						planId: appliedPlan.planId,
						status: executed.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS APLICADOS',
						completedOperations: executed.executedMutations,
						databaseWrites: appliedPlan.physicalDatabaseOps,
						storageMutations: appliedPlan.storageOps,
						publishedVersion: executed.publishedVersion,
						functionalChanges: executed.functionalChanges,
					},
				};
			},
		});

		const finalStatus = deriveLifecycleFinalStatus(summary.targetResults);
		const totals = sumTargetResults(summary.targetResults);
		console.log(
			formatApplyResult({
				invitation: session.slug,
				status: finalStatus,
				environment: 'local, preview',
				completedOperations: totals.completedOperations,
				databaseWrites: totals.databaseWrites,
				storageMutations: totals.storageMutations,
				targetResults: summary.targetResults,
			}),
		);

		const previewApplied = summary.targetResults.some(
			(r) =>
				r.target === 'preview' &&
				(r.status === 'CAMBIOS APLICADOS' || r.status === 'SIN CAMBIOS'),
		);
		if (!summary.executionFailed && previewApplied) {
			await maybeCompletePreviewApproval(session);
		}
		return;
	}
}

async function applyProductionOutcome(session: ReleaseWizardSession): Promise<void> {
	let readiness = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	if (!readiness.productionReady) {
		writeHuman(
			`${operatorSymbol('warn')} Production no está lista: ${readiness.productionBlockReason ?? 'falta aprobación Preview exacta.'}`,
		);
		const promotionAction = await resolvePromotionActionForSlug(session.slug);
		if (promotionAction === 'PROMOTE_PRODUCTION') {
			const next = await select({
				message: 'Preview ya coincide con el canónico. ¿Qué desea hacer?',
				default: 'approve',
				choices: [
					{ name: 'Volver', value: 'back' as const },
					{
						name: 'Aprobar Preview ahora (sin reaplicar contenido)',
						value: 'approve' as const,
					},
					{
						name: 'Preparar Preview completo (Local + Preview)',
						value: 'prepare' as const,
					},
				],
			});
			if (next === 'back') return;
			if (next === 'prepare') {
				await applyPreparePreviewOutcome(session);
				return;
			}
			const approved = await ensurePreviewApprovalForProduction(session);
			if (!approved) return;
			readiness = await resolveDestinationReadiness({
				slug: session.slug,
				packagePath: session.packagePath,
			});
			if (!readiness.productionReady) {
				writeHuman(
					`${operatorSymbol('fail')} Sigue faltando aprobación Preview exacta tras la verificación.`,
				);
				return;
			}
		} else {
			const next = await select({
				message: 'Seleccione una acción',
				default: 'back',
				choices: [
					{ name: 'Volver', value: 'back' as const },
					{ name: 'Preparar Preview ahora', value: 'prepare' as const },
				],
			});
			if (next === 'prepare') {
				await applyPreparePreviewOutcome(session);
			}
			return;
		}
	}

	const definition = getInvitationDefinition(session.slug);
	writeHuman(`${operatorSymbol('info')} Preflight Production…`);
	// Match CLI dry-run: defer critical backup to the orchestrator recovery classifier.
	const preflight = await runPromotionPreflight({
		packageData: session.packageData,
		updateScope: session.updateScope,
		assetPolicy: session.assetPolicy,
		requireBackup: false,
		getProductionDbUrl: getProdDbUrl,
	});
	if (preflight.status === 'BLOCKED') {
		writeHuman(
			`${operatorSymbol('fail')} Production bloqueada: ${preflight.reason ?? preflight.blockCode}`,
		);
		return;
	}
	if (preflight.status === 'IN_SYNC') {
		writeHuman(`${operatorSymbol('ok')} Production ya coincide con la release aprobada.`);
		return;
	}
	writeHuman(formatPromotionPlanCompact(preflight, { title: definition.title }));
	writeHuman(
		`${operatorSymbol('info')} Para aplicar: pnpm prod:apply -- --slug ${session.slug} --apply`,
	);
}

async function buildSession(slug: string): Promise<ReleaseWizardSession> {
	const packageInput = await resolveInvitationPackageInput({ slug });
	const packagePath = persistSessionPackage(packageInput.packageData);
	const definition = getInvitationDefinition(slug);
	const updateScope = requireResolvedUpdateScope({
		deliveryScope: definition.deliveryScope,
	});
	const assetPolicy = defaultAssetPolicy(updateScope);
	return {
		slug,
		packageData: packageInput.packageData,
		packagePath,
		sourceHash: packageInput.packageData.sourceHash,
		packageHash: packageInput.packageData.packageHash,
		updateScope,
		assetPolicy,
		pruneAssets: updateScope === 'content-and-assets',
	};
}

/**
 * Interactive destination-driven release session.
 * Returns after the operator cancels or finishes working with the invitation.
 */
export async function runDestinationReleaseWizard(input?: { slug?: string }): Promise<void> {
	writeHuman('=== Celebra-me · Asistente de publicación administrada ===\n');

	let slug = input?.slug;
	if (!slug) {
		slug = await select({
			message: 'Selecciona la invitación administrada',
			choices: listInvitationDefinitions()
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.map((definition) => ({
					name: `${definition.title} · ${definition.slug}`,
					value: definition.slug,
				})),
		});
	}

	let session = await buildSession(slug);
	writeHuman(
		`Release: ${session.packageHash.slice(0, 16)}… · alcance ${session.updateScope} · política ${session.assetPolicy}\n`,
	);

	for (;;) {
		const readiness = await resolveDestinationReadiness({
			slug: session.slug,
			packagePath: session.packagePath,
		});
		const promotionAction = await resolvePromotionActionForSlug(session.slug);
		const recommended = defaultDestinationFromPromotionAction(promotionAction);
		const productionLabel =
			readiness.productionReady || promotionAction === 'PROMOTE_PRODUCTION'
				? `${describeDestination('production')}${promotionAction === 'PROMOTE_PRODUCTION' ? ' · recomendado' : ''} (Preview ${readiness.productionReady ? 'aprobado' : 'alineado'}; apply: pnpm prod:apply)`
				: `${describeDestination('production')} (requiere Preview aprobado)`;
		const prepareLabel =
			recommended === 'prepare_preview'
				? `${describeDestination('prepare_preview')} · recomendado`
				: describeDestination('prepare_preview');

		const destination = await select({
			message: '¿Qué resultado desea?',
			default: recommended,
			choices: [
				{ name: 'Cancelar', value: 'cancel' as WizardMenuDestination },
				{ name: describeDestination('local'), value: 'local' as WizardMenuDestination },
				{
					name: prepareLabel,
					value: 'prepare_preview' as WizardMenuDestination,
				},
				{ name: productionLabel, value: 'production' as WizardMenuDestination },
				{
					name: 'Actualizar paquete desde definición',
					value: 'refresh' as WizardMenuDestination,
				},
			],
		});

		if (destination === 'cancel') {
			writeHuman(`${operatorSymbol('info')} Sesión finalizada. No hay más escrituras.`);
			return;
		}
		if (destination === 'refresh') {
			session = await buildSession(session.slug);
			writeHuman(
				`${operatorSymbol('ok')} Paquete actualizado · ${session.packageHash.slice(0, 16)}…`,
			);
			continue;
		}

		try {
			if (destination === 'local') {
				await applyLocalOutcome(session);
			} else if (destination === 'prepare_preview') {
				await applyPreparePreviewOutcome(session);
			} else {
				await applyProductionOutcome(session);
			}
		} catch (error) {
			if (error instanceof Error && error.message === 'OPERATOR_CANCELLED') {
				writeHuman(`${operatorSymbol('info')} Cancelado. No se escribieron cambios.`);
				continue;
			}
			writeHuman(
				`${operatorSymbol('fail')} ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}

export type { ReleaseDestination };
