#!/usr/bin/env node
import {
	existsSync,
	mkdirSync,
	renameSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from 'fs';
import { dirname, resolve } from 'path';

import { normalizePath } from './commit-message-analysis.mjs';
import {
	buildPlannedHeader,
	buildPlannedSubject,
	discoverCommitPlanning,
	loadValidatedCommitPlan,
	resolveCommitUnit,
} from './commit-plan.mjs';
import { buildCommitlintContext } from '../../../scripts/validate-commits.mjs';
import {
	getStagedDiffEntries,
	getWorkingTreeDiffEntries,
	run,
	signatureForEntries,
} from './repo-diff-state.mjs';

const SESSION_VERSION = 5;
const DEFAULT_SESSION_BASENAME = 'gatekeeper-session.json';
const DEFAULT_S0_BASENAME = 'gatekeeper-s0.json';

function fail(message) {
	console.error(`❌ ${message}`);
	process.exit(1);
}

function repoRoot() {
	const result = run('git', ['rev-parse', '--show-toplevel']);
	if (result.status !== 0) fail('Unable to detect repository root.');
	return result.stdout.trim();
}

function gitDir() {
	const result = run('git', ['rev-parse', '--git-dir']);
	if (result.status !== 0) fail('Unable to detect git directory.');
	return resolve(repoRoot(), result.stdout.trim());
}

function currentBranch() {
	const result = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
	if (result.status !== 0) fail('Unable to detect current branch.');
	return result.stdout.trim();
}

function currentHead() {
	const result = run('git', ['rev-parse', 'HEAD']);
	if (result.status !== 0) fail('Unable to detect HEAD SHA.');
	return result.stdout.trim();
}

function defaultArtifactPath(basename) {
	return resolve(gitDir(), basename);
}

function normalizeArtifactPaths(args) {
	return {
		...args,
		sessionFile: args.sessionFile || defaultArtifactPath(DEFAULT_SESSION_BASENAME),
		s0File: args.s0File || defaultArtifactPath(DEFAULT_S0_BASENAME),
	};
}

function parseArgs(argv) {
	const args = {
		command: argv[0] || 'inspect',
		plan: null,
		unit: null,
		sessionFile: null,
		s0File: null,
		json: false,
		verbose: false,
		verifyLocal: false,
		dryRun: false,
	};
	for (let index = 1; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === '--plan') args.plan = argv[index + 1] || null;
		if (token === '--unit') args.unit = argv[index + 1] || null;
		if (token === '--maintenance') args.maintenance = true;
		if (token === '--session-file') args.sessionFile = argv[index + 1] || args.sessionFile;
		if (token === '--s0-file') args.s0File = argv[index + 1] || args.s0File;
		if (token === '--json') args.json = true;
		if (token === '--verbose') args.verbose = true;
		if (token === '--verify-local') args.verifyLocal = true;
		if (token === '--dry-run') args.dryRun = true;
	}
	return normalizeArtifactPaths(args);
}

function writeAtomicJson(file, payload) {
	const target = resolve(file);
	const parent = dirname(target);
	if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
	const temp = `${target}.tmp`;
	writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
	if (existsSync(target)) rmSync(target, { force: true });
	renameSync(temp, target);
}

function loadJsonFile(file) {
	if (!existsSync(file)) return null;
	return JSON.parse(readFileSync(file, 'utf8'));
}

function cleanupArtifacts(args) {
	for (const file of [args.sessionFile, args.s0File]) {
		try {
			if (existsSync(file)) unlinkSync(file);
		} catch {
			/* ignore */
		}
	}
}

function buildSession(args, diffEntries, commitPlanning) {
	const now = new Date().toISOString();
	return {
		version: SESSION_VERSION,
		createdAt: now,
		refreshedAt: now,
		repoRoot: repoRoot(),
		branch: currentBranch(),
		head: currentHead(),
		planId: args.plan,
		changeSetSignature: signatureForEntries(diffEntries),
		diffEntries,
		commitPlanning,
		selectedUnitId: null,
	};
}

function validateSession(session, args) {
	if (!session) return { ok: false, reason: 'session_missing' };
	if (session.version !== SESSION_VERSION) {
		return { ok: false, reason: 'session_version_mismatch' };
	}
	if (session.repoRoot !== repoRoot()) return { ok: false, reason: 'session_repo_mismatch' };
	if (session.branch !== currentBranch()) return { ok: false, reason: 'session_branch_changed' };
	if (session.head !== currentHead()) return { ok: false, reason: 'session_head_changed' };
	if (args.plan && session.planId !== args.plan) {
		return { ok: false, reason: 'session_plan_mismatch' };
	}
	return { ok: true };
}

function assertWorkingTreeMatchesSession(session) {
	const currentEntries = getWorkingTreeDiffEntries();
	const currentSignature = signatureForEntries(currentEntries);
	if (currentSignature !== session.changeSetSignature) {
		fail('Working tree changed after inspect. Re-run gatekeeper-workflow inspect --plan <id>.');
	}
	return currentEntries;
}

function pathSpecsForEntries(entries) {
	const values = new Set();
	for (const entry of entries || []) {
		if (entry.oldPath) values.add(entry.oldPath);
		if (entry.path) values.add(entry.path);
	}
	return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function assertExactFiles(expectedFiles, actualEntries, label) {
	const actualFiles = actualEntries
		.map((entry) => entry.path)
		.sort((left, right) => left.localeCompare(right));
	const normalizedExpected = [...expectedFiles]
		.map(normalizePath)
		.sort((left, right) => left.localeCompare(right));
	if (normalizedExpected.length !== actualFiles.length) {
		fail(`${label} drift detected. Re-run inspect and stage the planned unit again.`);
	}
	for (let index = 0; index < normalizedExpected.length; index += 1) {
		if (normalizedExpected[index] !== actualFiles[index]) {
			fail(`${label} drift detected. Re-run inspect and stage the planned unit again.`);
		}
	}
}

function loadActiveUnit(planId, unitId) {
	const loadedPlan = loadValidatedCommitPlan(planId, repoRoot());
	if (!loadedPlan.ok) {
		fail((loadedPlan.errors || ['Unable to load commit plan.']).join('\n'));
	}
	if (loadedPlan.plan.location !== 'active') {
		fail(`Plan "${planId}" is archived and cannot be used for new gatekeeper execution.`);
	}
	const unit = resolveCommitUnit(loadedPlan.plan, unitId);
	if (!unit) fail(`Commit unit "${unitId}" was not found in plan "${planId}".`);
	return { plan: loadedPlan.plan, unit };
}

function buildCommitlintUnitContext(unit, files) {
	return {
		planId: unit.planId,
		unitId: unit.id,
		verb: unit.subject.verb,
		target: unit.subject.target,
		purpose: unit.purpose,
		files,
		domain: unit.domain,
	};
}

function buildCommitScaffold(split) {
	const files = [...(split.files || [])]
		.map(normalizePath)
		.sort((left, right) => left.localeCompare(right));
	const fileLines = files.map((file) => `- ${file}`);

	if (split.maintenance) {
		const header = split.message || 'chore(maintenance): unplanned fix';
		const bodySections = [['Files:', ...fileLines].join('\n')];
		const trailers = ['Maintenance: true'];
		return {
			header,
			summary: [],
			files: fileLines,
			trailers,
			fullMessage: `${header}\n\n${bodySections.join('\n\n')}\n\n${trailers.join('\n')}`,
		};
	}

	if (!split.commitUnit) throw new Error('Planned commit scaffold requires commitUnit.');
	// ... (rest of original buildCommitScaffold)
	const subject = buildPlannedSubject(split.commitUnit);
	const header = buildPlannedHeader(split.commitUnit);
	const plannedHeader = String(split.commitUnit.messagePreview?.header || '').trim();
	const summaryLines = Array.isArray(split.commitUnit.messagePreview?.summary)
		? split.commitUnit.messagePreview.summary.map((line) => `- ${String(line || '').trim()}`)
		: [];
	if (plannedHeader && plannedHeader !== header) {
		throw new Error(
			`Commit unit "${split.commitUnit.id}" defines a non-canonical messagePreview.header. Expected "${header}".`,
		);
	}
	if (!summaryLines.length) {
		throw new Error(
			`Commit unit "${split.commitUnit.id}" must define messagePreview.summary before scaffold generation.`,
		);
	}
	const bodySections = [summaryLines.join('\n'), ['Files:', ...fileLines].join('\n')];
	const trailers = [`Plan-Id: ${split.commitUnit.planId}`, `Commit-Unit: ${split.commitUnit.id}`];
	return {
		type: split.commitUnit.type,
		scope: split.commitUnit.domain,
		subject,
		header,
		summary: summaryLines,
		files: fileLines,
		trailers,
		titleSource: 'planned',
		fullMessage: `${header}\n\n${bodySections.join('\n\n')}\n\n${trailers.join('\n')}`,
	};
}

function validateGeneratedCommitMessage(message, unit, files, diffEntries) {
	const unitContext = buildCommitlintUnitContext(unit, files);
	const result = run('npx', ['--yes', 'commitlint'], {
		input: `${String(message || '').trim()}\n`,
		env: {
			...process.env,
			...buildCommitlintContext(files, diffEntries, unitContext),
		},
	});
	return {
		ok: result.status === 0,
		output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
		env: {
			...buildCommitlintContext(files, diffEntries, unitContext),
		},
	};
}

function writeSession(args, payload) {
	writeAtomicJson(args.sessionFile, payload);
}

function writeS0(args, payload) {
	writeAtomicJson(args.s0File, payload);
}

function loadS0(args) {
	return loadJsonFile(args.s0File);
}

function ensureSelectedUnit(session, args) {
	if (!args.unit) fail(`The ${args.command} command requires --unit <id>.`);
	if (session.commitPlanning?.status !== 'matched_unit') {
		fail(
			`Inspect did not resolve an executable unit. Current status: ${session.commitPlanning?.status || 'unknown'}.`,
		);
	}
	const recommended = session.commitPlanning.recommendedUnit;
	if (!recommended || recommended.id !== args.unit) {
		fail(`Commit unit "${args.unit}" is not the inspected executable unit for this session.`);
	}
	return recommended;
}

function loadCommitContext(args) {
	const session = loadJsonFile(args.sessionFile);
	const validation = validateSession(session, args);
	if (!validation.ok) {
		return { session: null, s0: null, unit: null, stagedEntries: null, reason: validation.reason };
	}
	const s0 = loadS0(args);
	const stagedEntries = getStagedDiffEntries();
	const { unit } = args.plan && args.unit ? loadActiveUnit(args.plan, args.unit) : { unit: null };

	return { session, s0, unit, stagedEntries };
}

function buildInspectPayload(payload, diffEntries, commitPlanning) {
	return {
		workflowRoute: commitPlanning.status === 'matched_unit' ? 'proceed_commit_unit' : 'blocked',
		routeReasons: commitPlanning.errors || [],
		changeSetSignature: payload.changeSetSignature,
		diffEntries,
		commitPlanning,
	};
}

function printList(label, values) {
	if (!values?.length) return;
	console.log(`${label}:`);
	for (const value of values) console.log(`- ${value}`);
}

function shouldPrintInspectHint(commitPlanning, sampleUnmatchedFiles) {
	return (
		(commitPlanning.summary?.unmatchedFileCount || 0) > sampleUnmatchedFiles.length ||
		Boolean(commitPlanning.errors?.length)
	);
}

function printInspectResult(args, diffEntries, commitPlanning) {
	const sampleUnmatchedFiles = args.verbose
		? commitPlanning.unmatchedFiles || []
		: commitPlanning.summary?.sampleUnmatchedFiles || [];
	console.log(`status=${commitPlanning.status}`);
	console.log(
		`changed=${commitPlanning.summary?.changedFileCount || diffEntries.length} matched=${commitPlanning.summary?.matchedUnitCount || 0} unmatched=${commitPlanning.summary?.unmatchedFileCount || 0}`,
	);
	if (commitPlanning.recommendedUnit) {
		console.log(`unit=${commitPlanning.recommendedUnit.id}`);
	}
	printList('errors', commitPlanning.errors || []);
	printList('sampleUnmatchedFiles', sampleUnmatchedFiles);
	if (args.verbose) {
		console.log(`sessionFile=${args.sessionFile}`);
		return;
	}
	if (shouldPrintInspectHint(commitPlanning, sampleUnmatchedFiles)) {
		console.log('Use --verbose or --json for full details.');
	}
}

function inspectCommand(args) {
	if (!args.plan) fail('Pure plan-aware workflow requires inspect --plan <id>.');
	const diffEntries = getWorkingTreeDiffEntries();
	const commitPlanning = discoverCommitPlanning({
		repoRootPath: repoRoot(),
		planId: args.plan,
		diffEntries,
	});
	const payload = buildSession(args, diffEntries, commitPlanning);
	if (commitPlanning.status === 'empty_change_set') cleanupArtifacts(args);
	if (!args.dryRun) {
		writeSession(args, payload);
	}
	if (args.json) {
		console.log(
			JSON.stringify(buildInspectPayload(payload, diffEntries, commitPlanning), null, 2),
		);
		return;
	}
	printInspectResult(args, diffEntries, commitPlanning);
}

function stageCommand(args) {
	if (!args.plan || !args.unit) fail('The stage command requires --plan <id> --unit <id>.');
	const session = loadJsonFile(args.sessionFile);
	const validation = validateSession(session, args);
	if (!validation.ok) {
		cleanupArtifacts(args);
		fail(`Session is invalid (${validation.reason}). Re-run inspect.`);
	}
	const currentEntries = assertWorkingTreeMatchesSession(session);
	const matchedUnit = ensureSelectedUnit(session, args);
	const unitEntries = currentEntries.filter((entry) => matchedUnit.files.includes(entry.path));
	const stagedSpecs = pathSpecsForEntries(getStagedDiffEntries());
	if (stagedSpecs.length) {
		run('git', ['reset', '-q', 'HEAD', '--', ...stagedSpecs], { stdio: 'inherit' });
	}
	const unitSpecs = pathSpecsForEntries(unitEntries);
	if (!unitSpecs.length) fail(`Commit unit "${args.unit}" did not resolve any stageable files.`);

	if (args.verifyLocal) {
		console.log('Running local unit verification...');
		const existingUnitSpecs = unitSpecs.filter((file) => existsSync(resolve(repoRoot(), file)));
		if (existingUnitSpecs.length) {
			const jsFiles = existingUnitSpecs.filter((f) =>
				/\.(ts|tsx|js|jsx|astro|mjs|cjs)$/.test(f),
			);
			const scssFiles = existingUnitSpecs.filter((f) => /\.scss$/.test(f));

			if (jsFiles.length) {
				const lintResult = run('pnpm', ['exec', 'eslint', ...jsFiles], { stdio: 'pipe' });
				if (lintResult.status !== 0) {
					console.log(lintResult.stdout);
					console.error(lintResult.stderr);
					fail('Local ESLint failed. Fix all errors before staging files.');
				}
			}

			if (scssFiles.length) {
				const lintResult = run('pnpm', ['exec', 'stylelint', ...scssFiles], {
					stdio: 'pipe',
				});
				if (lintResult.status !== 0) {
					console.log(lintResult.stdout);
					console.error(lintResult.stderr);
					fail('Local Stylelint failed. Fix all errors before staging files.');
				}
			}
		}
	}

	run('git', ['add', '-A', '--', ...unitSpecs], { stdio: 'inherit' });
	const stagedEntries = getStagedDiffEntries();
	assertExactFiles(matchedUnit.files, stagedEntries, 'Staged unit');
	const stagedSignature = signatureForEntries(stagedEntries);
	const s0Payload = {
		version: 1,
		planId: args.plan,
		unitId: args.unit,
		files: matchedUnit.files,
		changeSetSignature: session.changeSetSignature,
		stagedSignature,
		unitHash: matchedUnit.hash,
	};
	writeS0(args, s0Payload);
	writeSession(args, {
		...session,
		refreshedAt: new Date().toISOString(),
		selectedUnitId: args.unit,
	});
	if (args.json) {
		console.log(JSON.stringify(s0Payload, null, 2));
		return;
	}
	console.log(
		`✅ Staged plan "${args.plan}" unit "${args.unit}" with ${matchedUnit.files.length} file(s).`,
	);
	console.log(`📄 S0 file: ${args.s0File}`);
}

function scaffoldCommand(args) {
	if (!args.unit) fail('The scaffold command requires --unit <id>.');
	const { session, unit, stagedEntries } = loadCommitContext(args);
	unit.planId = session.planId;
	const files = stagedEntries.map((entry) => entry.path);
	const scaffold = buildCommitScaffold({
		id: unit.id,
		files,
		commitUnit: unit,
	});
	const validation = validateGeneratedCommitMessage(
		scaffold.fullMessage,
		unit,
		files,
		stagedEntries,
	);
	if (!validation.ok) {
		fail(
			`Generated scaffold does not satisfy commitlint:\n${validation.output || 'unknown validation failure'}`,
		);
	}
	if (args.json) {
		console.log(JSON.stringify(scaffold, null, 2));
		return;
	}
	console.log(scaffold.fullMessage);
}

function executeCommit(message, env) {
	const tempFile = resolve(gitDir(), `COMMIT_EDITMSG_${Date.now()}.txt`);
	writeFileSync(tempFile, `${String(message || '').trim()}\n`, 'utf8');
	const result = run('git', ['commit', '-F', tempFile], { env, stdio: 'pipe' });
	try {
		unlinkSync(tempFile);
	} catch {
		/* ignore */
	}
	if (result.status !== 0) {
		console.error(result.stdout);
		console.error(result.stderr);
		fail('Git commit failed.');
	}
}

function commitCommand(args) {
	// 1. Discovery/Inspect (if needed)
	let planId = args.plan;
	let unitId = args.unit;
	let stagedEntries = getStagedDiffEntries();
	let workingEntries = getWorkingTreeDiffEntries();

	// If nothing is staged and we have a working tree, try to auto-resolve
	if (stagedEntries.length === 0 && workingEntries.length > 0) {
		if (!planId) {
			fail('Unified commit requires --plan <id> or a maintenance flag.');
		}
		console.log(`🔍 Inspecting working tree for plan "${planId}"...`);
		const commitPlanning = discoverCommitPlanning({
			repoRootPath: repoRoot(),
			planId: planId,
			diffEntries: workingEntries,
		});

		if (commitPlanning.status !== 'matched_unit') {
			fail(
				`Plan mismatch: ${commitPlanning.status}. Errors: ${commitPlanning.errors?.join(', ') || 'none'}`,
			);
		}

		const recommended = commitPlanning.recommendedUnit;
		if (unitId && recommended.id !== unitId) {
			fail(`Specified unit "${unitId}" does not match inspected unit "${recommended.id}".`);
		}
		unitId = recommended.id;
		console.log(`✅ Matched unit: ${unitId}`);

		// 2. Stage
		console.log(`📦 Staging unit "${unitId}"...`);
		const unitEntries = workingEntries.filter((entry) => recommended.files.includes(entry.path));
		const unitSpecs = pathSpecsForEntries(unitEntries);
		run('git', ['add', '-A', '--', ...unitSpecs], { stdio: 'inherit' });
		stagedEntries = getStagedDiffEntries();
	} else if (stagedEntries.length === 0) {
		fail('Nothing to commit (empty working tree and index).');
	}

	// 3. Commit
	if (args.maintenance) {
		const files = stagedEntries.map((entry) => entry.path);
		const scaffold = buildCommitScaffold({
			maintenance: true,
			message: args.unit, // Re-use unit as message for maintenance mode if provided
			files,
		});

		console.log('✨ Gatekeeper passed (Maintenance Mode Audit-only).');
		console.log('📝 Creating commit...');
		executeCommit(scaffold.fullMessage, {
			...process.env,
		});
		console.log('✅ Commit created successfully (Maintenance).');
		return;
	}

	if (!planId || !unitId) {
		fail('Commit requires a plan and unit (either specified or auto-detected).');
	}

	const { unit } = loadActiveUnit(planId, unitId);
	unit.planId = planId;

	const files = stagedEntries.map((entry) => entry.path);
	const scaffold = buildCommitScaffold({
		id: unitId,
		files,
		commitUnit: unit,
	});

	const validation = validateGeneratedCommitMessage(
		scaffold.fullMessage,
		unit,
		files,
		stagedEntries,
	);

	if (!validation.ok) {
		fail(
			`Generated commit message does not satisfy commitlint:\n${validation.output || 'unknown validation failure'}`,
		);
	}

	if (args.json) {
		console.log(JSON.stringify(scaffold, null, 2));
		return;
	}

	console.log('📝 Creating commit...');
	executeCommit(scaffold.fullMessage, {
		...process.env,
		...validation.env,
	});
	cleanupArtifacts(args);
	console.log('✅ Commit created successfully.');
}

function cleanupCommand(args) {
	cleanupArtifacts(args);
	if (!args.json) console.log('🧹 Cleaned Gatekeeper workflow session artifacts.');
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	switch (args.command) {
		case 'inspect':
			inspectCommand(args);
			return;
		case 'stage':
			stageCommand(args);
			return;
		case 'commit':
			commitCommand(args);
			return;
		case 'cleanup':
			cleanupCommand(args);
			return;
		default:
			fail(`Unknown gatekeeper-workflow command: ${args.command}`);
	}
}

const isMain =
	import.meta.url ===
	`file://${process.platform === 'win32' ? '/' : ''}${process.argv[1]?.replace(/\\/g, '/')}`;

if (isMain) {
	main().catch((error) => {
		fail(error instanceof Error ? error.message : String(error));
	});
}

export {
	buildCommitScaffold,
	cleanupCommand,
	commitCommand,
	inspectCommand,
	parseArgs,
	stageCommand,
	validateGeneratedCommitMessage,
};
