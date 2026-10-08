/**
 * Recovery prompts for blocked invitation:release plans: merge conflicts (field by field) and
 * unpublished target drafts (explicit discard acknowledgement, No by default).
 */
import { confirmAction, menu, printLine, theme } from '../../lib/cli-prompts.ts';
import type { ReleaseWizardSession } from '../invitation-release-wizard.ts';
import type { TargetPlanData } from '../invitation-update-presenter.ts';
import { isTargetDivergenceConflictMessage } from '../promotion-comparison.ts';
import { promptConflictResolutions } from './wizard-planning.ts';

export async function maybeRecoverConflicts(
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

	const action = await menu<'cancel' | 'resolve' | 'back'>({
		title: 'The plan is blocked by merge conflicts',
		items: [
			{ value: 'cancel', label: 'Cancel' },
			{ value: 'resolve', label: 'Resolve conflicts field by field' },
			{ value: 'back', label: 'Back' },
		],
		initial: 'cancel',
	});
	if (action !== 'resolve') return false;
	session.conflictResolutions = await promptConflictResolutions(conflicts);
	return true;
}

export async function maybeRecoverUnpublishedDraftDivergence(
	session: ReleaseWizardSession,
	targetPlans: TargetPlanData[],
): Promise<boolean> {
	if (session.acknowledgeDiscardUnpublishedDraft) return false;
	const blocked = targetPlans.filter((tp) => tp.status === 'BLOQUEADO');
	if (blocked.length === 0) return false;
	const allDivergence = blocked.every((tp) => isTargetDivergenceConflictMessage(tp.reason ?? ''));
	if (!allDivergence) return false;

	const t = theme();
	printLine(
		t.mark(
			'warn',
			'The target has an unpublished draft that differs from both the package and the published content.',
		),
	);
	const confirmed = await confirmAction({
		question: `${t.red('Discard those draft edits')} and apply the package?`,
		initial: false,
	});
	if (!confirmed) return false;
	session.acknowledgeDiscardUnpublishedDraft = true;
	return true;
}
