import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

import { normalizePath } from './commit-message-analysis.mjs';

const DEFAULT_PLAN_ROOT = '.agent/plans';
const DEFAULT_COMMIT_MAP = 'commit-map.json';
const DEFAULT_MANIFEST = 'manifest.json';
const ALLOWED_TYPES = new Set([
	'feat',
	'fix',
	'docs',
	'style',
	'refactor',
	'perf',
	'test',
	'build',
	'ci',
	'chore',
	'revert',
]);
const ALLOWED_CORRECTION_POLICIES = new Set(['absorb-compatible']);
const GENERIC_TARGETS = new Set([
	'change',
	'changes',
	'file',
	'files',
	'message',
	'messages',
	'scope',
	'scopes',
	'stuff',
	'things',
	'work',
]);

function readJson(file) {
	return JSON.parse(readFileSync(file, 'utf8'));
}

function sha256(value) {
	return createHash('sha256')
		.update(String(value || ''))
		.digest('hex');
}

function normalizePatternList(values) {
	return (values || []).map((value) => normalizePath(value)).filter(Boolean);
}

function normalizeUnit(rawUnit = {}) {
	const subject = {
		verb: String(rawUnit.subject?.verb || '')
			.trim()
			.toLowerCase(),
		target: String(rawUnit.subject?.target || '').trim(),
	};
	const include = normalizePatternList(rawUnit.include);
	const allowRelated = normalizePatternList(rawUnit.allowRelated);
	return {
		id: String(rawUnit.id || '').trim(),
		phaseId: String(rawUnit.phaseId || '').trim(),
		status: String(rawUnit.status || 'planned').trim() || 'planned',
		domain: String(rawUnit.domain || '').trim(),
		type: String(rawUnit.type || '')
			.trim()
			.toLowerCase(),
		subject,
		purpose: String(rawUnit.purpose || '').trim(),
		include,
		allowRelated,
		correctionPolicy: String(rawUnit.correctionPolicy || '').trim(),
		hash: sha256(
			JSON.stringify({
				id: rawUnit.id,
				phaseId: rawUnit.phaseId,
				domain: rawUnit.domain,
				type: rawUnit.type,
				subject,
				purpose: rawUnit.purpose,
				include,
				allowRelated,
				correctionPolicy: rawUnit.correctionPolicy,
			}),
		),
	};
}

function validateUnit(unit, manifestPhaseIds, unitIndex, duplicateIncludes) {
	const errors = [];
	if (!unit.id) errors.push(`units[${unitIndex}].id is required`);
	if (!unit.phaseId) errors.push(`units[${unitIndex}].phaseId is required`);
	if (unit.phaseId && !manifestPhaseIds.has(unit.phaseId)) {
		errors.push(
			`units[${unitIndex}].phaseId "${unit.phaseId}" does not exist in manifest.json`,
		);
	}
	if (!unit.domain) errors.push(`units[${unitIndex}].domain is required`);
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(unit.domain || '')) {
		errors.push(`units[${unitIndex}].domain must be kebab-case`);
	}
	if (!ALLOWED_TYPES.has(unit.type)) {
		errors.push(
			`units[${unitIndex}].type must be one of: ${Array.from(ALLOWED_TYPES).join(', ')}`,
		);
	}
	if (!unit.subject.verb) errors.push(`units[${unitIndex}].subject.verb is required`);
	if (!unit.subject.target) errors.push(`units[${unitIndex}].subject.target is required`);
	if (GENERIC_TARGETS.has(unit.subject.target.toLowerCase())) {
		errors.push(`units[${unitIndex}].subject.target is too generic`);
	}
	if (!unit.purpose) errors.push(`units[${unitIndex}].purpose is required`);
	if (!unit.include.length)
		errors.push(`units[${unitIndex}].include must contain at least one path`);
	if (!ALLOWED_CORRECTION_POLICIES.has(unit.correctionPolicy)) {
		errors.push(
			`units[${unitIndex}].correctionPolicy must be one of: ${Array.from(ALLOWED_CORRECTION_POLICIES).join(', ')}`,
		);
	}
	if (duplicateIncludes.length) {
		errors.push(
			`units[${unitIndex}].include duplicates patterns used by another unit: ${duplicateIncludes.join(', ')}`,
		);
	}
	return errors;
}

function validateCommitPlanDocument({ planId, planDir, rawPlan, manifest }) {
	const errors = [];
	const manifestPhaseIds = new Set(
		(manifest.phases || []).map((phase) => String(phase.id || '').trim()),
	);
	const unitIds = new Set();
	const includeOwners = new Map();
	const normalizedUnits = (rawPlan.units || []).map((rawUnit) => normalizeUnit(rawUnit));

	if (String(rawPlan.planId || '').trim() !== planId) {
		errors.push(`commit-map.json planId must match plan directory name "${planId}"`);
	}
	if (String(rawPlan.mode || '').trim() !== 'planned-commits') {
		errors.push('commit-map.json mode must be "planned-commits"');
	}
	if (!Array.isArray(rawPlan.units) || rawPlan.units.length === 0) {
		errors.push('commit-map.json must define at least one unit');
	}

	for (let index = 0; index < normalizedUnits.length; index += 1) {
		const unit = normalizedUnits[index];
		if (unitIds.has(unit.id)) {
			errors.push(`duplicate commit unit id "${unit.id}"`);
		}
		unitIds.add(unit.id);

		const duplicateIncludes = [];
		for (const pattern of unit.include) {
			if (includeOwners.has(pattern)) duplicateIncludes.push(pattern);
			else includeOwners.set(pattern, unit.id);
		}
		errors.push(...validateUnit(unit, manifestPhaseIds, index, duplicateIncludes));
	}

	return {
		ok: errors.length === 0,
		errors,
		plan: errors.length
			? null
			: {
					planId,
					planDir,
					file: resolve(planDir, DEFAULT_COMMIT_MAP),
					manifestFile: resolve(planDir, DEFAULT_MANIFEST),
					mode: 'planned-commits',
					units: normalizedUnits,
				},
	};
}

function loadValidatedCommitPlan(planId, repoRootPath) {
	const planDir = resolve(repoRootPath, DEFAULT_PLAN_ROOT, planId);
	const commitMapFile = resolve(planDir, DEFAULT_COMMIT_MAP);
	const manifestFile = resolve(planDir, DEFAULT_MANIFEST);

	if (!existsSync(planDir)) {
		return { ok: false, reason: 'plan_not_found', errors: [`Plan "${planId}" was not found.`] };
	}
	if (!existsSync(commitMapFile)) {
		return {
			ok: false,
			reason: 'invalid_plan_contract',
			errors: [`Plan "${planId}" is missing commit-map.json.`],
		};
	}
	if (!existsSync(manifestFile)) {
		return {
			ok: false,
			reason: 'invalid_plan_contract',
			errors: [`Plan "${planId}" is missing manifest.json.`],
		};
	}

	try {
		const rawPlan = readJson(commitMapFile);
		const manifest = readJson(manifestFile);
		return validateCommitPlanDocument({
			planId,
			planDir,
			rawPlan,
			manifest,
		});
	} catch (error) {
		return {
			ok: false,
			reason: 'invalid_plan_contract',
			errors: [error instanceof Error ? error.message : String(error)],
		};
	}
}

function main() {
	const repoRootPath = process.cwd();
	const argPlanIndex = process.argv.indexOf('--plan');
	const requestedPlanId = argPlanIndex >= 0 ? process.argv[argPlanIndex + 1] || null : null;
	const plansRoot = resolve(repoRootPath, DEFAULT_PLAN_ROOT);
	const planIds = requestedPlanId
		? [requestedPlanId]
		: existsSync(plansRoot)
			? readdirSync(plansRoot, { withFileTypes: true })
					.filter((entry) => entry.isDirectory())
					.map((entry) => entry.name)
					.filter((name) => name !== 'archive')
			: [];

	let failed = false;
	for (const planId of planIds) {
		const result = loadValidatedCommitPlan(planId, repoRootPath);
		if (!result.ok) {
			failed = true;
			console.error(`❌ ${planId}`);
			for (const error of result.errors || []) console.error(`- ${error}`);
			continue;
		}
		console.log(`✅ ${planId}`);
	}
	if (failed) process.exit(1);
}

const isMain =
	import.meta.url ===
	`file://${process.platform === 'win32' ? '/' : ''}${process.argv[1]?.replace(/\\/g, '/')}`;
if (isMain) {
	main();
}

export {
	ALLOWED_CORRECTION_POLICIES,
	ALLOWED_TYPES,
	DEFAULT_COMMIT_MAP,
	DEFAULT_MANIFEST,
	DEFAULT_PLAN_ROOT,
	loadValidatedCommitPlan,
	normalizeUnit,
	validateCommitPlanDocument,
};
