// =============================================================================
// CELEBRA-ME | Screenshot Tool — Execution Budget Policy
// =============================================================================

import type { ResolvedScreenshotPlan } from './scope.js';
import { KNOWN_SECTIONS } from './types.js';

export const NORMAL_TARGETED_PAGE_LIMIT = 1;
export const NORMAL_TARGETED_VIEWPORT_LIMIT = 5;
export const NORMAL_TARGETED_ARTIFACT_LIMIT = 30;

export interface ScreenshotExecutionSummary {
	pages: number;
	invitations: number;
	viewports: number;
	artifacts: number;
	deferredPresetScopes: number;
}

function estimatedArtifacts(plan: ResolvedScreenshotPlan): number {
	return plan.invitations.reduce((total, invitation) => {
		const presetSections =
			invitation.sectionSelection.kind === 'preset'
				? KNOWN_SECTIONS.filter((section) => section.pageType === invitation.pageType)
						.length
				: 0;
		return total + invitation.tasks.length + presetSections * invitation.viewports.length;
	}, 0);
}

export function summarizeScreenshotPlans(
	plans: readonly ResolvedScreenshotPlan[],
): ScreenshotExecutionSummary {
	return {
		pages: plans.length,
		invitations: plans.reduce((total, plan) => total + plan.invitations.length, 0),
		viewports: plans.reduce(
			(total, plan) =>
				total +
				plan.invitations.reduce(
					(count, invitation) => count + invitation.viewports.length,
					0,
				),
			0,
		),
		artifacts: plans.reduce((total, plan) => total + estimatedArtifacts(plan), 0),
		deferredPresetScopes: plans.reduce(
			(total, plan) =>
				total +
				plan.invitations.filter(
					(invitation) => invitation.sectionSelection.kind === 'preset',
				).length,
			0,
		),
	};
}

export function assertScreenshotExecutionBudget(
	summary: ScreenshotExecutionSummary,
	options: { allowLarge?: boolean; source: 'config' | 'corpus' },
): void {
	// --corpus is an explicit, named high-cost command. It is still serialized and
	// printed as a complete plan, but does not become an accidental config batch.
	if (options.source === 'corpus' || options.allowLarge) return;
	const violations: string[] = [];
	if (summary.pages > NORMAL_TARGETED_PAGE_LIMIT) {
		violations.push(`${summary.pages} pages (limit ${NORMAL_TARGETED_PAGE_LIMIT})`);
	}
	if (summary.invitations > NORMAL_TARGETED_PAGE_LIMIT) {
		violations.push(`${summary.invitations} invitations (limit ${NORMAL_TARGETED_PAGE_LIMIT})`);
	}
	if (summary.viewports > NORMAL_TARGETED_VIEWPORT_LIMIT) {
		violations.push(`${summary.viewports} viewports (limit ${NORMAL_TARGETED_VIEWPORT_LIMIT})`);
	}
	if (summary.artifacts > NORMAL_TARGETED_ARTIFACT_LIMIT) {
		violations.push(
			`${summary.artifacts} planned artifacts (limit ${NORMAL_TARGETED_ARTIFACT_LIMIT})`,
		);
	}
	if (violations.length > 0) {
		throw new Error(
			`Screenshot execution exceeds the normal targeted budget: ${violations.join('; ')}. Use --allow-large only when the broader run is intentional.`,
		);
	}
}
