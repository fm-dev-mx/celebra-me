/**
 * Destination-driven interactive wizard for pnpm invitation:release.
 * Operator selects outcomes; this module owns package binding, ordering, and menus.
 */
import { confirm, select } from '@inquirer/prompts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { LOCAL_DB_URL } from '../db/db-target-config.ts';
import {
	assertPreviewDbUrl,
	getPreviewDbUrl,
	getProdDbUrl,
} from '../db/db-workflow-lib.ts';
import { operatorSymbol, writeHuman } from '../db/operator-cli-ux.ts';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	assertContentSchemaCurrent,
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
import {
	getInvitationDefinition,
	listInvitationDefinitions,
} from './invitations/registry.ts';
import { resolveInvitationPackageInput } from './invitation-package-input.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import {
	describeDestination,
	resolveDestinationReadiness,
	type ReleaseDestination,
} from './invitation-release-destination.ts';
import { approvePreviewArtifactFromLiveVerification } from './preview-approval-service.ts';
import { getDefaultPreviewApprovalStore } from './preview-approval-store.ts';
import {
	PREVIEW_LIVE_CHECKLIST_KEYS,
	verifyPreviewArtifactLive,
} from './preview-live-verification.ts';
import { authorizePreviewWriteApply } from './preview-write-auth.ts';
import {
	formatApplyConfirmation,
	formatApplyResult,
	formatDryRunPlan,
	consolidateTargetFunctionalChanges,
	type OperationalPlanData,
	type TargetPlanData,
	type TargetApplyResultData,
} from './invitation-update-presenter.ts';
import type { OperationalPlan } from './invitation-update-plan.ts';
import {
	mergePathPolicies,
	suggestConflictResolutionsFile,
} from './conflict-resolutions.ts';
import {
	MergeConflictError,
	listDriftConflicts,
	type ConflictResolutions,
	type UpdateScope,
} from './semantic-delta.ts';
import { parseAssetPolicy, type AssetPolicy } from './asset-reconciliation.ts';
import { runPromotionPreflight } from './invitation-promote.ts';
import { formatPromotionPlanCompact } from './invitation-promotion-format.ts';
import { resolvePromotionUpdateScope } from './invitation-promotion-orchestrator.ts';
import { isTargetDivergenceConflictMessage } from './promotion-comparison.ts';

export interface ReleaseWizardSession {
	slug: string;
	packageData: InvitationPackageData;
	packagePath?: string;
	sourceHash: string;
	packageHash: string;
	updateScope: UpdateScope;
	assetPolicy: AssetPolicy;
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

function mergeConflictsFromError(error: unknown): TargetPlanData['mergeConflicts'] {
	let current: unknown = error;
	while (current) {
		if (current instanceof MergeConflictError) {
			return listDriftConflicts(current.deltas).map((delta) => ({
				path: delta.path,
				previousCanonicalValue: delta.previousCanonicalValue,
				packageValue: delta.currentCanonicalValue,
				targetValue: delta.currentTargetValue,
			}));
		}
		if (current instanceof Error && 'cause' in current && current.cause) {
			current = current.cause;
			continue;
		}
		break;
	}
	return undefined;
}

async function promptConflictResolutions(
	conflicts: NonNullable<TargetPlanData['mergeConflicts']>,
): Promise<ConflictResolutions> {
	const suggested = suggestConflictResolutionsFile(conflicts);
	const resolutions: ConflictResolutions = {};
	writeHuman(
		`${operatorSymbol('warn')} Hay conflictos. Elija por campo (paquete canónico vs destino).`,
	);
	for (const conflict of conflicts) {
		const choice = await select({
			message: `Conflicto en ${conflict.path}`,
			default: 'package',
			choices: [
				{
					name: `Usar paquete (canónico): ${JSON.stringify(conflict.packageValue)}`,
					value: 'package' as const,
				},
				{
					name: `Conservar destino: ${JSON.stringify(conflict.targetValue)}`,
					value: 'target' as const,
				},
				{ name: 'Cancelar', value: 'cancel' as const },
			],
		});
		if (choice === 'cancel') {
			throw new Error('OPERATOR_CANCELLED');
		}
		resolutions[conflict.path] = choice;
	}
	return mergePathPolicies(suggested.resolutions, resolutions) ?? resolutions;
}

async function planLocal(
	session: ReleaseWizardSession,
): Promise<{ plan?: OperationalPlan; targetPlan: TargetPlanData }> {
	assertContentSchemaCurrent({ target: 'local', dbUrl: LOCAL_DB_URL });
	try {
		const result = await planAndApplyLocalContent({
			slug: session.slug,
			apply: false,
			updateScope: session.updateScope,
			assetPolicy: session.assetPolicy,
			conflictResolutions: session.conflictResolutions,
			acknowledgeDiscardUnpublishedDraft: session.acknowledgeDiscardUnpublishedDraft,
			expectedSourceHash: session.sourceHash,
			expectedPackageHash: session.packageHash,
		});
		return {
			plan: result.plan,
			targetPlan: {
				target: 'local',
				planId: result.plan?.planId,
				status: result.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS PENDIENTES',
				plannedOperations: result.plannedOperations,
				expectedDatabaseWrites: {
					inserts: result.databaseInserts,
					updates: result.databaseUpdates,
					deletes: result.databaseDeletes,
				},
				expectedStorageMutations: {
					uploads: result.storageUploads,
					overwrites: result.storageOverwrites,
					moves: result.storageMoves,
					deletes: result.storageDeletes,
				},
				actions: result.actions,
				functionalChanges: result.functionalChanges,
				publishedVersion: result.publishedVersion,
			},
		};
	} catch (error) {
		return {
			targetPlan: {
				target: 'local',
				status: 'BLOQUEADO',
				reason: error instanceof Error ? error.message : String(error),
				mergeConflicts: mergeConflictsFromError(error),
				plannedOperations: 0,
				expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
				expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				actions: [],
			},
		};
	}
}

async function planPreview(
	session: ReleaseWizardSession,
): Promise<{ plan?: OperationalPlan; targetPlan: TargetPlanData; targetDbUrl?: string }> {
	let targetDbUrl: string;
	try {
		const resolved = getPreviewDbUrl();
		assertPreviewDbUrl(resolved.url);
		targetDbUrl = resolved.url;
	} catch {
		return {
			targetPlan: {
				target: 'preview',
				status: 'BLOQUEADO',
				reason: 'Credenciales de Preview no configuradas o perímetro inválido.',
				plannedOperations: 0,
				expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
				expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				actions: [],
			},
		};
	}

	assertContentSchemaCurrent({ target: 'preview', dbUrl: targetDbUrl });
	try {
		const result = await planAndApplyPreviewContent({
			packageData: session.packageData,
			targetDbUrl,
			apply: false,
			updateScope: session.updateScope,
			assetPolicy: session.assetPolicy,
			conflictResolutions: session.conflictResolutions,
			acknowledgeDiscardUnpublishedDraft: session.acknowledgeDiscardUnpublishedDraft,
		});
		return {
			plan: result.plan,
			targetDbUrl,
			targetPlan: {
				target: 'preview',
				planId: result.plan?.planId,
				status: result.isZeroDrift ? 'SIN CAMBIOS' : 'CAMBIOS PENDIENTES',
				plannedOperations: result.plannedMutations,
				expectedDatabaseWrites: result.plan?.physicalDatabaseOps ?? {
					inserts: 0,
					updates: 0,
					deletes: 0,
				},
				expectedStorageMutations: result.plan?.storageOps ?? {
					uploads: 0,
					overwrites: 0,
					moves: 0,
					deletes: 0,
				},
				actions: result.actions,
				functionalChanges: result.functionalChanges,
				publishedVersion: result.publishedVersion,
			},
		};
	} catch (error) {
		return {
			targetDbUrl,
			targetPlan: {
				target: 'preview',
				status: 'BLOQUEADO',
				reason: error instanceof Error ? error.message : String(error),
				mergeConflicts: mergeConflictsFromError(error),
				plannedOperations: 0,
				expectedDatabaseWrites: { inserts: 0, updates: 0, deletes: 0 },
				expectedStorageMutations: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
				actions: [],
			},
		};
	}
}

function toPlanData(
	session: ReleaseWizardSession,
	targets: Array<'local' | 'preview'>,
	targetPlans: TargetPlanData[],
): OperationalPlanData {
	return {
		invitation: session.slug,
		targets,
		isZeroDrift: targetPlans.every((tp) => tp.status === 'SIN CAMBIOS'),
		plannedOperations: targetPlans.reduce((sum, tp) => sum + tp.plannedOperations, 0),
		expectedDatabaseWrites: {
			inserts: targetPlans.reduce((s, tp) => s + tp.expectedDatabaseWrites.inserts, 0),
			updates: targetPlans.reduce((s, tp) => s + tp.expectedDatabaseWrites.updates, 0),
			deletes: targetPlans.reduce((s, tp) => s + tp.expectedDatabaseWrites.deletes, 0),
		},
		expectedStorageMutations: {
			uploads: targetPlans.reduce((s, tp) => s + tp.expectedStorageMutations.uploads, 0),
			overwrites: targetPlans.reduce((s, tp) => s + tp.expectedStorageMutations.overwrites, 0),
			moves: targetPlans.reduce((s, tp) => s + (tp.expectedStorageMutations.moves ?? 0), 0),
			deletes: targetPlans.reduce((s, tp) => s + tp.expectedStorageMutations.deletes, 0),
		},
		actions: targetPlans.flatMap((tp) => tp.actions),
		functionalChanges: consolidateTargetFunctionalChanges(targetPlans),
		targetPlans,
	};
}

async function reviewAndConfirm(planData: OperationalPlanData): Promise<'apply' | 'back' | 'cancel'> {
	console.log(formatDryRunPlan(planData, { verbose: false }));
	console.log('');
	console.log(formatApplyConfirmation(planData, { verbose: false }));
	return select({
		message: 'Seleccione una acción',
		default: 'cancel',
		choices: [
			{ name: 'Cancelar', value: 'cancel' as const },
			{ name: 'Volver', value: 'back' as const },
			{ name: 'Aplicar plan revisado', value: 'apply' as const },
		],
	});
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
	const allDivergence = blocked.every((tp) =>
		isTargetDivergenceConflictMessage(tp.reason ?? ''),
	);
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

async function applyLocalOutcome(session: ReleaseWizardSession): Promise<void> {
	for (;;) {
		const { plan, targetPlan } = await planLocal(session);
		const planData = toPlanData(session, ['local'], [targetPlan]);
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
		const planData = toPlanData(session, ['local', 'preview'], targetPlans);

		if (targetPlans.some((tp) => tp.status === 'BLOQUEADO')) {
			const recovered = await maybeRecoverConflicts(session, targetPlans);
			if (recovered) continue;
			const discarded = await maybeRecoverUnpublishedDraftDivergence(session, targetPlans);
			if (discarded) continue;
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
						conflictResolutions: session.conflictResolutions,
						acknowledgeDiscardUnpublishedDraft: session.acknowledgeDiscardUnpublishedDraft,
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
		console.log(
			formatApplyResult({
				invitation: session.slug,
				status: finalStatus,
				environment: 'local, preview',
				completedOperations: summary.targetResults.reduce(
					(s, r) => s + r.completedOperations,
					0,
				),
				databaseWrites: {
					inserts: summary.targetResults.reduce((s, r) => s + r.databaseWrites.inserts, 0),
					updates: summary.targetResults.reduce((s, r) => s + r.databaseWrites.updates, 0),
					deletes: summary.targetResults.reduce((s, r) => s + r.databaseWrites.deletes, 0),
				},
				storageMutations: {
					uploads: summary.targetResults.reduce(
						(s, r) => s + r.storageMutations.uploads,
						0,
					),
					overwrites: summary.targetResults.reduce(
						(s, r) => s + r.storageMutations.overwrites,
						0,
					),
					moves: summary.targetResults.reduce(
						(s, r) => s + (r.storageMutations.moves ?? 0),
						0,
					),
					deletes: summary.targetResults.reduce(
						(s, r) => s + r.storageMutations.deletes,
						0,
					),
				},
				targetResults: summary.targetResults,
			}),
		);

		const previewApplied = summary.targetResults.some(
			(r) =>
				r.target === 'preview' &&
				(r.status === 'CAMBIOS APLICADOS' || r.status === 'SIN CAMBIOS'),
		);
		if (!summary.executionFailed && previewApplied) {
			await runLiveApproval(session);
		}
		return;
	}
}

async function applyProductionOutcome(session: ReleaseWizardSession): Promise<void> {
	const readiness = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	if (!readiness.productionReady) {
		writeHuman(
			`${operatorSymbol('warn')} Production no está lista: ${readiness.productionBlockReason ?? 'falta aprobación Preview exacta.'}`,
		);
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

	const definition = getInvitationDefinition(session.slug);
	const updateScope = resolvePromotionUpdateScope({
		updateScope: session.updateScope,
		deliveryScope: definition.deliveryScope,
	});
	writeHuman(`${operatorSymbol('info')} Preflight Production…`);
	// Match CLI dry-run: defer critical backup to the orchestrator recovery classifier.
	const preflight = await runPromotionPreflight({
		packageData: session.packageData,
		updateScope,
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
	const updateScope: UpdateScope =
		definition.deliveryScope === 'content-and-assets' ||
		definition.deliveryScope === 'assets-only' ||
		definition.deliveryScope === 'content-only'
			? definition.deliveryScope
			: 'content-only';
	const assetPolicy = parseAssetPolicy(
		updateScope === 'content-only' ? 'preserve' : 'missing',
	);
	return {
		slug,
		packageData: packageInput.packageData,
		packagePath,
		sourceHash: packageInput.packageData.sourceHash,
		packageHash: packageInput.packageData.packageHash,
		updateScope,
		assetPolicy,
	};
}

/**
 * Interactive destination-driven release session.
 * Returns after the operator cancels or finishes working with the invitation.
 */
export async function runDestinationReleaseWizard(input?: {
	slug?: string;
}): Promise<void> {
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
		const productionLabel = readiness.productionReady
			? `${describeDestination('production')} (Preview aprobado; apply: pnpm prod:apply)`
			: `${describeDestination('production')} (requiere Preview aprobado)`;

		const destination = await select({
			message: '¿Qué resultado desea?',
			default: 'cancel',
			choices: [
				{ name: 'Cancelar', value: 'cancel' as const },
				{ name: describeDestination('local'), value: 'local' as const },
				{
					name: describeDestination('prepare_preview'),
					value: 'prepare_preview' as const,
				},
				{ name: productionLabel, value: 'production' as const },
				{ name: 'Actualizar paquete desde definición', value: 'refresh' as const },
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
