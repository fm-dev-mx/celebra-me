#!/usr/bin/env node

import { spawnSync } from 'child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { loadPolicy } from './gatekeeper.mjs';

const MAX_ATTEMPTS = 3;
const SESSION_VERSION = 2;
const DEFAULT_POLICY_FILE = '.agent/governance/config/policy.json';
const DEFAULT_SESSION_BASENAME = 'gatekeeper-session.json';
const DEFAULT_S0_BASENAME = 'gatekeeper-s0.txt';
const DEFAULT_S0_SIGNATURE_BASENAME = 'gatekeeper-s0-signature.json';
const DEFAULT_TTL_MINUTES = 30;
const GATEKEEPER_BIN = resolve(dirname(fileURLToPath(import.meta.url)), 'gatekeeper.mjs');
const WORKFLOW_REPORT_PROFILE = 'workflow';
const ROUTE_REPORT_PROFILE = 'route';
const BULLET_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 80;
const HEADER_MAX_LENGTH = 72;

function run(cmd, args, options = {}) {
	const isWin = process.platform === 'win32';
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: options.shell ?? isWin,
		stdio: options.stdio ?? 'pipe',
		...options,
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

function parseArgs(argv) {
	const args = {
		command: argv[0] || 'inspect',
		domain: null,
		policyFile: DEFAULT_POLICY_FILE,
		sessionFile: null,
		s0File: null,
		s0SignatureFile: null,
		ttlMinutes: null,
		noAutoBranch: false,
		json: false,
	};
	for (let i = 1; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === '--domain') args.domain = argv[i + 1] || null;
		if (token === '--policy') args.policyFile = argv[i + 1] || args.policyFile;
		if (token === '--session-file') args.sessionFile = argv[i + 1] || args.sessionFile;
		if (token === '--s0-file') args.s0File = argv[i + 1] || args.s0File;
		if (token === '--s0-signature-file')
			args.s0SignatureFile = argv[i + 1] || args.s0SignatureFile;
		if (token === '--ttl-minutes') args.ttlMinutes = Number(argv[i + 1] || DEFAULT_TTL_MINUTES);
		if (token === '--no-auto-branch') args.noAutoBranch = true;
		if (token === '--json') args.json = true;
	}
	return normalizeArtifactPaths(args);
}

function parseReport(raw) {
	const txt = String(raw || '').trim();
	const start = txt.indexOf('{');
	const end = txt.lastIndexOf('}');
	if (start < 0 || end < 0 || end <= start) {
		throw new Error('Gatekeeper report JSON was not found in output.');
	}
	return JSON.parse(txt.slice(start, end + 1));
}

function repoRoot() {
	const result = run('git', ['rev-parse', '--show-toplevel']);
	if (result.status !== 0 || !result.stdout.trim()) fail('Unable to detect repository root.');
	return result.stdout.trim();
}

function currentBranch() {
	const result = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
	if (result.status !== 0 || !result.stdout.trim()) fail('Unable to detect current branch.');
	return result.stdout.trim();
}

function currentHead() {
	const result = run('git', ['rev-parse', 'HEAD']);
	if (result.status !== 0 || !result.stdout.trim()) fail('Unable to detect HEAD SHA.');
	return result.stdout.trim();
}

function gitDir() {
	const result = run('git', ['rev-parse', '--git-dir']);
	if (result.status !== 0 || !result.stdout.trim()) fail('Unable to detect git directory.');
	return resolve(result.stdout.trim());
}

function defaultArtifactPath(basename) {
	return resolve(gitDir(), basename);
}

function normalizeArtifactPaths(args) {
	return {
		...args,
		sessionFile: args.sessionFile || defaultArtifactPath(DEFAULT_SESSION_BASENAME),
		s0File: args.s0File || defaultArtifactPath(DEFAULT_S0_BASENAME),
		s0SignatureFile: args.s0SignatureFile || defaultArtifactPath(DEFAULT_S0_SIGNATURE_BASENAME),
	};
}

function writeAtomicJson(file, payload) {
	const target = resolve(file);
	const parent = dirname(target);
	if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
	const temp = `${target}.tmp`;
	writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
	renameSync(temp, target);
}

function writeAtomicText(file, text) {
	const target = resolve(file);
	const parent = dirname(target);
	if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
	const temp = `${target}.tmp`;
	writeFileSync(temp, text, 'utf8');
	renameSync(temp, target);
}

function loadSession(sessionFile) {
	if (!existsSync(sessionFile)) return null;
	try {
		return JSON.parse(readFileSync(sessionFile, 'utf8'));
	} catch {
		return { invalid: true, invalidReason: 'session_corrupted' };
	}
}

function cleanupArtifacts({ sessionFile, s0File, s0SignatureFile }) {
	for (const file of [sessionFile, s0File, s0SignatureFile]) {
		try {
			if (existsSync(file)) {
				if (file.endsWith('.json')) unlinkSync(file);
				else rmSync(file, { force: true });
			}
		} catch {
			/* ignore cleanup failures */
		}
	}
}

function workflowSettings(policy, args) {
	return {
		ttlMinutes:
			args.ttlMinutes ?? Number(policy.workflow?.session?.ttlMinutes || DEFAULT_TTL_MINUTES),
		autoRefresh: policy.workflow?.session?.autoRefresh !== false,
		preflightChecks: policy.workflow?.inspect?.preflightChecks || ['governance', 'adu'],
		heavyChecks: policy.workflow?.inspect?.heavyChecks || [
			'governance',
			'lint',
			'typecheck',
			'security',
			'adu',
		],
	};
}

function checksCsv(checks) {
	return (checks || []).join(',');
}

function gatekeeperArgs(opts) {
	const {
		checks = ['governance'],
		mode = 'quick',
		reportProfile = WORKFLOW_REPORT_PROFILE,
		policyFile = DEFAULT_POLICY_FILE,
		sessionFile,
		sessionInvalidReason,
		s0SignatureFile,
		noAutoBranch,
	} = opts;
	const checksValue = Array.isArray(checks) ? checksCsv(checks) : checks;
	const args = [
		GATEKEEPER_BIN,
		'--policy',
		policyFile,
		'--mode',
		mode,
		'--report-json',
		'--report-profile',
		reportProfile,
	];
	if (checksValue) args.push('--checks', checksValue);
	args.push('--require-complete-report');

	if (checksValue && checksValue.split(',').includes('security'))
		args.push('--secret-scan-staged');
	if (sessionFile) args.push('--session-file', sessionFile);
	if (sessionInvalidReason) args.push('--session-invalid-reason', sessionInvalidReason);
	if (s0SignatureFile && existsSync(s0SignatureFile))
		args.push('--s0-signature-file', s0SignatureFile);
	if (noAutoBranch) args.push('--no-auto-branch');
	return args;
}

function runGatekeeper(options) {
	const result = run('node', gatekeeperArgs(options));
	return {
		status: result.status,
		report: parseReport(result.stdout),
		stderr: result.stderr.trim(),
	};
}

function sessionAgeMinutes(session) {
	const refreshedAt = new Date(session?.refreshedAt || session?.createdAt || 0).getTime();
	if (!refreshedAt) return Infinity;
	return (Date.now() - refreshedAt) / 60000;
}

function structuralSessionValidation(session, args, settings) {
	if (!session) return { ok: false, reason: 'session_missing' };
	if (session.invalid) return { ok: false, reason: session.invalidReason || 'session_corrupted' };
	if (session.version !== SESSION_VERSION)
		return { ok: false, reason: 'session_version_mismatch' };
	if (session.repoRoot !== repoRoot()) return { ok: false, reason: 'session_repo_mismatch' };
	if (session.branch !== currentBranch()) return { ok: false, reason: 'session_branch_changed' };
	if (session.head !== currentHead()) return { ok: false, reason: 'session_head_changed' };
	if (sessionAgeMinutes(session) > Number(settings.ttlMinutes || DEFAULT_TTL_MINUTES)) {
		if (settings.autoRefresh) return { ok: true, stale: true };
		return { ok: false, reason: 'session_expired' };
	}
	return { ok: true, stale: false };
}

function buildSessionPayload(report, args, settings, options = {}) {
	const now = new Date().toISOString();
	const splits = report?.adu?.suggestedSplits || [];
	return {
		version: SESSION_VERSION,
		createdAt: options.createdAt || now,
		refreshedAt: now,
		repoRoot: repoRoot(),
		branch: currentBranch(),
		head: currentHead(),
		ttlMinutes: settings.ttlMinutes,
		reportProfile: WORKFLOW_REPORT_PROFILE,
		mode: options.mode || 'quick',
		staged: report.staged,
		inspectionCacheKey:
			options.inspectionCacheKey || report?.staged?.detailedSignature?.signature || '',
		effectiveChecks: options.effectiveChecks || checksCsv(settings.heavyChecks),
		preflightReport: options.preflightReport || null,
		suggestedSplits: splits,
		workflowRoute: report.workflowRoute,
		route: report.route,
		autoFixCommands: report.autoFixCommands || [],
		fullReport: report,
	};
}

function refreshSessionFile(session, args, settings, options = {}) {
	const refreshed = {
		...session,
		refreshedAt: new Date().toISOString(),
		ttlMinutes: settings.ttlMinutes,
		repoRoot: repoRoot(),
		branch: currentBranch(),
		head: currentHead(),
		preflightReport: options.preflightReport ?? session.preflightReport ?? null,
	};
	writeAtomicJson(args.sessionFile, refreshed);
	return refreshed;
}

function reportCacheKey(report) {
	return report?.staged?.detailedSignature?.signature || '';
}

function matchingSessionReport(session, preflightReport, effectiveChecks) {
	if (!session?.fullReport) return false;
	return (
		session.effectiveChecks === effectiveChecks &&
		session.inspectionCacheKey === reportCacheKey(preflightReport)
	);
}

function ensureSplit(session, domain) {
	const split = (session?.suggestedSplits || []).find((entry) => entry.id === domain);
	if (!split) fail(`Domain "${domain}" was not found in the saved session.`);
	return split;
}

function inferCommitType(files) {
	const lowered = files.map((file) => file.toLowerCase());
	if (
		lowered.every(
			(file) =>
				file.startsWith('docs/') ||
				file.startsWith('.agent/plans/') ||
				file.endsWith('.md') ||
				file.endsWith('.mdx') ||
				file.endsWith('manifest.json'),
		)
	) {
		return 'docs';
	}
	if (lowered.every((file) => file.startsWith('tests/') || file.includes('.test.')))
		return 'test';
	if (lowered.every((file) => file.startsWith('src/styles/') || /\.(scss|css)$/.test(file)))
		return 'style';
	if (lowered.every((file) => file.startsWith('scripts/') || file.startsWith('.agent/')))
		return 'chore';
	return 'feat';
}

function truncateText(value, maxLength) {
	const text = String(value || '')
		.trim()
		.replace(/\s+/g, ' ');
	if (text.length <= maxLength) return text;
	if (maxLength <= 3) return text.slice(0, maxLength);
	return `${text.slice(0, maxLength - 3).trim()}...`;
}

function stemOf(file) {
	const name = (file.split('/').pop() || file).replace(/\.[^.]+$/, '');
	return name
		.replace(/[^a-zA-Z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function normalizeStem(value) {
	return String(value || '')
		.replace(/[^a-zA-Z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function commonPathPrefix(files) {
	if (!files.length) return '';
	const segments = files.map((file) => file.split('/'));
	const prefix = [];
	for (let index = 0; index < segments[0].length; index += 1) {
		const candidate = segments[0][index];
		if (!segments.every((parts) => parts[index] === candidate)) break;
		prefix.push(candidate);
	}
	return prefix.join('/');
}

function scaffoldTarget(split) {
	const prefix = commonPathPrefix(split.files || []);
	const fallback = split.baseDomain || split.id || 'change';
	const target = prefix.split('/').filter(Boolean).pop() || fallback;
	return normalizeStem(target).replace(/-/g, ' ');
}

function fileDescription(file) {
	const stem = stemOf(file).toLowerCase();
	const normalizedStem = stem.replace(/-/g, ' ');
	if (file.endsWith('README.md')) return 'describe plan status and overview';
	if (file.endsWith('CHANGELOG.md')) return 'track milestones and decisions';
	if (/\/phases\/\d{2}-/.test(file)) return 'define phase scope and deliverables';
	if (file.endsWith('manifest.json')) return 'define plan metadata and phases';
	if (file.endsWith('.json')) return `set ${normalizedStem || 'json'} configuration`;
	if (file.endsWith('.md')) return `document ${normalizedStem || 'documentation'} notes`;
	if (file.endsWith('.mjs')) return `implement ${normalizedStem || 'script'} logic`;
	if (file.endsWith('.sh')) return 'configure hook execution';
	return `update ${normalizedStem || 'file'} configuration`;
}

function headerSubject(scope, split) {
	const commitType = inferCommitType(split.files);
	const baseDomain = split.baseDomain || scope;
	const target = truncateText(scaffoldTarget(split), 18);
	const candidates = [];
	if (baseDomain.startsWith('gov-plans-archive')) {
		candidates.push(`archive ${target} plan files`);
	}
	if (baseDomain.startsWith('gov-plans-')) {
		candidates.push(`create ${target} plan documentation`);
	}
	if (commitType === 'test') {
		candidates.push(`add ${target} test coverage`);
	}
	if (commitType === 'style') {
		candidates.push(`update ${target} styles`);
	}
	if (baseDomain.startsWith('gov-tooling')) {
		candidates.push(`update ${target} tooling`);
	}
	if (baseDomain.startsWith('gov-infra')) {
		candidates.push(`update ${target} infrastructure`);
	}
	candidates.push(`update ${target} files`);
	return (
		candidates
			.map((value) => value.replace(/\s+/g, ' ').trim())
			.find((value) => `${commitType}(${scope}): ${value}`.length <= HEADER_MAX_LENGTH) ||
		'update scoped files'
	);
}

function buildCommitScaffold(split) {
	const commitType = inferCommitType(split.files);
	const scope = split.id;
	const header = `${commitType}(${scope}): ${headerSubject(scope, split)}`;
	const body = split.files.map((file) => {
		let description = truncateText(fileDescription(file), DESCRIPTION_MAX_LENGTH);
		const bulletPrefix = `- ${file}: `;
		const maxDescriptionLength = Math.max(10, BULLET_MAX_LENGTH - bulletPrefix.length);
		if (description.length > maxDescriptionLength) {
			description = truncateText(description, maxDescriptionLength);
		}
		const bullet = `${bulletPrefix}${description}`;
		if (bullet.length <= BULLET_MAX_LENGTH) return bullet;
		const overshoot = bullet.length - BULLET_MAX_LENGTH;
		return `${bulletPrefix}${truncateText(description, Math.max(10, description.length - overshoot))}`;
	});
	return {
		type: commitType,
		scope,
		header,
		body,
		fullMessage: `${header}\n\n${body.join('\n')}`,
	};
}

function stagedFilesFromIndex() {
	const result = run('git', ['diff', '--cached', '--name-only', '-z', '--diff-filter=d']);
	if (result.status !== 0) fail('Unable to read staged files.');
	return String(result.stdout || '')
		.split('\0')
		.map((value) => value.trim())
		.filter(Boolean);
}

function signS0(args) {
	run(
		'node',
		[
			GATEKEEPER_BIN,
			'--policy',
			args.policyFile,
			'--write-s0-signature',
			'--s0-file',
			args.s0File,
			'--s0-signature-file',
			args.s0SignatureFile,
			'--no-auto-branch',
		],
		{ stdio: 'inherit' },
	);
}

function validateSessionAgainstCurrentIndex(session, args, settings, preflightReport) {
	const validation = structuralSessionValidation(session, args, settings);
	if (!validation.ok) return validation;
	const expected =
		session?.staged?.detailedSignature?.signature || session?.inspectionCacheKey || '';
	const current = reportCacheKey(preflightReport);
	if (expected !== current) return { ok: false, reason: 'session_signature_changed' };
	return validation;
}

function inspectCommand(args) {
	const policy = loadPolicy(args.policyFile);
	const settings = workflowSettings(policy, args);
	const session = loadSession(args.sessionFile);
	const effectiveChecks = checksCsv(settings.heavyChecks);
	const preflight = runGatekeeper({
		mode: 'quick',
		reportProfile: WORKFLOW_REPORT_PROFILE,
		checks: settings.preflightChecks,
		policyFile: args.policyFile,
		sessionFile: args.sessionFile,
		noAutoBranch: args.noAutoBranch,
	});
	const preflightReport = preflight.report;
	if (preflightReport?.routeReasons?.includes('empty_staged_set')) {
		cleanupArtifacts(args);
		if (args.json) {
			console.log(JSON.stringify(preflightReport, null, 2));
			return;
		}
		console.log('ℹ️ No staged files detected. Cleaned stale Gatekeeper workflow artifacts.');
		return;
	}

	const validation = structuralSessionValidation(session, args, settings);
	if (validation.ok && matchingSessionReport(session, preflightReport, effectiveChecks)) {
		refreshSessionFile(session, args, settings, { preflightReport });
		if (args.json) {
			console.log(JSON.stringify(session.fullReport, null, 2));
			return;
		}
		console.log(`🧭 workflowRoute=${session.workflowRoute} route=${session.route} (cached)`);
		console.log(`📦 Suggested splits: ${(session.suggestedSplits || []).length}`);
		console.log(`🗂️ Session file: ${args.sessionFile}`);
		if (session.workflowRoute === 'architectural_intervention') {
			console.log(
				'⛔ Resolve blocking findings, unmapped files, or session drift before committing.',
			);
		}
		return;
	}

	const { report } = runGatekeeper({
		mode: 'quick',
		reportProfile: WORKFLOW_REPORT_PROFILE,
		checks: settings.heavyChecks,
		policyFile: args.policyFile,
		sessionFile: args.sessionFile,
		noAutoBranch: args.noAutoBranch,
	});
	writeAtomicJson(
		args.sessionFile,
		buildSessionPayload(report, args, settings, {
			createdAt: session?.createdAt,
			effectiveChecks,
			inspectionCacheKey: reportCacheKey(preflightReport),
			preflightReport,
		}),
	);
	if (args.json) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}
	console.log(`🧭 workflowRoute=${report.workflowRoute} route=${report.route}`);
	console.log(`📦 Suggested splits: ${(report.adu?.suggestedSplits || []).length}`);
	console.log(`🗂️ Session file: ${args.sessionFile}`);
	if (report.workflowRoute === 'architectural_intervention') {
		console.log(
			'⛔ Resolve blocking findings, unmapped files, or session drift before committing.',
		);
	}
}

function autofixCommand(args) {
	const policy = loadPolicy(args.policyFile);
	const settings = workflowSettings(policy, args);
	const autoFixChecks = settings.heavyChecks.filter((check) => check !== 'typecheck');
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		console.log(`\nAttempt ${attempt}/${MAX_ATTEMPTS}`);
		const { report } = runGatekeeper({
			mode: 'quick',
			reportProfile: WORKFLOW_REPORT_PROFILE,
			checks: autoFixChecks,
			policyFile: args.policyFile,
			sessionFile: args.sessionFile,
			noAutoBranch: args.noAutoBranch,
		});
		if (report.workflowRoute === 'proceed_adu') {
			writeAtomicJson(
				args.sessionFile,
				buildSessionPayload(report, args, settings, {
					inspectionCacheKey: reportCacheKey(report),
					effectiveChecks: checksCsv(autoFixChecks),
				}),
			);
			console.log('✅ Gatekeeper autofix path converged. Run inspect or stage a domain.');
			return;
		}
		const fixCommands = report.autoFixCommands || [];
		if (!fixCommands.length) {
			cleanupArtifacts(args);
			fail(
				`Gatekeeper workflow route is "${report.workflowRoute}" and no auto-fix commands are available.`,
			);
		}
		let allFixesOk = true;
		for (const command of fixCommands) {
			console.log(`🛠️ Running auto-fix: ${command}`);
			const parts = command.split(' ').filter(Boolean);
			const result = run(parts[0], parts.slice(1), { stdio: 'inherit' });
			if (result.status !== 0) allFixesOk = false;
		}
		if (!allFixesOk) {
			cleanupArtifacts(args);
			fail('One or more auto-fix commands failed.');
		}
	}

	const { report } = runGatekeeper({
		mode: 'strict',
		reportProfile: WORKFLOW_REPORT_PROFILE,
		checks: settings.heavyChecks,
		policyFile: args.policyFile,
		sessionFile: args.sessionFile,
		noAutoBranch: args.noAutoBranch,
	});
	writeAtomicJson(
		args.sessionFile,
		buildSessionPayload(report, args, settings, {
			inspectionCacheKey: reportCacheKey(report),
			effectiveChecks: checksCsv(settings.heavyChecks),
		}),
	);
	if (report.workflowRoute !== 'proceed_adu') {
		cleanupArtifacts(args);
		fail('Gatekeeper did not converge to proceed_adu after max attempts.');
	}
	console.log('✅ Autofix finished with a final strict verification pass.');
}

function stageCommand(args) {
	if (!args.domain) fail('The stage command requires --domain <id>.');
	const policy = loadPolicy(args.policyFile);
	const settings = workflowSettings(policy, args);
	const session = loadSession(args.sessionFile);
	const preflight = runGatekeeper({
		mode: 'quick',
		reportProfile: ROUTE_REPORT_PROFILE,
		checks: settings.preflightChecks,
		policyFile: args.policyFile,
		sessionFile: args.sessionFile,
		noAutoBranch: args.noAutoBranch,
	});
	const validation = validateSessionAgainstCurrentIndex(
		session,
		args,
		settings,
		preflight.report,
	);
	if (!validation.ok) {
		cleanupArtifacts(args);
		fail(`Session is invalid (${validation.reason}). Re-run gatekeeper-workflow inspect.`);
	}
	refreshSessionFile(session, args, settings, {
		preflightReport: session?.preflightReport || null,
	});
	const split = ensureSplit(session, args.domain);
	run('git', ['reset', '-q', 'HEAD', '--', '.'], { stdio: 'inherit' });
	run('git', ['add', '--', ...split.files], { stdio: 'inherit' });
	writeAtomicText(args.s0File, `${split.files.join('\n')}\n`);
	signS0(args);
	if (args.json) {
		console.log(
			JSON.stringify(
				{
					domain: split.id,
					baseDomain: split.baseDomain || split.id,
					files: split.files,
					s0File: args.s0File,
					s0SignatureFile: args.s0SignatureFile,
				},
				null,
				2,
			),
		);
		return;
	}
	console.log(`✅ Staged domain "${split.id}" with ${split.files.length} file(s).`);
	console.log(`📄 S0 file: ${args.s0File}`);
	console.log(`🔐 S0 signature: ${args.s0SignatureFile}`);
}

function scaffoldCommand(args) {
	if (!args.domain) fail('The scaffold command requires --domain <id>.');
	const policy = loadPolicy(args.policyFile);
	const settings = workflowSettings(policy, args);
	const session = loadSession(args.sessionFile);
	const validation = structuralSessionValidation(session, args, settings);
	if (!validation.ok) {
		cleanupArtifacts(args);
		fail(`Session is invalid (${validation.reason}). Re-run gatekeeper-workflow inspect.`);
	}
	refreshSessionFile(session, args, settings, {
		preflightReport: session?.preflightReport || null,
	});
	const split = ensureSplit(session, args.domain);
	const scaffold = buildCommitScaffold(split);
	if (args.json) {
		console.log(JSON.stringify(scaffold, null, 2));
		return;
	}

	console.log('📝 Commit message generated:');
	console.log(scaffold.fullMessage);
	console.log('\n🔄 Executing git commit...');
	const tempFile = `.git/COMMIT_EDITMSG_${Date.now()}`;
	writeFileSync(tempFile, scaffold.fullMessage, 'utf8');
	const result = run('git', ['commit', '-F', tempFile]);
	try {
		unlinkSync(tempFile);
	} catch {
		/* ignore temp cleanup errors */
	}
	if (result.status !== 0) {
		console.error(result.stderr);
		fail('Git commit failed. Check the message format.');
	}
	console.log('✅ Commit created successfully.');
}

function syncS0Command(args) {
	if (!existsSync(args.s0File)) fail(`S0 file not found: ${args.s0File}`);
	const originalFiles = readFileSync(args.s0File, 'utf8')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));
	const currentFiles = stagedFilesFromIndex().sort((a, b) => a.localeCompare(b));
	if (originalFiles.length !== currentFiles.length) {
		fail('Current staged set no longer matches the original S0 scope.');
	}
	for (let i = 0; i < originalFiles.length; i += 1) {
		if (originalFiles[i] !== currentFiles[i]) {
			fail('Current staged set no longer matches the original S0 scope.');
		}
	}
	signS0(args);
	if (!args.json) {
		console.log(`🔐 Refreshed S0 signature: ${args.s0SignatureFile}`);
	}
}

function cleanupCommand(args) {
	cleanupArtifacts(args);
	if (!args.json) console.log('🧹 Cleaned Gatekeeper workflow session artifacts.');
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	switch (args.command) {
		case 'inspect':
			inspectCommand(args);
			return;
		case 'autofix':
			autofixCommand(args);
			return;
		case 'stage':
			stageCommand(args);
			return;
		case 'scaffold':
			scaffoldCommand(args);
			return;
		case 'sync-s0':
			syncS0Command(args);
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
	main();
}

export {
	autofixCommand,
	buildCommitScaffold,
	cleanupCommand,
	fileDescription,
	inspectCommand,
	parseArgs,
	runGatekeeper,
	scaffoldCommand,
	sessionAgeMinutes,
	stageCommand,
	structuralSessionValidation,
	syncS0Command,
	workflowSettings,
};
