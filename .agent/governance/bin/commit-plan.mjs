import { readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

import { matchAny, normalizePath } from './commit-message-analysis.mjs';
import {
	DEFAULT_COMMIT_MAP,
	DEFAULT_PLAN_ROOT,
	loadValidatedCommitPlan,
} from './validate-commit-plan.mjs';

function normalizeDiffEntries(diffEntries = []) {
	return diffEntries
		.map((entry) => ({
			path: normalizePath(entry.path),
			oldPath: normalizePath(entry.oldPath || ''),
			status: String(entry.status || 'M').toUpperCase(),
			area: String(entry.area || '').trim() || undefined,
		}))
		.filter((entry) => entry.path);
}

function listCommitPlanIds(repoRootPath) {
	const root = resolve(repoRootPath, DEFAULT_PLAN_ROOT);
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => name !== 'archive')
		.filter((name) => existsSync(join(root, name, DEFAULT_COMMIT_MAP)))
		.sort((left, right) => left.localeCompare(right));
}

function matchDiffEntriesToUnit(unit, diffEntries = []) {
	const normalizedEntries = normalizeDiffEntries(diffEntries);
	const included = [];
	const related = [];
	const unmatched = [];

	for (const entry of normalizedEntries) {
		if (matchAny(entry.path, unit.include)) {
			included.push(entry);
			continue;
		}
		if (matchAny(entry.path, unit.allowRelated || [])) {
			related.push(entry);
			continue;
		}
		unmatched.push(entry);
	}

	return {
		ok: included.length > 0 && unmatched.length === 0,
		unitId: unit.id,
		matchMode: related.length > 0 ? 'compatible' : 'exact',
		files: normalizedEntries.map((entry) => entry.path),
		included,
		related,
		unmatched,
	};
}

function materializeUnit(plan, unit, match) {
	return {
		...unit,
		planId: plan.planId,
		planFile: plan.file,
		scope: unit.domain,
		files: match.files,
		included: match.included.map((entry) => entry.path),
		related: match.related.map((entry) => entry.path),
		unmatched: match.unmatched.map((entry) => entry.path),
		unitMatchMode: match.matchMode,
	};
}

function unitReadyForGatekeeper(unit) {
	return ['ready', 'revised-after-gatekeeper'].includes(String(unit?.status || '').trim());
}

function blockingUnitStatuses(plan) {
	return (plan?.units || [])
		.filter((unit) => unit.status !== 'completed')
		.filter((unit) => !unitReadyForGatekeeper(unit))
		.map((unit) => `${unit.id} (${unit.status})`);
}

function completedUnitStatuses(plan) {
	return (plan?.units || [])
		.filter((unit) => String(unit?.status || '').trim() === 'completed')
		.map((unit) => `${unit.id} (${unit.status})`);
}

function gatekeeperReadinessIssues(plan) {
	const issues = [];
	const review = plan?.commitStrategyReview || null;
	const reviewedAt = String(review?.reviewedAt || '').trim();
	const notes = String(review?.notes || '').trim();
	const readyForGatekeeperAt = String(review?.readyForGatekeeperAt || '').trim();
	const blockingUnits = blockingUnitStatuses(plan);
	const completedUnits = completedUnitStatuses(plan);

	if (!reviewedAt || !notes) {
		issues.push({
			code: 'strategy_not_reviewed',
			message: `Plan "${plan?.planId || 'unknown'}" has not completed its final commit-strategy review. Update commitStrategyReview.reviewedAt and notes before running gatekeeper.`,
		});
	}

	if (!readyForGatekeeperAt) {
		issues.push({
			code: 'not_ready_for_gatekeeper',
			message: `Plan "${plan?.planId || 'unknown'}" is not ready for gatekeeper. Set commitStrategyReview.readyForGatekeeperAt after the final review.`,
		});
	}

	if (blockingUnits.length) {
		issues.push({
			code: 'not_ready_for_gatekeeper',
			message: `Plan "${plan?.planId || 'unknown'}" is not ready for gatekeeper. Promote active units to ready or revised-after-gatekeeper before rerunning inspect (blocking: ${blockingUnits.join(', ')}).`,
		});
	}

	if (completedUnits.length) {
		issues.push({
			code: 'not_ready_for_gatekeeper',
			message: `Active executable plans must not contain completed units. Re-issue the remaining work as ready or revised-after-gatekeeper before running gatekeeper again (completed: ${completedUnits.join(', ')}).`,
		});
	}

	return issues;
}

function planReadyForGatekeeper(plan) {
	return gatekeeperReadinessIssues(plan).length === 0;
}

function summarizePlanningOutcome(normalizedEntries, matches = [], unmatchedFiles = []) {
	return {
		changedFileCount: normalizedEntries.length,
		matchedUnitCount: matches.length,
		matchedUnitIds: matches.map((unit) => unit.id),
		unmatchedFileCount: unmatchedFiles.length,
		sampleUnmatchedFiles: unmatchedFiles.slice(0, 5),
	};
}

function discoverCommitPlanning({ repoRootPath, diffEntries = [], planId }) {
	const normalizedEntries = normalizeDiffEntries(diffEntries);
	const emptySummary = summarizePlanningOutcome(normalizedEntries, [], []);
	if (!planId) {
		return {
			status: 'plan_required',
			planningMode: 'blocked',
			planId: null,
			matchedUnits: [],
			recommendedUnit: null,
			ambiguousUnits: [],
			unmatchedFiles: normalizedEntries.map((entry) => entry.path),
			errors: ['Pure plan-aware workflow requires --plan <id>.'],
			summary: emptySummary,
		};
	}
	if (!normalizedEntries.length) {
		return {
			status: 'empty_change_set',
			planningMode: 'blocked',
			planId,
			matchedUnits: [],
			recommendedUnit: null,
			ambiguousUnits: [],
			unmatchedFiles: [],
			errors: [],
			summary: emptySummary,
		};
	}

	const loadedPlan = loadValidatedCommitPlan(planId, repoRootPath);
	if (!loadedPlan.ok) {
		const unmatchedFiles = normalizedEntries.map((entry) => entry.path);
		return {
			status: loadedPlan.reason || 'invalid_plan_contract',
			planningMode: 'blocked',
			planId,
			matchedUnits: [],
			recommendedUnit: null,
			ambiguousUnits: [],
			unmatchedFiles,
			errors: loadedPlan.errors || [],
			summary: summarizePlanningOutcome(normalizedEntries, [], unmatchedFiles),
		};
	}
	if (loadedPlan.plan.location === 'archive' || loadedPlan.plan.historicalPlan) {
		const unmatchedFiles = normalizedEntries.map((entry) => entry.path);
		return {
			status: 'plan_archived',
			planningMode: 'blocked',
			planId,
			planFile: loadedPlan.plan.file,
			matchedUnits: [],
			recommendedUnit: null,
			ambiguousUnits: [],
			unmatchedFiles,
			errors: [
				`Plan "${planId}" is archived and cannot be used for new gatekeeper execution.`,
			],
			summary: summarizePlanningOutcome(normalizedEntries, [], unmatchedFiles),
		};
	}
	if (!planReadyForGatekeeper(loadedPlan.plan)) {
		const unmatchedFiles = normalizedEntries.map((entry) => entry.path);
		const readinessIssues = gatekeeperReadinessIssues(loadedPlan.plan);
		return {
			status: 'commit_strategy_not_ready',
			planningMode: 'blocked',
			planId,
			planFile: loadedPlan.plan.file,
			matchedUnits: [],
			recommendedUnit: null,
			ambiguousUnits: [],
			unmatchedFiles,
			errors: readinessIssues.map((issue) => issue.message),
			summary: summarizePlanningOutcome(normalizedEntries, [], unmatchedFiles),
		};
	}

	const pendingUnits = loadedPlan.plan.units.filter((unit) => unit.status !== 'completed');
	const matches = pendingUnits
		.map((unit) => ({ unit, match: matchDiffEntriesToUnit(unit, normalizedEntries) }))
		.filter((entry) => entry.match.ok)
		.map((entry) => materializeUnit(loadedPlan.plan, entry.unit, entry.match));

	if (!matches.length) {
		const unmatchedFiles = normalizedEntries.map((entry) => entry.path);
		return {
			status: 'unit_mismatch',
			planningMode: 'blocked',
			planId,
			planFile: loadedPlan.plan.file,
			matchedUnits: [],
			recommendedUnit: null,
			ambiguousUnits: [],
			unmatchedFiles,
			errors: [`Changed files do not match any commit unit in plan "${planId}".`],
			summary: summarizePlanningOutcome(normalizedEntries, [], unmatchedFiles),
		};
	}

	if (matches.length > 1) {
		const summary = summarizePlanningOutcome(normalizedEntries, matches, []);
		return {
			status: 'unit_ambiguity',
			planningMode: 'blocked',
			planId,
			planFile: loadedPlan.plan.file,
			matchedUnits: matches,
			recommendedUnit: null,
			ambiguousUnits: matches.map((unit) => unit.id),
			unmatchedFiles: [],
			errors: [`Changed files match multiple commit units in plan "${planId}".`],
			summary,
		};
	}

	const summary = summarizePlanningOutcome(normalizedEntries, matches, []);
	return {
		status: 'matched_unit',
		planningMode: 'plan',
		planId,
		planFile: loadedPlan.plan.file,
		matchedUnits: matches,
		recommendedUnit: matches[0],
		ambiguousUnits: [],
		unmatchedFiles: [],
		errors: [],
		summary,
	};
}

function resolveCommitUnit(plan, unitId) {
	return (plan?.units || []).find((unit) => unit.id === unitId) || null;
}

function buildPlannedSubject(unit) {
	return `${unit.subject.verb} ${unit.subject.target}`.trim();
}

function buildPlannedHeader(unit) {
	return `${unit.type}(${unit.domain}): ${buildPlannedSubject(unit)}`;
}

export {
	DEFAULT_COMMIT_MAP,
	DEFAULT_PLAN_ROOT,
	buildPlannedHeader,
	buildPlannedSubject,
	discoverCommitPlanning,
	listCommitPlanIds,
	loadValidatedCommitPlan,
	matchDiffEntriesToUnit,
	resolveCommitUnit,
	gatekeeperReadinessIssues,
	summarizePlanningOutcome,
};
