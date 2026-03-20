#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
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

import {
	buildFileBulletDescription,
	collectFileFacts,
	normalizePath,
} from './commit-message-analysis.mjs';
import {
	buildPlannedHeader,
	buildPlannedSubject,
	discoverCommitPlanning,
	loadValidatedCommitPlan,
	resolveCommitUnit,
} from './commit-plan.mjs';
import { buildCommitlintContext } from '../../../scripts/validate-commits.mjs';

const SESSION_VERSION = 4;
const DEFAULT_POLICY_FILE = '.agent/governance/config/policy.json';
const DEFAULT_SESSION_BASENAME = 'gatekeeper-session.json';
const DEFAULT_S0_BASENAME = 'gatekeeper-s0.json';
const HEADER_MAX_LENGTH = 130;
const BULLET_MAX_LENGTH = 140;

function run(cmd, args, options = {}) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: options.shell ?? isWin,
		stdio: options.stdio ?? 'pipe',
		env: options.env || process.env,
		cwd: options.cwd || process.cwd(),
		input: options.input,
	});
	if (result.error) throw result.error;
	return {
		status: result.status ?? 1,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
	};
}

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
		policyFile: DEFAULT_POLICY_FILE,
		sessionFile: null,
		s0File: null,
		json: false,
		dryRun: false,
	};
	for (let index = 1; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === '--plan') args.plan = argv[index + 1] || null;
		if (token === '--unit') args.unit = argv[index + 1] || null;
		if (token === '--policy') args.policyFile = argv[index + 1] || args.policyFile;
		if (token === '--session-file') args.sessionFile = argv[index + 1] || args.sessionFile;
		if (token === '--s0-file') args.s0File = argv[index + 1] || args.s0File;
		if (token === '--json') args.json = true;
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

function normalizeDiffEntries(entries = []) {
	return entries
		.map((entry) => ({
			path: normalizePath(entry.path),
			oldPath: normalizePath(entry.oldPath || ''),
			status: String(entry.status || 'M').toUpperCase(),
			area: String(entry.area || '').trim() || undefined,
		}))
		.filter((entry) => entry.path)
		.sort((left, right) => left.path.localeCompare(right.path));
}

function parseNameStatusZ(raw) {
	const tokens = String(raw || '')
		.split('\0')
		.filter(Boolean);
	const entries = [];
	for (let index = 0; index < tokens.length; ) {
		const rawStatus = tokens[index++] || 'M';
		const status = rawStatus.startsWith('R') ? 'R' : rawStatus[0];
		if (status === 'R') {
			const oldPath = normalizePath(tokens[index++] || '');
			const path = normalizePath(tokens[index++] || '');
			if (path) entries.push({ path, oldPath, status });
			continue;
		}
		const path = normalizePath(tokens[index++] || '');
		if (path) entries.push({ path, oldPath: '', status });
	}
	return entries;
}

function getTrackedWorkingTreeEntries() {
	const hasHead = run('git', ['rev-parse', '--verify', 'HEAD']).status === 0;
	if (!hasHead) return [];
	const result = run('git', [
		'diff',
		'--name-status',
		'--find-renames',
		'--diff-filter=ACDMR',
		'-z',
		'HEAD',
	]);
	if (result.status !== 0) fail('Unable to read working tree diff.');
	return parseNameStatusZ(result.stdout);
}

function getUntrackedEntries() {
	const result = run('git', ['ls-files', '--others', '--exclude-standard', '-z']);
	if (result.status !== 0) fail('Unable to read untracked files.');
	return String(result.stdout || '')
		.split('\0')
		.map((entry) => normalizePath(entry))
		.filter(Boolean)
		.map((path) => ({ path, oldPath: '', status: 'A' }));
}

function enrichEntries(entries) {
	const facts = collectFileFacts(
		entries.map((entry) => entry.path),
		entries,
	);
	const factsByPath = new Map(facts.map((fact) => [fact.path, fact]));
	return entries.map((entry) => ({
		...entry,
		area: factsByPath.get(entry.path)?.area || 'source',
	}));
}

function dedupeEntries(entries) {
	const byPath = new Map();
	for (const entry of entries) byPath.set(entry.path, entry);
	return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

function getWorkingTreeDiffEntries() {
	const tracked = getTrackedWorkingTreeEntries();
	const untracked = getUntrackedEntries();
	return normalizeDiffEntries(enrichEntries(dedupeEntries([...tracked, ...untracked])));
}

function getStagedDiffEntries() {
	const result = run('git', [
		'diff',
		'--cached',
		'--name-status',
		'--find-renames',
		'--diff-filter=ACDMR',
		'-z',
	]);
	if (result.status !== 0) fail('Unable to read staged diff entries.');
	return normalizeDiffEntries(enrichEntries(parseNameStatusZ(result.stdout)));
}

function signatureForEntries(entries) {
	return createHash('sha256')
		.update(
			JSON.stringify(
				(entries || []).map((entry) => ({
					path: entry.path,
					oldPath: entry.oldPath || '',
					status: entry.status,
				})),
			),
		)
		.digest('hex');
}

function resolveRunnablePnpmCommand(command, repoScripts) {
	const trimmed = String(command || '').trim();
	if (!trimmed) return null;
	if (!trimmed.startsWith('pnpm ')) return trimmed;
	const scriptName = trimmed.slice(5);
	return repoScripts[scriptName] ? trimmed : null;
}

function packageScripts(repoRootPath) {
	try {
		const pkg = JSON.parse(readFileSync(resolve(repoRootPath, 'package.json'), 'utf8'));
		return pkg?.scripts || {};
	} catch {
		return {};
	}
}

function resolvePreflightCommand(policy) {
	const repoScripts = packageScripts(repoRoot());
	const configured = String(policy.workflow?.inspect?.preflightCommand || '').trim();
	const configuredCommand = resolveRunnablePnpmCommand(configured, repoScripts);
	if (configuredCommand) return configuredCommand;
	for (const fallback of policy.workflow?.inspect?.preflightFallbacks || []) {
		const resolved = resolveRunnablePnpmCommand(fallback, repoScripts);
		if (resolved) return resolved;
	}
	if (repoScripts.ci) return 'pnpm ci';
	if (repoScripts['turbo-all']) return 'pnpm turbo-all';
	return 'pnpm lint && pnpm type-check && pnpm test';
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
	if (session.version !== SESSION_VERSION)
		return { ok: false, reason: 'session_version_mismatch' };
	if (session.repoRoot !== repoRoot()) return { ok: false, reason: 'session_repo_mismatch' };
	if (session.branch !== currentBranch()) return { ok: false, reason: 'session_branch_changed' };
	if (session.head !== currentHead()) return { ok: false, reason: 'session_head_changed' };
	if (args.plan && session.planId !== args.plan)
		return { ok: false, reason: 'session_plan_mismatch' };
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

function formatBulletLine(filePath, description) {
	const prefix = `- ${filePath}: `;
	const remaining = BULLET_MAX_LENGTH - prefix.length;
	if (remaining < 20) {
		throw new Error(`Path "${filePath}" is too long for the commit body line limit.`);
	}
	const normalizedDescription = String(description || '')
		.trim()
		.replace(/\s+/g, ' ');
	const safeDescription =
		prefix.length + normalizedDescription.length > BULLET_MAX_LENGTH
			? normalizedDescription.slice(0, remaining).trim()
			: normalizedDescription;
	return `${prefix}${safeDescription}`;
}

function buildCommitScaffold(split, options = {}) {
	const diffEntries = normalizeDiffEntries(options.diffEntries || []);
	const files = [...(split.files || [])]
		.map(normalizePath)
		.sort((left, right) => left.localeCompare(right));
	if (!split.commitUnit) throw new Error('Planned commit scaffold requires commitUnit.');
	const fileFacts = collectFileFacts(files, diffEntries);
	const subject = buildPlannedSubject(split.commitUnit);
	const canonicalHeader = buildPlannedHeader(split.commitUnit);
	const plannedHeader = String(split.commitUnit.messagePreview?.header || '').trim();
	if (plannedHeader && plannedHeader !== canonicalHeader) {
		throw new Error(
			`Commit unit "${split.commitUnit.id}" defines a non-canonical messagePreview.header. Expected "${canonicalHeader}".`,
		);
	}
	const header = plannedHeader || canonicalHeader;
	if (header.length > HEADER_MAX_LENGTH) {
		throw new Error(
			`Commit header exceeds ${HEADER_MAX_LENGTH} characters for unit "${split.commitUnit.id}".`,
		);
	}
	const body = fileFacts.map((fact) =>
		formatBulletLine(
			fact.path,
			buildFileBulletDescription(fact, {
				purpose: split.commitUnit.purpose,
			}),
		),
	);
	const trailers = [`Plan-Id: ${split.commitUnit.planId}`, `Commit-Unit: ${split.commitUnit.id}`];
	return {
		type: split.commitUnit.type,
		scope: split.commitUnit.domain,
		subject,
		header,
		headerLength: header.length,
		body,
		trailers,
		titleSource: 'planned',
		fullMessage: `${header}\n\n${body.join('\n')}\n\n${trailers.join('\n')}`,
	};
}

function validateGeneratedCommitMessage(message, unit, files, diffEntries) {
	const unitContext = buildCommitlintUnitContext(unit, files);
	const result = run('npx', ['commitlint'], {
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
	const sessionValidation = validateSession(session, args);
	if (!sessionValidation.ok) {
		cleanupArtifacts(args);
		fail(`Session is invalid (${sessionValidation.reason}). Re-run inspect.`);
	}
	const s0 = loadS0(args);
	if (!s0) fail('S0 artifact not found. Re-run stage for the selected unit.');
	if (s0.planId !== session.planId || s0.unitId !== args.unit) {
		fail('S0 artifact does not match the selected plan/unit. Re-run stage.');
	}
	const stagedEntries = getStagedDiffEntries();
	const stagedSignature = signatureForEntries(stagedEntries);
	if (stagedSignature !== s0.stagedSignature) {
		fail('Staged set drift detected. Run cleanup, inspect, and stage again.');
	}
	assertExactFiles(s0.files || [], stagedEntries, 'Staged set');
	const { unit } = loadActiveUnit(session.planId, args.unit);
	unit.planId = session.planId;
	if (s0.unitHash !== unit.hash) {
		fail('Commit unit definition changed after staging. Re-run inspect and stage again.');
	}
	return { session, s0, unit, stagedEntries };
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
			JSON.stringify(
				{
					workflowRoute:
						commitPlanning.status === 'matched_unit'
							? 'proceed_commit_unit'
							: 'blocked',
					routeReasons: commitPlanning.errors || [],
					changeSetSignature: payload.changeSetSignature,
					diffEntries,
					commitPlanning,
				},
				null,
				2,
			),
		);
		return;
	}
	console.log(`🧭 commitPlanning=${commitPlanning.status}`);
	console.log(`🗂️ Changed files: ${diffEntries.length}`);
	console.log(`📄 Session file: ${args.sessionFile}`);
	if (commitPlanning.recommendedUnit) {
		console.log(`🗺️ Selected unit: ${commitPlanning.recommendedUnit.id}`);
	}
	if (commitPlanning.errors?.length) {
		for (const error of commitPlanning.errors) console.log(`- ${error}`);
	}
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
	const sessionAgeMinutes = (Date.now() - new Date(session.createdAt).getTime()) / 60000;
	if (sessionAgeMinutes > 5) {
		console.log(
			`⚠️  Session is ${Math.round(sessionAgeMinutes)} minutes old. Working tree may have drifted.`,
		);
	}
	const matchedUnit = ensureSelectedUnit(session, args);
	const unitEntries = currentEntries.filter((entry) => matchedUnit.files.includes(entry.path));
	const stagedSpecs = pathSpecsForEntries(getStagedDiffEntries());
	if (stagedSpecs.length) {
		run('git', ['reset', '-q', 'HEAD', '--', ...stagedSpecs], { stdio: 'inherit' });
	}
	const unitSpecs = pathSpecsForEntries(unitEntries);
	if (!unitSpecs.length) fail(`Commit unit "${args.unit}" did not resolve any stageable files.`);
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
	const scaffold = buildCommitScaffold(
		{
			id: unit.id,
			files,
			commitUnit: unit,
		},
		{ diffEntries: stagedEntries },
	);
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
	if (!args.unit) fail('The commit command requires --unit <id>.');
	const { session, unit, stagedEntries } = loadCommitContext(args);
	unit.planId = session.planId;
	const files = stagedEntries.map((entry) => entry.path);
	const scaffold = buildCommitScaffold(
		{
			id: unit.id,
			files,
			commitUnit: unit,
		},
		{ diffEntries: stagedEntries },
	);
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
	executeCommit(scaffold.fullMessage, {
		...process.env,
		...validation.env,
	});
	cleanupArtifacts(args);
	console.log('✅ Commit created successfully.');
}

function syncS0Command(args) {
	const s0 = loadS0(args);
	if (!s0) fail(`S0 file not found: ${args.s0File}`);
	const stagedEntries = getStagedDiffEntries();
	assertExactFiles(s0.files || [], stagedEntries, 'S0');
	writeS0(args, {
		...s0,
		stagedSignature: signatureForEntries(stagedEntries),
	});
	if (!args.json) console.log(`🔐 Refreshed S0 signature in ${args.s0File}`);
}

function cleanupCommand(args) {
	cleanupArtifacts(args);
	if (!args.json) console.log('🧹 Cleaned Gatekeeper workflow session artifacts.');
}

function autofixCommand() {
	fail('Autofix was removed from the pure plan-aware Gatekeeper workflow.');
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
		case 'scaffold':
			scaffoldCommand(args);
			return;
		case 'commit':
			commitCommand(args);
			return;
		case 'sync-s0':
			syncS0Command(args);
			return;
		case 'cleanup':
			cleanupCommand(args);
			return;
		case 'autofix':
			autofixCommand();
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
	resolvePreflightCommand,
	resolveRunnablePnpmCommand,
	scaffoldCommand,
	stageCommand,
	syncS0Command,
	validateGeneratedCommitMessage,
};
