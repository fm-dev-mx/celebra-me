/**
 * Shared status / finding contract for branch-lane orchestration and database-parity.
 * Keep skills, CLI JSON, reports, and tests aligned to these values.
 */

export const BRANCH_LANE_STATUSES = [
	'Pass',
	'Needs decision',
	'Needs authorization',
	'Needs manual action',
	'Fail',
	'Hard blocked',
	'Skipped',
] as const;

export type BranchLaneStatus = (typeof BRANCH_LANE_STATUSES)[number];

export const AUDIT_CONTRACT_VERSION = '1.0.0';

export type FindingSeverity = 'info' | 'warning' | 'error' | 'hard_block';

export interface Finding {
	id: string;
	status: BranchLaneStatus;
	severity: FindingSeverity;
	cause: string;
	impact: string;
	owner: 'agent' | 'human' | 'system';
	remediation: string;
	nextStep: string;
	paths?: string[];
}

export function createFinding(
	partial: Omit<Finding, 'severity'> & { severity?: FindingSeverity },
): Finding {
	const { severity, ...rest } = partial;
	return {
		...rest,
		severity: severity ?? severityForStatus(partial.status),
	};
}

export function severityForStatus(status: BranchLaneStatus): FindingSeverity {
	switch (status) {
		case 'Hard blocked':
			return 'hard_block';
		case 'Fail':
			return 'error';
		case 'Needs decision':
		case 'Needs authorization':
		case 'Needs manual action':
			return 'warning';
		case 'Skipped':
		case 'Pass':
		default:
			return 'info';
	}
}

export type BranchLaneMode =
	| 'promote-develop-to-main'
	| 'sync-main-into-develop'
	| 'release-prepare'
	| 'no-op'
	| 'ambiguous';

export interface ModeSelectionInput {
	/** Explicit user intent phrases already classified by the agent, if any. */
	requestedMode?: Exclude<BranchLaneMode, 'no-op' | 'ambiguous'> | null;
	mainIsAncestorOfDevelop: boolean;
	developAheadOfMain: boolean;
	mainHasExclusiveCommits: boolean;
	tipsEqual: boolean;
}

export interface ModeSelectionResult {
	mode: BranchLaneMode;
	status: BranchLaneStatus;
	reason: string;
	finding?: Finding;
}

/**
 * Select branch-lane mode from repository geometry + optional explicit request.
 * Does not ask the user when the state is unambiguous.
 */
export function selectBranchLaneMode(input: ModeSelectionInput): ModeSelectionResult {
	if (input.requestedMode === 'release-prepare') {
		return {
			mode: 'release-prepare',
			status: 'Pass',
			reason: 'User requested release preparation.',
		};
	}
	if (input.requestedMode === 'promote-develop-to-main') {
		if (!input.mainIsAncestorOfDevelop) {
			return {
				mode: 'ambiguous',
				status: 'Needs decision',
				reason: 'Promote requested but origin/main is not an ancestor of origin/develop.',
				finding: createFinding({
					id: 'mode-promote-ff-impossible',
					status: 'Needs decision',
					cause: 'Fast-forward promote is impossible; main has commits not in develop.',
					impact: 'Cannot promote without first restoring main ⊂ develop.',
					owner: 'human',
					remediation: 'Run sync-main-into-develop (merge-only), then promote.',
					nextStep: 'Choose: run recovery sync, or abort promote.',
				}),
			};
		}
		return {
			mode: 'promote-develop-to-main',
			status: 'Pass',
			reason: 'User requested promote and FF is possible.',
		};
	}
	if (input.requestedMode === 'sync-main-into-develop') {
		if (!input.mainHasExclusiveCommits) {
			return {
				mode: 'no-op',
				status: 'Pass',
				reason: 'Sync requested but main has no exclusive commits.',
			};
		}
		return {
			mode: 'sync-main-into-develop',
			status: 'Pass',
			reason: 'User requested recovery sync and main has exclusive commits.',
		};
	}

	// Bare / automatic selection
	if (input.tipsEqual) {
		return {
			mode: 'no-op',
			status: 'Pass',
			reason: 'origin/main and origin/develop tips are equal.',
		};
	}
	if (input.mainHasExclusiveCommits && input.developAheadOfMain) {
		return {
			mode: 'ambiguous',
			status: 'Needs decision',
			reason: 'Branches diverged: main and develop each have exclusive commits.',
			finding: createFinding({
				id: 'mode-diverged',
				status: 'Needs decision',
				cause: 'origin/main and origin/develop have diverged.',
				impact: 'Automatic mode selection is unsafe.',
				owner: 'human',
				remediation: 'Choose recovery sync first, or abort until history is clarified.',
				nextStep: 'Decide: sync-main-into-develop, or stop.',
			}),
		};
	}
	if (input.mainHasExclusiveCommits) {
		return {
			mode: 'sync-main-into-develop',
			status: 'Pass',
			reason: 'main has exclusive commits; recovery sync is required before FF promote.',
		};
	}
	if (input.mainIsAncestorOfDevelop && input.developAheadOfMain) {
		return {
			mode: 'promote-develop-to-main',
			status: 'Pass',
			reason: 'develop is ahead and FF is possible; default promote.',
		};
	}

	return {
		mode: 'ambiguous',
		status: 'Needs decision',
		reason: 'Branch relationship is ambiguous after preflight.',
		finding: createFinding({
			id: 'mode-ambiguous',
			status: 'Needs decision',
			cause: 'Could not infer a single branch-lane mode from repository geometry.',
			impact: 'No Git write should proceed without an explicit mode.',
			owner: 'human',
			remediation: 'Specify promote, sync, or release-prepare.',
			nextStep: 'Choose an explicit mode.',
		}),
	};
}
