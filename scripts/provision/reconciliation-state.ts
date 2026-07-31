/**
 * reconciliation-state.ts — Managed Content Reconciliation State Model
 *
 * Defines the state machine and semantic delta comparison for managed invitation divergence.
 *
 * States:
 *  - CLEAN: Canonical package and target environment match semantically.
 *  - DIVERGED: Target environment has un-reconciled managed modifications.
 *  - RECONCILIATION_REQUIRED: Managed differences exist and require operator decision.
 *  - SOURCE_UPDATE_REQUIRED: Operator selected KEEP_ENVIRONMENT; canonical TS source must be updated.
 *  - DEFERRED: Operator deferred one or more reconciliation decisions.
 *
 * Excluded from Divergence (Environment-Local / Target-Owned):
 *  - target-owned metadata
 *  - publication-owned state not governed by canonical content
 *  - RSVP / guest data
 *  - Auth identities
 *  - environment UUIDs
 *  - timestamps
 *  - Storage hosts / CDN URLs
 *  - operational receipts
 */

import { isManagedInvitationPath } from '../../src/lib/intake/mutations/ownership.ts';
import type { SemanticDelta } from './semantic-delta.ts';

export type ReconciliationState =
	| 'CLEAN'
	| 'DIVERGED'
	| 'RECONCILIATION_REQUIRED'
	| 'SOURCE_UPDATE_REQUIRED'
	| 'DEFERRED';

export type ReconciliationDecisionOutcome = 'KEEP_CANONICAL' | 'KEEP_ENVIRONMENT' | 'DEFER';

export interface ManagedFieldDiff {
	path: string;
	section: string;
	canonicalValue: unknown;
	environmentValue: unknown;
	previousCanonicalValue?: unknown;
	isDestructive?: boolean;
}

export interface SourceUpdateItem {
	semanticPath: string;
	canonicalFile: string;
	currentCanonicalValue: unknown;
	selectedEnvironmentValue: unknown;
	section: string;
}

export interface SourceUpdatePlan {
	slug: string;
	canonicalFile: string;
	items: SourceUpdateItem[];
	createdAt: string;
}

export interface ManagedDivergenceSummary {
	state: ReconciliationState;
	slug: string;
	targetEnvironment: 'local' | 'preview' | 'production';
	totalManagedDiffs: number;
	affectedSectionCount: number;
	affectedSections: string[];
	diffs: ManagedFieldDiff[];
	decisions: Record<string, ReconciliationDecisionOutcome>;
	unresolvedPaths: string[];
	sourceUpdatePlan?: SourceUpdatePlan;
	isReleaseBlocked: boolean;
	blockerReason?: string;
}

/** Filter non-managed fields using the invitation ownership source of truth. */
export function filterManagedDivergenceDeltas(
	deltas: Array<Partial<SemanticDelta> & { path: string }>,
): ManagedFieldDiff[] {
	return deltas
		.filter((delta) => isManagedInvitationPath(delta.path))
		.map((delta) => {
			const parts = delta.path.split('.');
			const section = parts.length > 1 ? parts[0]! : 'general';
			return {
				path: delta.path,
				section,
				canonicalValue: delta.currentCanonicalValue,
				environmentValue: delta.currentTargetValue,
				previousCanonicalValue: delta.previousCanonicalValue,
				isDestructive: delta.currentTargetValue === undefined || delta.currentTargetValue === null,
			};
		});
}

/**
 * Computes the overall reconciliation state and release blocker status based on decisions and diffs.
 */
export function computeReconciliationState(input: {
	slug: string;
	targetEnvironment: 'local' | 'preview' | 'production';
	diffs: ManagedFieldDiff[];
	decisions?: Record<string, ReconciliationDecisionOutcome>;
}): ManagedDivergenceSummary {
	const { slug, targetEnvironment, diffs, decisions = {} } = input;

	if (diffs.length === 0) {
		return {
			state: 'CLEAN',
			slug,
			targetEnvironment,
			totalManagedDiffs: 0,
			affectedSectionCount: 0,
			affectedSections: [],
			diffs: [],
			decisions: {},
			unresolvedPaths: [],
			isReleaseBlocked: false,
		};
	}

	const sections = Array.from(new Set(diffs.map((d) => d.section)));
	const unresolvedPaths: string[] = [];
	const sourceUpdateItems: SourceUpdateItem[] = [];
	let hasDeferred = false;
	let hasKeepEnv = false;

	const canonicalFile = `scripts/provision/invitations/${slug}.ts`;

	for (const diff of diffs) {
		const decision = decisions[diff.path];
		if (!decision) {
			unresolvedPaths.push(diff.path);
		} else if (decision === 'DEFER') {
			unresolvedPaths.push(diff.path);
			hasDeferred = true;
		} else if (decision === 'KEEP_ENVIRONMENT') {
			sourceUpdateItems.push({
				semanticPath: diff.path,
				canonicalFile,
				currentCanonicalValue: diff.canonicalValue,
				selectedEnvironmentValue: diff.environmentValue,
				section: diff.section,
			});
			hasKeepEnv = true;
		}
	}

	let state: ReconciliationState;
	let blockerReason: string | undefined;

	if (unresolvedPaths.length > 0) {
		state = hasDeferred ? 'DEFERRED' : 'RECONCILIATION_REQUIRED';
		blockerReason = `Reconciliation required: ${unresolvedPaths.length} managed field(s) across ${sections.length} section(s) have unresolved divergence.`;
	} else if (hasKeepEnv) {
		state = 'SOURCE_UPDATE_REQUIRED';
		blockerReason = `Source update required: ${sourceUpdateItems.length} environment decision(s) require updating canonical TypeScript file "${canonicalFile}" before release.`;
	} else {
		// All decisions are KEEP_CANONICAL
		state = 'CLEAN';
	}

	const isReleaseBlocked = state !== 'CLEAN';

	const sourceUpdatePlan: SourceUpdatePlan | undefined =
		sourceUpdateItems.length > 0
			? {
					slug,
					canonicalFile,
					items: sourceUpdateItems,
					createdAt: new Date().toISOString(),
				}
			: undefined;

	return {
		state,
		slug,
		targetEnvironment,
		totalManagedDiffs: diffs.length,
		affectedSectionCount: sections.length,
		affectedSections: sections,
		diffs,
		decisions,
		unresolvedPaths,
		sourceUpdatePlan,
		isReleaseBlocked,
		blockerReason,
	};
}
