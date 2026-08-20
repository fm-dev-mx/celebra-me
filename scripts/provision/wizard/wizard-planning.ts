import { select } from '@inquirer/prompts';
import { LOCAL_DB_URL } from '../../db/db-target-config.ts';
import { assertPreviewDbUrl, getPreviewDbUrl } from '../../db/db-workflow-lib.ts';
import { operatorSymbol, writeHuman } from '../../db/operator-cli-ux.ts';
import type { PromotionAction } from '../../../src/lib/status/types.ts';
import { getInvitationDefinition } from '../invitations/registry.ts';
import { evaluateManagedPromotionStatus } from '../managed-promotion-status.ts';
import {
	assertContentSchemaCurrent,
	planAndApplyLocalContent,
	planAndApplyPreviewContent,
} from '../invitation-content-apply.ts';
import type {
	OperationalPlanData,
	TargetApplyResultData,
	TargetPlanData,
} from '../invitation-update-presenter.ts';
import {
	formatApplyConfirmation,
	formatDryRunPlan,
} from '../invitation-update-presenter.ts';
import type { OperationalPlan } from '../invitation-update-plan.ts';
import { mergePathPolicies, suggestConflictResolutionsFile } from '../conflict-resolutions.ts';
import {
	MergeConflictError,
	listDriftConflicts,
	type ConflictResolutions,
} from '../semantic-delta.ts';
import type { ReleaseWizardSession } from '../invitation-release-wizard.ts';

export function mergeConflictsFromError(error: unknown): TargetPlanData['mergeConflicts'] {
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

export async function promptConflictResolutions(
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

export async function planLocal(
	session: ReleaseWizardSession,
): Promise<{ plan?: OperationalPlan; targetPlan: TargetPlanData }> {
	assertContentSchemaCurrent({ target: 'local', dbUrl: LOCAL_DB_URL });
	try {
		const result = await planAndApplyLocalContent({
			slug: session.slug,
			apply: false,
			updateScope: session.updateScope,
			assetPolicy: session.assetPolicy,
			pruneAssets: session.pruneAssets,
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

export async function planPreview(
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
			pruneAssets: session.pruneAssets,
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

export async function reviewAndConfirm(
	planData: OperationalPlanData,
): Promise<'apply' | 'back' | 'cancel'> {
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

export async function resolvePromotionActionForSlug(slug: string): Promise<PromotionAction> {
	try {
		const definition = getInvitationDefinition(slug);
		const status = await evaluateManagedPromotionStatus({
			definitions: [definition],
			slugs: [slug],
			includeProductionPreflight: false,
		});
		const row = status.promotions.find((candidate) => candidate.slug === slug);
		if (row) return row.action;
		if (status.inSyncSlugs.includes(slug)) return 'NONE';
	} catch (error) {
		writeHuman(
			`${operatorSymbol('warn')} No se pudo leer el estado de publicación (${error instanceof Error ? error.message : String(error)}). Se usa el menú sin recomendación.`,
		);
	}
	return 'UNKNOWN';
}

export function sumTargetResults(targetResults: TargetApplyResultData[]): {
	completedOperations: number;
	databaseWrites: { inserts: number; updates: number; deletes: number };
	storageMutations: { uploads: number; overwrites: number; moves: number; deletes: number };
} {
	return {
		completedOperations: targetResults.reduce((s, r) => s + r.completedOperations, 0),
		databaseWrites: {
			inserts: targetResults.reduce((s, r) => s + r.databaseWrites.inserts, 0),
			updates: targetResults.reduce((s, r) => s + r.databaseWrites.updates, 0),
			deletes: targetResults.reduce((s, r) => s + r.databaseWrites.deletes, 0),
		},
		storageMutations: {
			uploads: targetResults.reduce((s, r) => s + r.storageMutations.uploads, 0),
			overwrites: targetResults.reduce((s, r) => s + r.storageMutations.overwrites, 0),
			moves: targetResults.reduce((s, r) => s + (r.storageMutations.moves ?? 0), 0),
			deletes: targetResults.reduce((s, r) => s + r.storageMutations.deletes, 0),
		},
	};
}
