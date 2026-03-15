#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { existsSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';

const MAX_ATTEMPTS = 3;
const SESSION_VERSION = 1;
const DEFAULT_SESSION_FILE = '.git/gatekeeper-session.json';
const DEFAULT_S0_FILE = '.git/gatekeeper-s0.txt';
const DEFAULT_S0_SIGNATURE_FILE = '.git/gatekeeper-s0-signature.json';
const DEFAULT_TTL_MINUTES = 30;
const GATEKEEPER_BIN = '.agent/governance/bin/gatekeeper.mjs';

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
		sessionFile: DEFAULT_SESSION_FILE,
		s0File: DEFAULT_S0_FILE,
		s0SignatureFile: DEFAULT_S0_SIGNATURE_FILE,
		ttlMinutes: DEFAULT_TTL_MINUTES,
		noAutoBranch: false,
		json: false,
	};
	for (let i = 1; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === '--domain') args.domain = argv[i + 1] || null;
		if (token === '--session-file') args.sessionFile = argv[i + 1] || args.sessionFile;
		if (token === '--s0-file') args.s0File = argv[i + 1] || args.s0File;
		if (token === '--s0-signature-file')
			args.s0SignatureFile = argv[i + 1] || args.s0SignatureFile;
		if (token === '--ttl-minutes') args.ttlMinutes = Number(argv[i + 1] || DEFAULT_TTL_MINUTES);
		if (token === '--no-auto-branch') args.noAutoBranch = true;
		if (token === '--json') args.json = true;
	}
	return args;
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

function gatekeeperArgs(opts) {
	const {
		checks = 'governance',
		mode = 'quick',
		reportProfile = 'workflow',
		sessionFile,
		sessionInvalidReason,
		s0SignatureFile,
		noAutoBranch,
	} = opts;
	const args = [GATEKEEPER_BIN, '--mode', mode, '--report-json', '--report-profile', reportProfile];
	if (checks) args.push('--checks', checks);
	args.push('--require-complete-report');

	if (checks && checks.split(',').includes('security')) args.push('--secret-scan-staged');
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

function buildSessionPayload(report, args) {
	const splits = report?.adu?.suggestedSplits || [];
	return {
		version: SESSION_VERSION,
		createdAt: new Date().toISOString(),
		repoRoot: repoRoot(),
		branch: currentBranch(),
		head: currentHead(),
		ttlMinutes: args.ttlMinutes,
		reportProfile: 'workflow',
		mode: 'quick',
		staged: report.staged,
		suggestedSplits: splits,
		workflowRoute: report.workflowRoute,
		route: report.route,
		autoFixCommands: report.autoFixCommands || [],
		fullReport: report, // Save full report for fast-path JSON output
	};
}

function sessionAgeMinutes(session) {
	const createdAt = new Date(session.createdAt || 0).getTime();
	if (!createdAt) return Infinity;
	return (Date.now() - createdAt) / 60000;
}

function validateSession(session, args, options = {}) {
	if (!session) return { ok: false, reason: 'session_missing' };
	if (session.invalid) return { ok: false, reason: session.invalidReason || 'session_corrupted' };
	if (session.version !== SESSION_VERSION)
		return { ok: false, reason: 'session_version_mismatch' };
	if (session.repoRoot !== repoRoot()) return { ok: false, reason: 'session_repo_mismatch' };
	if (session.branch !== currentBranch()) return { ok: false, reason: 'session_branch_changed' };
	if (session.head !== currentHead()) return { ok: false, reason: 'session_head_changed' };
	if (sessionAgeMinutes(session) > Number(args.ttlMinutes || DEFAULT_TTL_MINUTES)) {
		return { ok: false, reason: 'session_expired' };
	}
	if (options.skipSignatureCheck) return { ok: true };

	const { report } = runGatekeeper({
		mode: 'quick',
		reportProfile: 'route',
		checks: 'governance,adu',
		sessionFile: args.sessionFile,
		noAutoBranch: args.noAutoBranch,
	});
	if ((report?.staged?.signature || '') !== (session?.staged?.signature || '')) {
		return { ok: false, reason: 'session_signature_changed' };
	}
	return { ok: true };
}

function ensureSplit(session, domain) {
	const split = (session?.suggestedSplits || []).find((entry) => entry.id === domain);
	if (!split) fail(`Domain "${domain}" was not found in the saved session.`);
	return split;
}

function inferCommitType(files) {
	const lowered = files.map((file) => file.toLowerCase());
	if (lowered.every((file) => file.startsWith('docs/') || file.endsWith('.md'))) return 'docs';
	if (lowered.every((file) => file.startsWith('tests/') || file.includes('.test.')))
		return 'test';
	if (lowered.every((file) => file.startsWith('src/styles/') || /\.(scss|css)$/.test(file)))
		return 'style';
	if (lowered.every((file) => file.startsWith('scripts/') || file.startsWith('.agent/')))
		return 'chore';
	return 'feat';
}

function inspectCommand(args) {
	const session = loadSession(args.sessionFile);
	const validation = validateSession(session, args);

	if (validation.ok) {
		if (args.json) {
			console.log(JSON.stringify(session.fullReport || buildSessionPayload(session, args), null, 2));
			return;
		}
		console.log(`🧭 workflowRoute=${session.workflowRoute} route=${session.route} (cached)`);
		console.log(`📦 Suggested splits: ${(session.suggestedSplits || []).length}`);
		console.log(`🗂️ Session file: ${args.sessionFile}`);
		if (session.workflowRoute === 'architectural_intervention') {
			console.log('⛔ Resolve blocking findings, unmapped files, or session drift before committing.');
		}
		return;
	}

	const { report } = runGatekeeper({
		mode: 'quick',
		reportProfile: 'workflow',
		checks: 'governance,lint,typecheck,security,adu',
		sessionFile: args.sessionFile,
		noAutoBranch: args.noAutoBranch,
	});
	if (report?.routeReasons?.includes('empty_staged_set')) {
		cleanupArtifacts(args);
		if (args.json) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		console.log('ℹ️ No staged files detected. Cleaned stale Gatekeeper workflow artifacts.');
		return;
	}
	writeAtomicJson(args.sessionFile, buildSessionPayload(report, args));
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
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		console.log(`\nAttempt ${attempt}/${MAX_ATTEMPTS}`);
		const { report } = runGatekeeper({
			mode: 'quick',
			reportProfile: 'workflow',
			checks: 'governance,lint,security,adu',
			sessionFile: args.sessionFile,
			noAutoBranch: args.noAutoBranch,
		});
		if (report.workflowRoute === 'proceed_adu') {
			writeAtomicJson(args.sessionFile, buildSessionPayload(report, args));
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
		reportProfile: 'workflow',
		checks: 'governance,lint,typecheck,security,adu',
		sessionFile: args.sessionFile,
		noAutoBranch: args.noAutoBranch,
	});
	writeAtomicJson(args.sessionFile, buildSessionPayload(report, args));
	if (report.workflowRoute !== 'proceed_adu') {
		cleanupArtifacts(args);
		fail('Gatekeeper did not converge to proceed_adu after max attempts.');
	}
	console.log('✅ Autofix finished with a final strict verification pass.');
}

function stageCommand(args) {
	if (!args.domain) fail('The stage command requires --domain <id>.');
	const session = loadSession(args.sessionFile);
	const validation = validateSession(session, args);
	if (!validation.ok) {
		cleanupArtifacts(args);
		fail(`Session is invalid (${validation.reason}). Re-run gatekeeper-workflow inspect.`);
	}
	const split = ensureSplit(session, args.domain);
	run('git', ['reset', '-q', 'HEAD', '--', '.'], { stdio: 'inherit' });
	run('git', ['add', '--', ...split.files], { stdio: 'inherit' });
	writeAtomicText(args.s0File, `${split.files.join('\n')}\n`);
	run(
		'node',
		[
			'.agent/governance/bin/gatekeeper.mjs',
			'--write-s0-signature',
			'--s0-file',
			args.s0File,
			'--s0-signature-file',
			args.s0SignatureFile,
			'--no-auto-branch',
		],
		{ stdio: 'inherit' },
	);
	if (args.json) {
		console.log(
			JSON.stringify(
				{
					domain: split.id,
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
	const session = loadSession(args.sessionFile);
	const validation = validateSession(session, args, { skipSignatureCheck: true });
	if (!validation.ok) {
		cleanupArtifacts(args);
		fail(`Session is invalid (${validation.reason}). Re-run gatekeeper-workflow inspect.`);
	}
	const split = ensureSplit(session, args.domain);
	const scaffold = {
		type: inferCommitType(split.files),
		scope: split.id,
		headerTemplate: `${inferCommitType(split.files)}(${split.id}): <imperative technical subject>`,
		headerMaxLength: 72,
		bodyBullets: split.files.map((file) => `- ${file}: <precise technical description>`),
	};
	if (args.json) {
		console.log(JSON.stringify(scaffold, null, 2));
		return;
	}
	console.log(scaffold.headerTemplate);
	console.log('');
	for (const bullet of scaffold.bodyBullets) console.log(bullet);
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
		case 'cleanup':
			cleanupCommand(args);
			return;
		default:
			fail(`Unknown gatekeeper-workflow command: ${args.command}`);
	}
}

main();
