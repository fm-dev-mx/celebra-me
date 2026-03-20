import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

import { normalizePath } from './commit-message-analysis.mjs';
import { matchAny } from './gatekeeper.mjs';

const DEFAULT_PLAN_ROOT = '.agent/plans';
const DEFAULT_ARCHIVE_ROOT = '.agent/plans/archive';
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
const ALLOWED_UNIT_STATUSES = new Set([
	'planned',
	'draft',
	'locked',
	'ready',
	'revised-after-gatekeeper',
	'completed',
]);
const ACTIVE_UNIT_STATUSES = new Set([
	'draft',
	'locked',
	'ready',
	'revised-after-gatekeeper',
	'completed',
]);
const HISTORICAL_MANIFEST_STATUSES = new Set(['COMPLETED', 'ARCHIVED']);
const MAX_TARGET_LENGTH = 50;
const HEADER_MAX_LENGTH = 130;
const SUMMARY_LINE_MAX_LENGTH = 140;
const MAX_SUMMARY_LINES = 4;
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
const FILE_PATH_PATTERN = /(^|[\s(])(?:\.?[\w-]+\/)+[\w.-]+/;

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

function buildCanonicalCommitHeader(unit) {
	const subject = `${unit.subject.verb} ${unit.subject.target}`.trim();
	return `${unit.type}(${unit.domain}): ${subject}`;
}

function unitStatusReadyForGatekeeper(status) {
	return ['ready', 'revised-after-gatekeeper', 'completed'].includes(String(status || '').trim());
}

function normalizeMessagePreview(rawPreview) {
	if (!rawPreview) return null;
	const header = String(rawPreview.header || '').trim();
	const summary = Array.isArray(rawPreview.summary)
		? rawPreview.summary.map((entry) => String(entry || '').trim()).filter(Boolean)
		: [];
	return {
		header,
		summary,
	};
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
		status: String(rawUnit.status || 'draft').trim() || 'draft',
		domain: String(rawUnit.domain || '').trim(),
		type: String(rawUnit.type || '')
			.trim()
			.toLowerCase(),
		subject,
		purpose: String(rawUnit.purpose || '').trim(),
		include,
		allowRelated,
		correctionPolicy: String(rawUnit.correctionPolicy || '').trim(),
		messagePreview: normalizeMessagePreview(rawUnit.messagePreview || null),
		hash: sha256(
			JSON.stringify({
				id: rawUnit.id,
				phaseId: rawUnit.phaseId,
				status: rawUnit.status,
				domain: rawUnit.domain,
				type: rawUnit.type,
				subject,
				purpose: rawUnit.purpose,
				include,
				allowRelated,
				correctionPolicy: rawUnit.correctionPolicy,
				messagePreview: rawUnit.messagePreview || null,
			}),
		),
	};
}

function isIsoDateLike(value) {
	const text = String(value || '').trim();
	if (!text) return false;
	const timestamp = Date.parse(text);
	return !Number.isNaN(timestamp);
}

function containsFilePathLikeText(line) {
	return FILE_PATH_PATTERN.test(String(line || '').trim());
}

function validateUnit(unit, manifestPhaseIds, unitIndex, duplicateIncludes, options = {}) {
	const errors = [];
	const historicalPlan = Boolean(options.historicalPlan);

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
	if (!ALLOWED_UNIT_STATUSES.has(unit.status)) {
		errors.push(
			`units[${unitIndex}].status must be one of: ${Array.from(ALLOWED_UNIT_STATUSES).join(', ')}`,
		);
	}
	if (!historicalPlan && !ACTIVE_UNIT_STATUSES.has(unit.status)) {
		errors.push(
			`units[${unitIndex}].status must be one of the active lifecycle values: ${Array.from(ACTIVE_UNIT_STATUSES).join(', ')}`,
		);
	}
	if (!unit.subject.verb) errors.push(`units[${unitIndex}].subject.verb is required`);
	if (!unit.subject.target) errors.push(`units[${unitIndex}].subject.target is required`);
	if (GENERIC_TARGETS.has(unit.subject.target.toLowerCase())) {
		errors.push(`units[${unitIndex}].subject.target is too generic`);
	}
	if (!unit.purpose) errors.push(`units[${unitIndex}].purpose is required`);
	if (!unit.include.length) {
		errors.push(`units[${unitIndex}].include must contain at least one path`);
	}
	if (unit.allowRelated.includes('*')) {
		errors.push(
			`units[${unitIndex}].allowRelated must not use wildcard "*"; list explicit patterns`,
		);
	}
	if (unit.subject.target.length > MAX_TARGET_LENGTH) {
		errors.push(
			`units[${unitIndex}].subject.target exceeds ${MAX_TARGET_LENGTH} characters (${unit.subject.target.length})`,
		);
	}
	if (!ALLOWED_CORRECTION_POLICIES.has(unit.correctionPolicy)) {
		errors.push(
			`units[${unitIndex}].correctionPolicy must be one of: ${Array.from(ALLOWED_CORRECTION_POLICIES).join(', ')}`,
		);
	}
	if (!historicalPlan) {
		if (!unit.messagePreview) {
			errors.push(`units[${unitIndex}].messagePreview is required for active plans`);
		} else {
			if (!unit.messagePreview.header) {
				errors.push(
					`units[${unitIndex}].messagePreview.header must be non-empty when provided`,
				);
			}
			if (unit.messagePreview.header.length > HEADER_MAX_LENGTH) {
				errors.push(
					`units[${unitIndex}].messagePreview.header exceeds ${HEADER_MAX_LENGTH} characters`,
				);
			}
			if (!unit.messagePreview.summary.length) {
				errors.push(
					`units[${unitIndex}].messagePreview.summary must contain at least one bullet`,
				);
			}
			if (unit.messagePreview.summary.length > MAX_SUMMARY_LINES) {
				errors.push(
					`units[${unitIndex}].messagePreview.summary must not exceed ${MAX_SUMMARY_LINES} bullets`,
				);
			}
			for (
				let summaryIndex = 0;
				summaryIndex < unit.messagePreview.summary.length;
				summaryIndex += 1
			) {
				const line = unit.messagePreview.summary[summaryIndex];
				if (line.length > SUMMARY_LINE_MAX_LENGTH) {
					errors.push(
						`units[${unitIndex}].messagePreview.summary[${summaryIndex}] exceeds ${SUMMARY_LINE_MAX_LENGTH} characters`,
					);
				}
				if (containsFilePathLikeText(line)) {
					errors.push(
						`units[${unitIndex}].messagePreview.summary[${summaryIndex}] must not contain file paths`,
					);
				}
			}
			const canonicalHeader = buildCanonicalCommitHeader(unit);
			if (unit.messagePreview.header && unit.messagePreview.header !== canonicalHeader) {
				errors.push(
					`units[${unitIndex}].messagePreview.header must exactly equal "${canonicalHeader}"`,
				);
			}
		}
	}
	if (duplicateIncludes.length) {
		errors.push(
			`units[${unitIndex}].include duplicates patterns used by another unit: ${duplicateIncludes.join(', ')}`,
		);
	}
	return errors;
}

function validateCommitPlanDocument({ planId, planDir, rawPlan, manifest, location }) {
	const errors = [];
	const manifestPhaseIds = new Set(
		(manifest.phases || []).map((phase) => String(phase.id || '').trim()),
	);
	const unitIds = new Set();
	const includeOwners = new Map();
	const normalizedUnits = (rawPlan.units || []).map((rawUnit) => normalizeUnit(rawUnit));
	const manifestStatus = String(manifest.status || '')
		.trim()
		.toUpperCase();
	const historicalPlan =
		HISTORICAL_MANIFEST_STATUSES.has(manifestStatus) || location === 'archive';

	if (String(rawPlan.planId || '').trim() !== planId) {
		errors.push(`commit-map.json planId must match plan directory name "${planId}"`);
	}
	if (String(rawPlan.mode || '').trim() !== 'planned-commits') {
		errors.push('commit-map.json mode must be "planned-commits"');
	}

	const review = rawPlan.commitStrategyReview || null;
	if (!historicalPlan) {
		if (!review || typeof review !== 'object') {
			errors.push('commit-map.json must define commitStrategyReview for active plans');
		} else {
			if (!isIsoDateLike(review.draftedAt)) {
				errors.push('commitStrategyReview.draftedAt must be a valid ISO timestamp');
			}
			if (review.reviewedAt && !isIsoDateLike(review.reviewedAt)) {
				errors.push('commitStrategyReview.reviewedAt must be a valid ISO timestamp');
			}
			if (review.readyForGatekeeperAt && !isIsoDateLike(review.readyForGatekeeperAt)) {
				errors.push(
					'commitStrategyReview.readyForGatekeeperAt must be a valid ISO timestamp',
				);
			}
			if (
				(review.reviewedAt || review.readyForGatekeeperAt) &&
				!String(review.notes || '').trim()
			) {
				errors.push(
					'commitStrategyReview.notes is required once the final commit review has started',
				);
			}
			if (review.readyForGatekeeperAt && !review.reviewedAt) {
				errors.push(
					'commitStrategyReview.reviewedAt is required before readyForGatekeeperAt can be set',
				);
			}
		}
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
		errors.push(
			...validateUnit(unit, manifestPhaseIds, index, duplicateIncludes, {
				historicalPlan,
			}),
		);
	}

	if (!historicalPlan && review?.readyForGatekeeperAt) {
		const blockingUnits = normalizedUnits
			.filter((unit) => unit.status !== 'completed')
			.filter((unit) => !unitStatusReadyForGatekeeper(unit.status))
			.map((unit) => `${unit.id} (${unit.status})`);
		if (blockingUnits.length) {
			errors.push(
				`commitStrategyReview.readyForGatekeeperAt requires every active unit to be ready, revised-after-gatekeeper, or completed (blocking: ${blockingUnits.join(', ')})`,
			);
		}
	}

	errors.push(...detectPatternSubsumption(normalizedUnits, historicalPlan));

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
					location,
					historicalPlan,
					commitStrategyReview: review,
					manifestStatus: String(manifest.status || '').trim(),
					units: normalizedUnits,
				},
	};
}

function detectPatternSubsumption(units, historicalPlan) {
	const errors = [];
	const activeUnits = units.filter((unit) => unit.status !== 'completed');
	if (historicalPlan) return errors;
	for (let i = 0; i < activeUnits.length; i += 1) {
		for (let j = i + 1; j < activeUnits.length; j += 1) {
			const unitA = activeUnits[i];
			const unitB = activeUnits[j];
			const aSubsumesB = unitB.include.some((pattern) => matchAny(pattern, unitA.include));
			const bSubsumesA = unitA.include.some((pattern) => matchAny(pattern, unitB.include));
			if (aSubsumesB || bSubsumesA) {
				errors.push(
					`units "${unitA.id}" and "${unitB.id}" have semantically overlapping include patterns`,
				);
			}
		}
	}
	return errors;
}

function resolvePlanDirectory(planId, repoRootPath) {
	const activeDir = resolve(repoRootPath, DEFAULT_PLAN_ROOT, planId);
	if (existsSync(activeDir)) {
		return { planDir: activeDir, location: 'active' };
	}
	const archiveDir = resolve(repoRootPath, DEFAULT_ARCHIVE_ROOT, planId);
	if (existsSync(archiveDir)) {
		return { planDir: archiveDir, location: 'archive' };
	}
	return null;
}

function loadValidatedCommitPlan(planId, repoRootPath) {
	const resolvedPlan = resolvePlanDirectory(planId, repoRootPath);
	if (!resolvedPlan) {
		return { ok: false, reason: 'plan_not_found', errors: [`Plan "${planId}" was not found.`] };
	}
	const { planDir, location } = resolvedPlan;
	const commitMapFile = resolve(planDir, DEFAULT_COMMIT_MAP);
	const manifestFile = resolve(planDir, DEFAULT_MANIFEST);

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
			location,
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
	DEFAULT_ARCHIVE_ROOT,
	DEFAULT_COMMIT_MAP,
	DEFAULT_MANIFEST,
	DEFAULT_PLAN_ROOT,
	buildCanonicalCommitHeader,
	loadValidatedCommitPlan,
	normalizeUnit,
	validateCommitPlanDocument,
};
