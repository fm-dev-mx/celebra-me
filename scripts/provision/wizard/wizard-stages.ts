/**
 * Per-target execution stages for the invitation:release menu (Local confirm, Preview typed
 * YES). Called from executeTargetPlans; each stage keeps the gate that protects its target.
 */
import { confirmAction, printLine, theme } from '../../lib/cli-prompts.ts';
import {
	planAndApplyLocalContent,
	planAndApplyPreviewContent,
} from '../invitation-content-apply.ts';
import {
	deriveLifecycleFinalStatus,
	type LifecycleExecutionError,
	type TargetExecutionOutcome,
} from '../invitation-lifecycle-execution.ts';
import type { ReleaseWizardSession } from '../invitation-release-wizard.ts';
import type { TargetApplyResultData } from '../invitation-update-presenter.ts';
import type { OperationalPlan } from '../invitation-update-plan.ts';
import { authorizePreviewWriteApply } from '../preview-write-auth.ts';
import { sumTargetResults } from './wizard-planning.ts';

function operatorCancelled(): never {
	throw Object.assign(new Error('OPERATOR_CANCELLED'), {
		mutationStarted: false,
		cancelled: true,
	}) as LifecycleExecutionError;
}

function notStarted(message: string): LifecycleExecutionError {
	return Object.assign(new Error(message), { mutationStarted: false }) as LifecycleExecutionError;
}

/** Local write after a No-default confirmation; bound to the session package hashes. */
export async function executeLocalStage(
	session: ReleaseWizardSession,
	localPlan: OperationalPlan | undefined,
): Promise<TargetExecutionOutcome> {
	const confirmed = await confirmAction({
		question: `Apply "${session.slug}" to ${theme().env('local')}?`,
		initial: false,
	});
	if (!confirmed) operatorCancelled();
	if (!localPlan) throw notStarted('No Local plan available.');
	const executed = await planAndApplyLocalContent({
		slug: session.slug,
		apply: true,
		plan: localPlan,
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

/** Preview write after the typed-YES Preview authorization (unchanged domain gate). */
export async function executePreviewStage(
	session: ReleaseWizardSession,
	preview: { plan?: OperationalPlan; targetDbUrl?: string },
): Promise<TargetExecutionOutcome> {
	const t = theme();
	if (!preview.targetDbUrl) throw notStarted('Preview DB URL unavailable.');
	printLine(t.mark('warn', `${t.env('preview')} write ahead. Type YES to proceed.`));
	try {
		await authorizePreviewWriteApply({
			slug: session.slug,
			operation: 'apply',
			confirmPrompt: `Confirm Preview apply for "${session.slug}"? Type YES to proceed: `,
			isInteractive: true,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes('PREVIEW_WRITE_CANCELLED')) operatorCancelled();
		throw error;
	}
	if (!preview.plan) throw notStarted('No Preview plan available.');
	const executed = await planAndApplyPreviewContent({
		packageData: session.packageData,
		targetDbUrl: preview.targetDbUrl,
		apply: true,
		plan: preview.plan,
		updateScope: session.updateScope,
		assetPolicy: session.assetPolicy,
		pruneAssets: session.pruneAssets,
		conflictResolutions: session.conflictResolutions,
		acknowledgeDiscardUnpublishedDraft: session.acknowledgeDiscardUnpublishedDraft,
		rekeyFrom: session.rekeyFrom,
		ownerUserId: session.ownerUserId,
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
}

/** Compact aligned result block printed after a Local or Preview apply. */
export function printResultSummary(input: {
	session: ReleaseWizardSession;
	targets: string;
	results: TargetApplyResultData[];
	next: string;
}): void {
	const t = theme();
	const totals = sumTargetResults(input.results);
	const versions = input.results
		.filter((result) => result.publishedVersion !== undefined)
		.map((result) => `${result.target} v${result.publishedVersion}`)
		.join(', ');
	const dbWrites =
		totals.databaseWrites.inserts +
		totals.databaseWrites.updates +
		totals.databaseWrites.deletes;
	const storageWrites =
		totals.storageMutations.uploads +
		totals.storageMutations.overwrites +
		totals.storageMutations.moves +
		totals.storageMutations.deletes;
	printLine();
	printLine(
		t.summary('Summary', [
			['Invitation', input.session.slug],
			['Target', input.targets],
			['Status', deriveLifecycleFinalStatus(input.results)],
			['Writes', `DB ${dbWrites} · Storage ${storageWrites}`],
			...(versions ? [['Version', versions] as const] : []),
			['Next', input.next],
		]),
	);
}
