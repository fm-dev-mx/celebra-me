#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { gatekeeperReadinessIssues } from './commit-plan.mjs';
import { matchAny } from './gatekeeper.mjs';
import {
	DEFAULT_COMMIT_MAP,
	DEFAULT_MANIFEST,
	normalizeUnit,
	resolvePlanDirectory,
	validateCommitPlanDocument,
} from './validate-commit-plan.mjs';
import {
	getStagedDiffEntries,
	getUnstagedTrackedEntries,
	getWorkingTreeDiffEntries,
} from './repo-diff-state.mjs';

function readJson(file) {
	return JSON.parse(readFileSync(file, 'utf8'));
}

function parseArgs(argv) {
	const args = {
		plan: null,
		json: false,
		verbose: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === '--plan') args.plan = argv[index + 1] || null;
		if (token === '--json') args.json = true;
		if (token === '--verbose') args.verbose = true;
	}
	return args;
}

function unique(values) {
	return Array.from(new Set(values.filter(Boolean)));
}

function sample(values, limit = 5) {
	return unique(values).slice(0, limit);
}

function classifyValidationCodes(validation) {
	if (validation.ok) return [];
	if (validation.reason === 'historical_plan_in_active_root') {
		return ['historical_plan_in_active_root'];
	}
	if (
		(validation.errors || []).some(
			(error) =>
				error.includes('semantically overlapping') ||
				error.includes('duplicates patterns used by another unit'),
		)
	) {
		return ['unit_overlap_detected'];
	}
	return ['invalid_plan_contract'];
}

function analyzeUnitCoverage(units, diffEntries) {
	const entries = diffEntries || [];
	const unitCoverage = [];
	const primaryUnitIds = [];
	const coveredPaths = new Set();

	for (const unit of units) {
		const includedPaths = [];
		const relatedPaths = [];
		for (const entry of entries) {
			if (matchAny(entry.path, unit.include || [])) {
				includedPaths.push(entry.path);
				coveredPaths.add(entry.path);
				continue;
			}
			if (matchAny(entry.path, unit.allowRelated || [])) {
				relatedPaths.push(entry.path);
				coveredPaths.add(entry.path);
			}
		}
		if (includedPaths.length || relatedPaths.length) {
			unitCoverage.push({
				id: unit.id,
				includedPaths,
				relatedPaths,
			});
		}
		if (includedPaths.length) {
			primaryUnitIds.push(unit.id);
		}
	}

	const unmappedPaths = entries
		.map((entry) => entry.path)
		.filter((path) => !coveredPaths.has(path));

	return {
		unitCoverage,
		primaryUnitIds: unique(primaryUnitIds),
		unmappedPaths: unique(unmappedPaths),
	};
}

function buildDoctorResult(planId, changedPaths, stagedPaths, unstagedPaths, mixedPaths) {
	return {
		planId,
		status: 'blocked',
		codes: [],
		errors: [],
		counts: {
			changedFileCount: changedPaths.length,
			stagedFileCount: stagedPaths.length,
			unstagedFileCount: unstagedPaths.length,
			mixedStagedUnstagedCount: unique(mixedPaths).length,
			coveredUnitCount: 0,
			primaryUnitCount: 0,
			unmappedFileCount: 0,
		},
		unitIds: [],
		sampleFiles: {
			staged: sample(stagedPaths),
			mixedStagedUnstaged: sample(mixedPaths),
			unmapped: [],
		},
		details: {
			changedPaths,
			stagedPaths,
			unstagedPaths,
			mixedStagedUnstagedPaths: unique(mixedPaths),
			unitCoverage: [],
			unmappedPaths: [],
		},
		planLocation: null,
	};
}

function addDirtyIndexIssues(result, stagedPaths, mixedPaths) {
	if (!stagedPaths.length && !mixedPaths.length) return;

	result.codes.push('dirty_index');
	if (stagedPaths.length) {
		result.errors.push(
			`Git index must be pristine before gatekeeper execution (staged files: ${stagedPaths.length}).`,
		);
	}
	if (mixedPaths.length) {
		result.errors.push(
			`Mixed staged/unstaged drift detected on ${unique(mixedPaths).length} file(s).`,
		);
	}
}

function loadDoctorPlan(repoRootPath, planId) {
	const resolvedPlan = resolvePlanDirectory(planId, repoRootPath);
	if (!resolvedPlan) {
		return {
			ok: false,
			code: 'plan_not_found',
			errors: [`Plan "${planId}" was not found.`],
		};
	}

	const commitMapFile = resolve(resolvedPlan.planDir, DEFAULT_COMMIT_MAP);
	const manifestFile = resolve(resolvedPlan.planDir, DEFAULT_MANIFEST);
	if (!existsSync(commitMapFile) || !existsSync(manifestFile)) {
		const errors = [];
		if (!existsSync(commitMapFile)) errors.push(`Plan "${planId}" is missing commit-map.json.`);
		if (!existsSync(manifestFile)) errors.push(`Plan "${planId}" is missing manifest.json.`);
		return {
			ok: false,
			resolvedPlan,
			code: 'invalid_plan_contract',
			errors,
		};
	}

	try {
		const rawPlan = readJson(commitMapFile);
		const manifest = readJson(manifestFile);
		const validation = validateCommitPlanDocument({
			planId,
			planDir: resolvedPlan.planDir,
			rawPlan,
			manifest,
			location: resolvedPlan.location,
		});
		return {
			ok: true,
			resolvedPlan,
			rawPlan,
			validation,
			normalizedUnits: Array.isArray(rawPlan.units) ? rawPlan.units.map(normalizeUnit) : [],
		};
	} catch (error) {
		return {
			ok: false,
			resolvedPlan,
			code: 'invalid_plan_contract',
			errors: [error instanceof Error ? error.message : String(error)],
		};
	}
}

function applyCoverage(result, coverage) {
	result.counts.coveredUnitCount = coverage.unitCoverage.length;
	result.counts.primaryUnitCount = coverage.primaryUnitIds.length;
	result.counts.unmappedFileCount = coverage.unmappedPaths.length;
	result.unitIds = coverage.primaryUnitIds;
	result.sampleFiles.unmapped = sample(coverage.unmappedPaths);
	result.details.unitCoverage = coverage.unitCoverage;
	result.details.unmappedPaths = coverage.unmappedPaths;
}

function finalizeDoctorResult(result) {
	result.codes = unique(result.codes);
	result.errors = unique(result.errors);
	if (!result.codes.length) {
		result.codes = ['plan_ok'];
		result.status = 'plan_ok';
		return result;
	}

	result.status = 'blocked';
	return result;
}

function doctorCommitPlan({
	repoRootPath,
	planId,
	diffEntries = [],
	stagedEntries = [],
	unstagedEntries = [],
}) {
	const changedPaths = diffEntries.map((entry) => entry.path);
	const stagedPaths = stagedEntries.map((entry) => entry.path);
	const unstagedPaths = unstagedEntries.map((entry) => entry.path);
	const mixedStagedUnstagedPaths = stagedPaths.filter((path) => unstagedPaths.includes(path));
	const result = buildDoctorResult(
		planId,
		changedPaths,
		stagedPaths,
		unstagedPaths,
		mixedStagedUnstagedPaths,
	);

	if (!planId) {
		result.codes = ['plan_not_found'];
		result.errors = ['plans:doctor requires --plan <id>.'];
		return result;
	}

	addDirtyIndexIssues(result, stagedPaths, mixedStagedUnstagedPaths);

	const loadedPlan = loadDoctorPlan(repoRootPath, planId);
	if (!loadedPlan.ok) {
		if (loadedPlan.resolvedPlan) result.planLocation = loadedPlan.resolvedPlan.location;
		result.codes.push(loadedPlan.code);
		result.errors.push(...loadedPlan.errors);
		return result;
	}

	result.planLocation = loadedPlan.resolvedPlan.location;
	const executableUnits = loadedPlan.normalizedUnits.filter(
		(unit) => String(unit?.status || '').trim() !== 'completed',
	);
	const coverage = analyzeUnitCoverage(executableUnits, diffEntries);
	applyCoverage(result, coverage);

	if (!loadedPlan.validation.ok) {
		result.codes.push(...classifyValidationCodes(loadedPlan.validation));
		result.errors.push(...(loadedPlan.validation.errors || []));
	}

	if (coverage.primaryUnitIds.length > 1) {
		result.codes.push('multiple_units_present');
		result.errors.push(
			`Current working tree spans multiple units (${coverage.primaryUnitIds.join(', ')}). Reduce it to one material unit before gatekeeper execution.`,
		);
	}

	if (coverage.unmappedPaths.length) {
		result.codes.push('unmapped_files_present');
		result.errors.push(
			`Current working tree contains ${coverage.unmappedPaths.length} unmapped file(s). Update the plan before using gatekeeper.`,
		);
	}

	if (loadedPlan.validation.ok && !loadedPlan.validation.plan.historicalPlan) {
		const readinessIssues = gatekeeperReadinessIssues(loadedPlan.validation.plan);
		for (const issue of readinessIssues) {
			result.codes.push(issue.code);
			result.errors.push(issue.message);
		}
	}

	return finalizeDoctorResult(result);
}

function printDoctorResult(result, { verbose = false } = {}) {
	console.log(`status=${result.status}`);
	console.log(
		`changed=${result.counts.changedFileCount} staged=${result.counts.stagedFileCount} units=${result.counts.primaryUnitCount} unmapped=${result.counts.unmappedFileCount}`,
	);
	console.log(`codes=${result.codes.join(', ')}`);
	if (result.unitIds.length) {
		console.log(`units=${result.unitIds.join(', ')}`);
	}
	if (result.errors.length) {
		console.log('errors:');
		for (const error of result.errors) console.log(`- ${error}`);
	}
	if (result.sampleFiles.unmapped.length) {
		console.log('sampleUnmappedFiles:');
		for (const file of result.sampleFiles.unmapped) console.log(`- ${file}`);
	}
	if (result.sampleFiles.staged.length) {
		console.log('sampleStagedFiles:');
		for (const file of result.sampleFiles.staged) console.log(`- ${file}`);
	}
	if (result.sampleFiles.mixedStagedUnstaged.length) {
		console.log('sampleMixedStagedUnstagedFiles:');
		for (const file of result.sampleFiles.mixedStagedUnstaged) console.log(`- ${file}`);
	}
	if (!verbose) {
		console.log('Use --verbose or --json for full details.');
		return;
	}
	if (result.planLocation) {
		console.log(`planLocation=${result.planLocation}`);
	}
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args.plan) {
		console.error('❌ plans:doctor requires --plan <id>.');
		process.exit(1);
	}
	const result = doctorCommitPlan({
		repoRootPath: process.cwd(),
		planId: args.plan,
		diffEntries: getWorkingTreeDiffEntries(),
		stagedEntries: getStagedDiffEntries(),
		unstagedEntries: getUnstagedTrackedEntries(),
	});
	if (args.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	printDoctorResult(result, { verbose: args.verbose });
	if (result.status !== 'plan_ok') {
		process.exit(1);
	}
}

const isMain =
	import.meta.url ===
	`file://${process.platform === 'win32' ? '/' : ''}${process.argv[1]?.replace(/\\/g, '/')}`;

if (isMain) {
	main();
}

export { doctorCommitPlan, printDoctorResult };
