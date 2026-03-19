import { readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

import { matchAny } from './gatekeeper.mjs';
import { normalizePath } from './commit-message-analysis.mjs';
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

function discoverCommitPlanning({ repoRootPath, diffEntries = [], planId }) {
	const normalizedEntries = normalizeDiffEntries(diffEntries);
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
		};
	}

	const loadedPlan = loadValidatedCommitPlan(planId, repoRootPath);
	if (!loadedPlan.ok) {
		return {
			status: loadedPlan.reason || 'invalid_plan_contract',
			planningMode: 'blocked',
			planId,
			matchedUnits: [],
			recommendedUnit: null,
			ambiguousUnits: [],
			unmatchedFiles: normalizedEntries.map((entry) => entry.path),
			errors: loadedPlan.errors || [],
		};
	}

	const pendingUnits = loadedPlan.plan.units.filter(
		(unit) => unit.status !== 'completed',
	);
	const matches = pendingUnits
		.map((unit) => ({ unit, match: matchDiffEntriesToUnit(unit, normalizedEntries) }))
		.filter((entry) => entry.match.ok)
		.map((entry) => materializeUnit(loadedPlan.plan, entry.unit, entry.match));

	if (!matches.length) {
		return {
			status: 'unit_mismatch',
			planningMode: 'blocked',
			planId,
			planFile: loadedPlan.plan.file,
			matchedUnits: [],
			recommendedUnit: null,
			ambiguousUnits: [],
			unmatchedFiles: normalizedEntries.map((entry) => entry.path),
			errors: [`Changed files do not match any commit unit in plan "${planId}".`],
		};
	}

	if (matches.length > 1) {
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
		};
	}

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
	};
}

function resolveCommitUnit(plan, unitId) {
	return (plan?.units || []).find((unit) => unit.id === unitId) || null;
}

function buildPlannedSubject(unit) {
	return `${unit.subject.verb} ${unit.subject.target}`.trim();
}

export {
	DEFAULT_COMMIT_MAP,
	DEFAULT_PLAN_ROOT,
	buildPlannedSubject,
	discoverCommitPlanning,
	listCommitPlanIds,
	loadValidatedCommitPlan,
	matchDiffEntriesToUnit,
	resolveCommitUnit,
};
