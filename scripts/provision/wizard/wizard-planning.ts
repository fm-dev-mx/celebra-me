import { LOCAL_DB_URL } from '../../db/db-target-config.ts';
import { assertPreviewDbUrl, getPreviewDbUrl } from '../../db/db-workflow-lib.ts';
import { menu, printLine, theme } from '../../lib/cli-prompts.ts';
import type { PromotionAction, TargetEnv } from '../../../src/lib/status/types.ts';
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
import { formatApplyConfirmation, formatDryRunPlan } from '../invitation-update-presenter.ts';
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
	const t = theme();
	printLine(
		t.mark(
			'warn',
			`${conflicts.length} conflict(s). Choose per field: package (canonical) vs target.`,
		),
	);
	for (const conflict of conflicts) {
		const choice = await menu<'package' | 'target' | 'cancel'>({
			title: `Conflict at ${conflict.path}`,
			items: [
				{
					value: 'package',
					label: `Use package (canonical): ${JSON.stringify(conflict.packageValue)}`,
				},
				{ value: 'target', label: `Keep target: ${JSON.stringify(conflict.targetValue)}` },
				{ value: 'cancel', label: 'Cancel' },
			],
			initial: 'package',
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
			rekeyFrom: session.rekeyFrom,
			sourceDir: session.sourceDir,
			ownerUserId: session.ownerUserId,
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
				reason: 'Preview credentials are not configured or the perimeter is invalid.',
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
			rekeyFrom: session.rekeyFrom,
			ownerUserId: session.ownerUserId,
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

/**
 * Show the plan and ask what to do. Cancel is always the default; the apply item is red when
 * the plan touches a hosted environment. "Review full diff" prints field-level changes.
 */
export async function reviewAndConfirm(
	planData: OperationalPlanData,
	options: { hosted?: boolean; verbose?: boolean } = {},
): Promise<'apply' | 'back' | 'cancel'> {
	console.log(formatDryRunPlan(planData, { verbose: options.verbose ?? false }));
	const targets = planData.targets.join(' + ');
	for (;;) {
		const decision = await menu<'apply' | 'back' | 'cancel' | 'review'>({
			title: `Apply the reviewed plan to ${targets}?`,
			items: [
				{ value: 'cancel', label: 'Cancel' },
				{ value: 'review', label: 'Review full diff' },
				{ value: 'back', label: 'Back' },
				{ value: 'apply', label: `Apply to ${targets}`, danger: options.hosted },
			],
			initial: 'cancel',
		});
		if (decision === 'review') {
			console.log(formatApplyConfirmation(planData, { verbose: true }));
			continue;
		}
		return decision;
	}
}

export interface PromotionStateForSlug {
	action: PromotionAction;
	environments?: Record<TargetEnv, string>;
}

/** Publication state for one slug from the same SSOT as pnpm dbs (read-only). */
export async function resolvePromotionStateForSlug(slug: string): Promise<PromotionStateForSlug> {
	try {
		const definition = getInvitationDefinition(slug);
		const status = await evaluateManagedPromotionStatus({
			definitions: [definition],
			slugs: [slug],
			includeProductionPreflight: false,
		});
		const row = status.promotions.find((candidate) => candidate.slug === slug);
		if (row) return { action: row.action, environments: row.environments };
		if (status.inSyncSlugs.includes(slug))
			return {
				action: 'NONE',
				environments: { local: 'match', preview: 'match', production: 'match' },
			};
	} catch (error) {
		printLine(
			theme().mark(
				'warn',
				`Publication state unavailable (${error instanceof Error ? error.message : String(error)}). Menu shown without a recommendation.`,
			),
		);
	}
	return { action: 'UNKNOWN' };
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
