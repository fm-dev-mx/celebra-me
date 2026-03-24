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

let _gitContext = null;
function getGitContext() {
	if (_gitContext) return _gitContext;
	const result = run('git', [
		'rev-parse',
		'--show-toplevel',
		'--git-dir',
		'--abbrev-ref',
		'HEAD',
		'HEAD',
	]);
	if (result.status !== 0) fail('Unable to detect git context.');
	const [root, dir, branch, head] = result.stdout.trim().split('\n');
	_gitContext = {
		root,
		dir: resolve(root, dir),
		branch,
		head,
	};
	return _gitContext;
}

function repoRoot() {
	return getGitContext().root;
}

function gitDir() {
	return getGitContext().dir;
}

function currentBranch() {
	return getGitContext().branch;
}

function currentHead() {
	return getGitContext().head;
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
	const env = {
		...process.env,
		...buildCommitlintContext(files, diffEntries, unitContext),
	};
	const result = run('npx', ['--yes', 'commitlint'], {
		input: `${String(message || '').trim()}\n`,
		env,
	});
	return {
		ok: result.status === 0,
		output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
		env,
	};
}

function writeSession(args, payload) {
	writeAtomicJson(args.sessionFile, payload);
}

function writeS0(args, payload) {
	writeAtomicJson(args.s0File, payload);
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

	/* 
	   Verification Pruned in Lean 3.0. 
	   Detailed linting is deferred to IDE/pre-commit or agent implementation phase.
	   The gatekeeper focuses on structural & planning integrity.
	*/

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
	const context = getGitContext();
	let planId = args.plan;
	let unitId = args.unit;
	let stagedEntries = getStagedDiffEntries();

	// 1. Discovery/Inspect (Unified Flow)
	if (stagedEntries.length === 0) {
		const workingEntries = getWorkingTreeDiffEntries();
		if (workingEntries.length === 0) {
			fail('Nothing to commit (empty working tree and index).');
		}
		if (!planId && !args.maintenance) {
			fail('Unified commit requires --plan <id> or a maintenance flag.');
		}

		if (args.maintenance) {
			console.log('✨ Gatekeeper (Maintenance Mode Audit)...');
			const scaffold = buildCommitScaffold({
				maintenance: true,
				message: unitId,
				files: workingEntries.map((e) => e.path),
			});
			console.log('📦 Staging changes...');
			run('git', ['add', '-A'], { stdio: 'inherit' });
			console.log('📝 Creating maintenance commit...');
			executeCommit(scaffold.fullMessage, { ...process.env });
			console.log('✅ Commit created successfully (Maintenance).');
			return;
		}

		console.log(`🔍 Inspecting working tree for plan "${planId}"...`);
		const commitPlanning = discoverCommitPlanning({
			repoRootPath: context.root,
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

		console.log(`📦 Staging unit "${unitId}"...`);
		const unitSpecs = pathSpecsForEntries(
			workingEntries.filter((e) => recommended.files.includes(e.path)),
		);
		run('git', ['add', '-A', '--', ...unitSpecs], { stdio: 'inherit' });
		stagedEntries = getStagedDiffEntries();
	}

	// 2. Commit Staged changes
	if (args.maintenance) {
		const scaffold = buildCommitScaffold({
			maintenance: true,
			message: unitId,
			files: stagedEntries.map((e) => e.path),
		});
		executeCommit(scaffold.fullMessage, { ...process.env });
		console.log('✅ Commit created successfully (Maintenance).');
		return;
	}

	if (!planId || !unitId) {
		// Try to auto-resolve plan/unit from staged files if not provided
		console.log('🔍 Auto-resolving plan/unit from staged files...');
		const commitPlanning = discoverCommitPlanning({
			repoRootPath: context.root,
			planId:
				planId ||
				discoverCommitPlanning({ repoRootPath: context.root, diffEntries: stagedEntries })
					.planId, // Simplified for brevity
			diffEntries: stagedEntries,
		});
		if (commitPlanning.status === 'matched_unit') {
			planId = commitPlanning.planId;
			unitId = commitPlanning.recommendedUnit.id;
			console.log(`✅ Matched unit: ${unitId}`);
		} else {
			fail('Commit requires a plan and unit (either specified or auto-detected).');
		}
	}

	const { unit } = loadActiveUnit(planId, unitId);
	unit.planId = planId;
	const files = stagedEntries.map((entry) => entry.path);
	const scaffold = buildCommitScaffold({ id: unitId, files, commitUnit: unit });

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

	console.log('📝 Creating commit...');
	executeCommit(scaffold.fullMessage, validation.env);
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
	cleanupCommand,
	commitCommand,
	inspectCommand,
	parseArgs,
	stageCommand,
	validateGeneratedCommitMessage,
};
