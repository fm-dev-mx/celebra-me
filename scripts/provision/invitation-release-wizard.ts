/**
 * Destination-driven interactive menu for pnpm invitation:release.
 * The operator selects outcomes (Update Local → Prepare Preview → approve → Production dry-run);
 * this module owns package binding, ordering, outcomes and next-step suggestions. Every write
 * keeps its own gate: Local confirm (No default), Preview typed YES, approval Cancel default.
 * Production apply is never here: it is pnpm prod:apply.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getProdDbUrl } from '../db/db-workflow-lib.ts';
import { writeHuman } from '../db/operator-cli-ux.ts';
import { isPromptExit, menu, printLine, runInteractive, step, theme } from '../lib/cli-prompts.ts';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { planAndApplyPreviewContent } from './invitation-content-apply.ts';
import {
	buildPreflightBlockedResults,
	deriveLifecycleFinalStatus,
	executeTargetPlans,
} from './invitation-lifecycle-execution.ts';
import { getInvitationDefinition } from './invitations/registry.ts';
import { resolveInvitationPackageInput } from './invitation-package-input.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import {
	describeDestination,
	isStaleProvenanceBlockReason,
	resolveDestinationReadiness,
	type ReleaseDestination,
} from './invitation-release-destination.ts';
import {
	releaseNextStep,
	releaseRootMenu,
	type ReleaseMenuAction,
	type ReleaseMenuState,
} from './invitation-release-menu-model.ts';
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
	type TargetPlanData,
} from './invitation-update-presenter.ts';
import type { ConflictResolutions, UpdateScope } from './semantic-delta.ts';
import type { AssetPolicy } from './asset-reconciliation.ts';
import { defaultAssetPolicy, requireResolvedUpdateScope } from './invitation-update-options.ts';
import { runPromotionPreflight } from './invitation-promote.ts';
import { formatPromotionPlanCompact } from './invitation-promotion-format.ts';
import {
	planLocal,
	planPreview,
	resolvePromotionStateForSlug,
	reviewAndConfirm,
	sumTargetResults,
} from './wizard/wizard-planning.ts';
import {
	chooseSlug,
	describePackage,
	environmentStateLine,
	printSessionHeader,
	rootItems,
	runStatus,
	runTools,
	type SessionDeps,
	type SessionOverrides,
} from './wizard/wizard-session.ts';
import {
	executeLocalStage,
	executePreviewStage,
	printResultSummary,
} from './wizard/wizard-stages.ts';
import {
	maybeRecoverConflicts,
	maybeRecoverUnpublishedDraftDivergence,
} from './wizard/wizard-recovery.ts';

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
	/** Optional operator overrides (same meaning as the CLI flags). */
	sourceDir?: string;
	packageFile?: string;
	allowStalePackage?: boolean;
	rekeyFrom?: string;
	ownerUserId?: string;
	verbose: boolean;
	/** Only what the operator chose; the rest is re-derived from the definition on rebuild. */
	overrides: SessionOverrides;
}

function persistSessionPackage(packageData: InvitationPackageData): string {
	const relative = `.agent/tmp/packages/invitation-${packageData.invitation.slug}-${packageData.packageHash.slice(0, 16)}.json`;
	const absolute = resolve(process.cwd(), relative);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
	return absolute;
}

async function maybeRecoverStaleProvenance(session: ReleaseWizardSession): Promise<boolean> {
	if (!session.packagePath) return false;
	const t = theme();
	let diagnosis;
	try {
		diagnosis = await step('Diagnosing Preview provenance', () =>
			inspectPreviewProvenanceReceipt({ packagePath: session.packagePath! }),
		);
	} catch (error) {
		printLine(
			t.mark(
				'warn',
				`Provenance diagnosis failed: ${error instanceof Error ? error.message : String(error)}`,
			),
		);
		return false;
	}
	if (diagnosis.status !== 'RECOVERABLE' || !diagnosis.recoveryEligible) {
		printLine(
			t.mark('fail', `Provenance is not automatically recoverable: ${diagnosis.message}`),
		);
		return false;
	}

	printLine(
		t.mark(
			'warn',
			'Preview baseline is stale against a verification receipt. Only metadata will be updated (no content, no Storage).',
		),
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
			printLine(t.mark('info', 'Reconcile cancelled.'));
			return false;
		}
		throw error;
	}

	const applied = await reconcileStalePreviewProvenance({
		packagePath: session.packagePath,
		apply: true,
	});
	if (!applied.applied || applied.status !== 'IN_SYNC') {
		printLine(t.mark('fail', 'Reconcile did not leave Preview in sync.'));
		return false;
	}
	printLine(t.mark('ok', 'Preview provenance reconciled.'));
	return true;
}

async function ensurePreviewApprovalForProduction(session: ReleaseWizardSession): Promise<boolean> {
	const t = theme();
	const alreadyReady = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	if (alreadyReady.productionReady) {
		printLine(
			t.mark(
				'ok',
				`Preview is already approved for this package. Production: pnpm prod:apply -- --slug ${session.slug} --apply`,
			),
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

	printLine(
		t.mark(
			'info',
			'Preview already matches the canonical package. Running Preview verify to materialize the approval.',
		),
	);
	const preview = await step('Planning Preview', () => planPreview(session));
	if (preview.targetPlan.status === 'BLOQUEADO') {
		if (isStaleProvenanceBlockReason(preview.targetPlan.reason)) {
			const recovered = await maybeRecoverStaleProvenance(session);
			if (!recovered) return false;
			return ensurePreviewApprovalForProduction(session);
		}
		printLine(
			t.mark('fail', `Preview blocked: ${preview.targetPlan.reason ?? 'unknown reason'}`),
		);
		return false;
	}

	if (!preview.targetDbUrl || !preview.plan) {
		printLine(t.mark('fail', 'No Preview plan available for verification.'));
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
			printLine(t.mark('info', 'Verification cancelled.'));
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
		rekeyFrom: session.rekeyFrom,
		ownerUserId: session.ownerUserId,
	});
	await maybeCompletePreviewApproval(session);
	const readiness = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	return readiness.productionReady;
}

async function runLiveApproval(session: ReleaseWizardSession): Promise<void> {
	const t = theme();
	const pending = getDefaultPreviewApprovalStore().get(session.packageHash);
	if (!pending) {
		printLine(
			t.mark('warn', 'No pending approval for this package hash. Apply Preview again first.'),
		);
		return;
	}
	const live = await step('Verifying Preview live', () => verifyPreviewArtifactLive(pending), {
		done: (result) => (result.ok ? 'Live checklist passed' : 'Live checklist has failures'),
	});
	for (const key of PREVIEW_LIVE_CHECKLIST_KEYS) {
		printLine(`  ${t.mark(live.checklistResults[key] ? 'ok' : 'fail', key)}`);
	}
	if (!live.ok) {
		printLine(t.mark('fail', 'Live verification failed. This release cannot be approved.'));
		return;
	}
	const decision = await menu<'cancel' | 'approve'>({
		title: `Approve the verified Preview release of "${session.slug}" for Production?`,
		items: [
			{ value: 'cancel', label: 'Cancel (do not approve now)' },
			{ value: 'approve', label: 'Approve Preview for Production', danger: true },
		],
		initial: 'cancel',
	});
	if (decision !== 'approve') {
		printLine(t.mark('info', 'Approval skipped. You can approve later.'));
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
	printLine(
		t.mark(
			'ok',
			`Approval recorded · ${finalized.slug} · pkg ${finalized.packageHash.slice(0, 16)}…`,
		),
	);
}

/** Skip live verify/approve when resolveDestinationReadiness already says Production-ready. */
async function maybeCompletePreviewApproval(session: ReleaseWizardSession): Promise<void> {
	const readiness = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	if (readiness.productionReady) {
		printLine(
			theme().mark(
				'ok',
				`Preview already has an exact approval for this package. No re-verify. Production: pnpm prod:apply -- --slug ${session.slug} --apply`,
			),
		);
		return;
	}
	await runLiveApproval(session);
}

async function applyLocalOutcome(session: ReleaseWizardSession): Promise<void> {
	const t = theme();
	for (;;) {
		const { plan, targetPlan } = await step('Planning Local', () => planLocal(session), {
			done: (result) => `Local plan: ${result.targetPlan.status}`,
		});
		const planData = toOperationalPlanData(session.slug, ['local'], [targetPlan], {
			updateScope: session.updateScope,
			assetPolicy: session.assetPolicy,
		});
		if (targetPlan.status === 'BLOQUEADO') {
			const recovered = await maybeRecoverConflicts(session, [targetPlan]);
			if (recovered) continue;
			const discarded = await maybeRecoverUnpublishedDraftDivergence(session, [targetPlan]);
			if (discarded) continue;
			console.log(formatDryRunPlan(planData, { verbose: session.verbose }));
			return;
		}
		if (targetPlan.status === 'SIN CAMBIOS') {
			printLine(t.mark('ok', 'Local is already in sync. Nothing to apply.'));
			return;
		}
		const decision = await reviewAndConfirm(planData, { verbose: session.verbose });
		if (decision === 'cancel' || decision === 'back') return;
		if (!plan) return;

		// Cancelling the No-default confirm throws OPERATOR_CANCELLED (reported by dispatchAction).
		const { result } = await executeLocalStage(session, plan);
		const targetResults = [result];
		if (session.verbose) {
			console.log(
				formatApplyResult({
					invitation: session.slug,
					status: deriveLifecycleFinalStatus(targetResults),
					environment: 'local',
					completedOperations: result.completedOperations,
					databaseWrites: result.databaseWrites,
					storageMutations: result.storageMutations,
					targetResults,
					functionalChanges: result.functionalChanges,
				}),
			);
		}
		printResultSummary({
			session,
			targets: t.env('local'),
			results: targetResults,
			next: describeDestination('prepare_preview'),
		});
		return;
	}
}

async function recoverPreparePreviewBlock(
	session: ReleaseWizardSession,
	targetPlans: TargetPlanData[],
): Promise<boolean> {
	if (await maybeRecoverConflicts(session, targetPlans)) return true;
	if (await maybeRecoverUnpublishedDraftDivergence(session, targetPlans)) return true;
	const previewBlocked = targetPlans.find(
		(tp) => tp.target === 'preview' && tp.status === 'BLOQUEADO',
	);
	if (isStaleProvenanceBlockReason(previewBlocked?.reason)) {
		return maybeRecoverStaleProvenance(session);
	}
	return false;
}

async function applyPreparePreviewOutcome(session: ReleaseWizardSession): Promise<void> {
	const t = theme();
	for (;;) {
		const local = await step('Planning Local', () => planLocal(session), {
			done: (result) => `Local plan: ${result.targetPlan.status}`,
		});
		const preview = await step('Planning Preview', () => planPreview(session), {
			done: (result) => `Preview plan: ${result.targetPlan.status}`,
		});
		const targetPlans = [local.targetPlan, preview.targetPlan];
		const planData = toOperationalPlanData(session.slug, ['local', 'preview'], targetPlans, {
			updateScope: session.updateScope,
			assetPolicy: session.assetPolicy,
		});

		if (targetPlans.some((tp) => tp.status === 'BLOQUEADO')) {
			if (await recoverPreparePreviewBlock(session, targetPlans)) continue;
			console.log(formatDryRunPlan(planData, { verbose: session.verbose }));
			if (buildPreflightBlockedResults(['local', 'preview'], targetPlans)) {
				const reason = targetPlans.find((tp) => tp.status === 'BLOQUEADO')?.reason;
				printLine(t.mark('fail', `Blocked: ${reason ?? 'preflight incomplete'}`));
			}
			return;
		}

		const decision = await reviewAndConfirm(planData, {
			hosted: true,
			verbose: session.verbose,
		});
		if (decision === 'cancel' || decision === 'back') return;

		const summary = await executeTargetPlans({
			targets: ['local', 'preview'],
			targetPlans,
			sanitizeError: (error) => (error instanceof Error ? error.message : String(error)),
			executeTarget: (target) =>
				target === 'local'
					? executeLocalStage(session, local.plan)
					: executePreviewStage(session, preview),
		});

		if (
			summary.targetResults.some((result) =>
				(result.reason ?? '').includes('OPERATOR_CANCELLED'),
			)
		) {
			printLine(t.mark('info', 'Cancelled. No further writes.'));
			return;
		}
		if (session.verbose || summary.executionFailed) {
			const totals = sumTargetResults(summary.targetResults);
			console.log(
				formatApplyResult({
					invitation: session.slug,
					status: deriveLifecycleFinalStatus(summary.targetResults),
					environment: 'local, preview',
					completedOperations: totals.completedOperations,
					databaseWrites: totals.databaseWrites,
					storageMutations: totals.storageMutations,
					targetResults: summary.targetResults,
				}),
			);
		}

		const previewApplied = summary.targetResults.some(
			(r) =>
				r.target === 'preview' &&
				(r.status === 'CAMBIOS APLICADOS' || r.status === 'SIN CAMBIOS'),
		);
		printResultSummary({
			session,
			targets: `${t.env('local')} + ${t.env('preview')}`,
			results: summary.targetResults,
			next: previewApplied ? 'Approve Preview (live checklist)' : 'Review the failure above',
		});
		if (!summary.executionFailed && previewApplied) {
			await maybeCompletePreviewApproval(session);
		}
		return;
	}
}

/** Returns true when Production is ready after guiding the operator through Preview. */
async function ensureProductionReadiness(session: ReleaseWizardSession): Promise<boolean> {
	const t = theme();
	const readiness = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	if (readiness.productionReady) return true;
	printLine(
		t.mark(
			'warn',
			`Production is not ready: ${readiness.productionBlockReason ?? 'exact Preview approval missing.'}`,
		),
	);
	const promotionAction = (await resolvePromotionStateForSlug(session.slug)).action;
	if (promotionAction !== 'PROMOTE_PRODUCTION') {
		const next = await menu<'back' | 'prepare'>({
			title: 'Preview must be prepared and approved first',
			items: [
				{ value: 'prepare', label: `${describeDestination('prepare_preview')} now` },
				{ value: 'back', label: 'Back' },
			],
			initial: 'back',
		});
		if (next === 'prepare') await applyPreparePreviewOutcome(session);
		return false;
	}
	const next = await menu<'back' | 'approve' | 'prepare'>({
		title: 'Preview already matches the canonical package',
		items: [
			{ value: 'approve', label: 'Approve Preview now (no content re-apply)' },
			{ value: 'prepare', label: describeDestination('prepare_preview') },
			{ value: 'back', label: 'Back' },
		],
		initial: 'approve',
	});
	if (next === 'back') return false;
	if (next === 'prepare') {
		await applyPreparePreviewOutcome(session);
		return false;
	}
	if (!(await ensurePreviewApprovalForProduction(session))) return false;
	const after = await resolveDestinationReadiness({
		slug: session.slug,
		packagePath: session.packagePath,
	});
	if (!after.productionReady) {
		printLine(t.mark('fail', 'Exact Preview approval is still missing after verification.'));
	}
	return after.productionReady;
}

async function applyProductionOutcome(session: ReleaseWizardSession): Promise<void> {
	const t = theme();
	if (!(await ensureProductionReadiness(session))) return;

	const definition = getInvitationDefinition(session.slug);
	// Match CLI dry-run: defer critical backup to the orchestrator recovery classifier.
	const preflight = await step(
		'Production preflight (read-only)',
		() =>
			runPromotionPreflight({
				packageData: session.packageData,
				updateScope: session.updateScope,
				assetPolicy: session.assetPolicy,
				requireBackup: false,
				getProductionDbUrl: getProdDbUrl,
			}),
		{ done: (report) => `Production preflight: ${report.status}` },
	);
	if (preflight.status === 'BLOCKED') {
		printLine(
			t.mark(
				'fail',
				`${t.env('production')} blocked: ${preflight.reason ?? preflight.blockCode}`,
			),
		);
		return;
	}
	if (preflight.status === 'IN_SYNC') {
		printLine(t.mark('ok', `${t.env('production')} already matches the approved release.`));
		return;
	}
	writeHuman(formatPromotionPlanCompact(preflight, { title: definition.title }));
	printLine();
	printLine(
		t.summary('Summary', [
			['Invitation', session.slug],
			['Target', t.env('production')],
			['Preflight', preflight.status],
			['Writes', 'none here (dry-run only)'],
			['Next', `Owner apply: pnpm prod:apply -- --slug ${session.slug} --apply`],
		]),
	);
}

async function buildSession(
	slug: string,
	overrides: SessionOverrides = {},
): Promise<ReleaseWizardSession> {
	const packageInput = await resolveInvitationPackageInput({
		slug,
		sourceDir: overrides.sourceDir,
		packagePath: overrides.packageFile,
		allowStalePackage: overrides.allowStalePackage,
	});
	const packagePath = persistSessionPackage(packageInput.packageData);
	const definition = getInvitationDefinition(slug);
	const updateScope = requireResolvedUpdateScope({
		updateScope: overrides.updateScope,
		deliveryScope: definition.deliveryScope,
	});
	const assetPolicy = overrides.assetPolicy ?? defaultAssetPolicy(updateScope);
	if (assetPolicy === 'preserve' && updateScope === 'content-and-assets') {
		throw new Error(
			'Asset policy "preserve" conflicts with update scope "content-and-assets". Choose verify, missing, or sync.',
		);
	}
	return {
		slug,
		packageData: packageInput.packageData,
		packagePath,
		sourceHash: packageInput.packageData.sourceHash,
		packageHash: packageInput.packageData.packageHash,
		updateScope,
		assetPolicy,
		pruneAssets: overrides.pruneAssets ?? updateScope === 'content-and-assets',
		sourceDir: overrides.sourceDir,
		packageFile: overrides.packageFile,
		allowStalePackage: overrides.allowStalePackage,
		rekeyFrom: overrides.rekeyFrom,
		ownerUserId: overrides.ownerUserId,
		verbose: overrides.verbose ?? false,
		overrides: { ...overrides },
	};
}

const sessionDeps: SessionDeps = {
	buildSession,
	reconcileStaleProvenance: maybeRecoverStaleProvenance,
};

/** Run one menu action; returns the (possibly rebuilt) session. Errors are reported inline. */
async function dispatchAction(
	action: ReleaseMenuAction,
	session: ReleaseWizardSession,
): Promise<ReleaseWizardSession> {
	const t = theme();
	try {
		switch (action) {
			case 'local':
				await applyLocalOutcome(session);
				break;
			case 'prepare_preview':
				await applyPreparePreviewOutcome(session);
				break;
			case 'approve_preview':
				await runLiveApproval(session);
				break;
			case 'production':
				await applyProductionOutcome(session);
				break;
			case 'status':
				await runStatus(session);
				break;
			case 'tools':
				return await runTools(session, sessionDeps);
			default:
				break;
		}
	} catch (error) {
		if (isPromptExit(error)) throw error;
		if (error instanceof Error && error.message === 'OPERATOR_CANCELLED') {
			printLine(t.mark('info', 'Cancelled. No writes.'));
		} else {
			printLine(t.mark('fail', error instanceof Error ? error.message : String(error)));
			if (session.verbose && error instanceof Error && error.stack)
				printLine(t.dim(error.stack));
		}
	}
	return session;
}

async function readMenuState(
	session: ReleaseWizardSession,
	previous: ReleaseMenuState,
	options: { announce: boolean },
): Promise<ReleaseMenuState> {
	const [readiness, promotion] = await step(
		'Reading publication state',
		() =>
			Promise.all([
				resolveDestinationReadiness({
					slug: session.slug,
					packagePath: session.packagePath,
				}),
				resolvePromotionStateForSlug(session.slug),
			]),
		{ done: ([, promo]) => `Publication state: ${promo.action}` },
	);
	const state: ReleaseMenuState = {
		...previous,
		promotionAction: promotion.action,
		productionReady: readiness.productionReady,
		hasPendingPreviewApproval: readiness.hasPendingPreviewApproval,
	};
	if (options.announce) {
		printSessionHeader(session, state);
		printLine(environmentStateLine(promotion.environments));
		printLine();
	}
	return state;
}

/**
 * Interactive destination-driven release session.
 * Returns after the operator exits or finishes working with the invitation.
 */
export async function runDestinationReleaseWizard(input?: {
	slug?: string;
	verbose?: boolean;
}): Promise<void> {
	await runInteractive(async () => {
		const t = theme();
		printLine(t.header('invitation:release', [t.dim('managed invitation release')]));

		const firstSlug = input?.slug ?? (await chooseSlug());
		if (!firstSlug) return;
		let session = await step(
			'Building package',
			() => buildSession(firstSlug, { verbose: input?.verbose }),
			{ done: describePackage },
		);

		let action: ReleaseMenuAction = 'menu';
		let state: ReleaseMenuState = {
			promotionAction: 'UNKNOWN',
			productionReady: false,
			hasPendingPreviewApproval: false,
			lastAction: null,
		};

		for (;;) {
			if (action === 'menu') {
				state = await readMenuState(session, state, { announce: true });
				const root = releaseRootMenu(state);
				action = await menu({
					title: 'What do you want to do?',
					items: rootItems(root.order, state),
					initial: root.initial,
				});
			}
			if (action === 'exit') {
				printLine(t.mark('info', 'Session finished. No further writes.'));
				return;
			}
			if (action === 'change') {
				const nextSlug = await chooseSlug();
				if (!nextSlug) return;
				try {
					// Overrides are bound to the previous invitation (rekey, package file, scope).
					session = await step(
						'Building package',
						() => buildSession(nextSlug, { verbose: session.verbose }),
						{ done: describePackage },
					);
				} catch (error) {
					if (isPromptExit(error)) throw error;
					printLine(
						t.mark('fail', error instanceof Error ? error.message : String(error)),
					);
				}
				action = 'menu';
				continue;
			}

			session = await dispatchAction(action, session);
			state = { ...state, lastAction: action };
			if (
				action === 'local' ||
				action === 'prepare_preview' ||
				action === 'approve_preview'
			) {
				// Re-read readiness so the next-step default reflects what just happened.
				state = await readMenuState(session, state, { announce: false });
			}
			const next = releaseNextStep(state);
			printLine();
			action = await menu({
				title: 'Next step',
				items: rootItems(next.order, state),
				initial: next.initial,
			});
		}
	});
}

export type { ReleaseDestination };
