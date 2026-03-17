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
import {
	buildDeterministicSubject,
	buildFileBulletDescription,
	collectFileFacts,
	normalizePath,
	rankDominantChange,
	validateSubjectFragment,
} from './commit-message-analysis.mjs';
import {
	hasAiTitleConfig,
	requestAiTitleAssist,
	shouldUseAiTitleAssist,
} from './ai-title-assist.mjs';
import { buildCommitlintContext } from '../../../scripts/validate-commits.mjs';

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
		commit: false,
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
		if (token === '--commit') args.commit = true;
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
		preflightCommand: resolvePreflightCommand(policy),
		aiTitle: policy.workflow?.commit?.aiTitle || {},
	};
}

function packageScripts(repoRootPath) {
	try {
		const pkg = JSON.parse(readFileSync(resolve(repoRootPath, 'package.json'), 'utf8'));
		return pkg?.scripts || {};
	} catch {
		return {};
	}
}

function resolveRunnablePnpmCommand(command, repoScripts) {
	const trimmed = String(command || '').trim();
	if (!trimmed) return null;
	if (!trimmed.startsWith('pnpm ')) return trimmed;
	const scriptName = trimmed.slice(5);
	return repoScripts[scriptName] ? trimmed : null;
}

function resolvePreflightCommand(policy) {
	const configured = String(policy.workflow?.inspect?.preflightCommand || '').trim();
	const repoScripts = packageScripts(repoRoot());
	const configuredCommand = resolveRunnablePnpmCommand(configured, repoScripts);
	if (configuredCommand) return configuredCommand;

	for (const command of policy.workflow?.inspect?.preflightFallbacks || []) {
		const resolvedCommand = resolveRunnablePnpmCommand(command, repoScripts);
		if (resolvedCommand) return resolvedCommand;
	}
	if (repoScripts.ci) return 'pnpm ci';
	if (repoScripts['turbo-all']) return 'pnpm turbo-all';
	return 'pnpm lint && pnpm type-check && pnpm test';
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

function groupedReasons(report) {
	return {
		unmappedFiles: report?.adu?.unmappedFiles || [],
		blockingFindings: report?.blockingFindings || [],
		s0Drift: report?.s0Drift?.hasDrift ? report.s0Drift : null,
		sessionInvalidReason: report?.session?.invalidReason || null,
	};
}

function inferredPlanDomain(file) {
	const normalized = normalizePath(file);
	const match = normalized.match(/^\.agent\/plans\/([^/]+)\//);
	if (!match) return null;
	return `gov-plans-${match[1]}`;
}

function printArchitecturalInterventionGuidance(report, settings) {
	const reasons = groupedReasons(report);
	console.log('⛔ Architectural intervention required before staging or committing.');
	console.log(`🔎 Recommended pre-flight: ${settings.preflightCommand}`);
	if (reasons.unmappedFiles.length) {
		console.log('• Unmapped files:');
		for (const file of reasons.unmappedFiles) {
			console.log(`  - ${file}`);
		}
		const suggested = inferredPlanDomain(reasons.unmappedFiles[0]);
		if (suggested) {
			console.log(
				`  Action: add domain "${suggested}" to .agent/governance/config/domain-map.json and re-run inspect.`,
			);
		} else {
			console.log(
				'  Action: add a matching domain entry in .agent/governance/config/domain-map.json and re-run inspect.',
			);
		}
	}
	if (reasons.blockingFindings.length) {
		console.log('• Blocking findings:');
		for (const finding of reasons.blockingFindings.slice(0, 5)) {
			console.log(
				`  - ${finding.ruleId || finding.id || 'finding'}: ${finding.message || 'resolve the reported issue'}`,
			);
		}
		console.log(
			'  Action: resolve the blocking findings, stage intentionally, and re-run inspect.',
		);
	}
	if (reasons.s0Drift) {
		console.log('• S0 drift:');
		console.log('  Action: run cleanup, restage the intended split, and restart the workflow.');
	}
	if (reasons.sessionInvalidReason) {
		console.log('• Session state:');
		console.log(
			`  Action: session invalid because ${reasons.sessionInvalidReason}; run cleanup and re-run inspect.`,
		);
	}
}

function truncateText(value, maxLength, options = {}) {
	const text = String(value || '')
		.trim()
		.replace(/\s+/g, ' ');
	if (text.length <= maxLength) return text;
	if (options.noEllipsis) return text.slice(0, maxLength);
	if (maxLength <= 3) return text.slice(0, maxLength);
	return `${text.slice(0, maxLength - 3).trim()}...`;
}

function inferDominantFileCluster(files, diffEntries = []) {
	const fileFacts = collectFileFacts(files, diffEntries);
	const dominantChange = rankDominantChange(fileFacts, { fallbackTarget: 'change set' });
	return {
		kind: dominantChange.kind,
		target: dominantChange.target,
		confidence: dominantChange.confidence,
	};
}

function describeFileChange(file, splitContext = {}) {
	const diffEntries = splitContext.diffEntries || [];
	const fileFacts = collectFileFacts([file], diffEntries);
	return buildFileBulletDescription(fileFacts[0], {
		dominantChange: splitContext.dominantChange || splitContext.dominantCluster || null,
		repoRootPath: splitContext.repoRootPath || repoRoot(),
	});
}

function formatBulletLine(filePath, description) {
	const bulletPrefix = `- ${filePath}: `;
	const remainingLength = BULLET_MAX_LENGTH - bulletPrefix.length;
	if (remainingLength < 20) {
		throw new Error(
			`Path "${filePath}" leaves too little room for a specific body description within ${BULLET_MAX_LENGTH} characters.`,
		);
	}
	if (bulletPrefix.length + description.length > BULLET_MAX_LENGTH) {
		return `${bulletPrefix}${truncateText(description, remainingLength)}`;
	}
	return `${bulletPrefix}${description}`;
}

function getNumstatForPath(filePath) {
	const result = run('git', ['diff', '--cached', '--numstat', '--', filePath]);
	if (result.status !== 0) return { additions: 0, deletions: 0 };
	const line = String(result.stdout || '')
		.split(/\r?\n/)
		.map((entry) => entry.trim())
		.find(Boolean);
	if (!line) return { additions: 0, deletions: 0 };
	const [additions, deletions] = line.split('\t');
	const parseCount = (value) => (value === '-' ? 0 : Number(value || 0));
	return {
		additions: parseCount(additions),
		deletions: parseCount(deletions),
	};
}

function getStagedDiffEntries() {
	const result = run('git', ['diff', '--cached', '--name-status', '--find-renames']);
	if (result.status !== 0) fail('Unable to read staged diff entries.');
	return String(result.stdout || '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const parts = line.split('\t').filter(Boolean);
			const rawStatus = parts[0] || 'M';
			const status = rawStatus.startsWith('R') ? 'R' : rawStatus[0];
			const oldPath = status === 'R' ? normalizePath(parts[1] || '') : '';
			const path = normalizePath(parts[status === 'R' ? 2 : 1] || parts[parts.length - 1]);
			const stats = getNumstatForPath(path || oldPath);
			return {
				path,
				oldPath,
				status,
				area: collectFileFacts([path || oldPath])[0]?.area || 'source',
				additions: stats.additions,
				deletions: stats.deletions,
			};
		});
}

function buildCommitScaffold(split, options = {}) {
	const repoRootPath = options.repoRootPath || repoRoot();
	const diffEntries = options.diffEntries || [];
	const fileFacts = collectFileFacts(split.files, diffEntries);
	const dominantChange = rankDominantChange(fileFacts, {
		fallbackTarget: split.baseDomain || split.id || 'change set',
	});
	const deterministic = buildDeterministicSubject({
		scope: split.id,
		fileFacts,
		dominantChange,
	});
	const body = fileFacts.map((fact) =>
		formatBulletLine(
			fact.path,
			buildFileBulletDescription(fact, {
				dominantChange,
				repoRootPath,
			}),
		),
	);
	return {
		type: deterministic.type,
		scope: split.id,
		subject: deterministic.subject,
		baseSubject: deterministic.subject,
		finalSubject: deterministic.subject,
		header: deterministic.header,
		headerLength: deterministic.header.length,
		body,
		fullMessage: `${deterministic.header}\n\n${body.join('\n')}`,
		titleSource: 'deterministic',
		titleConfidence: deterministic.confidence,
		meaningfulAreaCount: dominantChange.meaningfulAreaCount,
		dominantChange,
		fileFacts,
	};
}

function getDiffSnippet(filePath, maxChars) {
	const result = run('git', ['diff', '--cached', '--unified=0', '--no-color', '--', filePath]);
	if (result.status !== 0) return '';
	return truncateText(String(result.stdout || '').trim(), maxChars, { noEllipsis: false });
}

function buildAiTitlePayload(scaffold, policy, diffEntries) {
	const aiConfig = policy?.workflow?.commit?.aiTitle || {};
	const maxFiles = Number(aiConfig.maxFiles || 12);
	const maxSnippetChars = Number(aiConfig.maxSnippetChars || 400);
	const rankedPaths = (scaffold.dominantChange?.fileScores || [])
		.slice()
		.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
		.map((entry) => entry.path);
	const snippetPaths = rankedPaths.slice(0, 3);
	return {
		type: scaffold.type,
		scope: scaffold.scope,
		baseSubject: scaffold.baseSubject,
		dominantChange: scaffold.dominantChange,
		files: scaffold.fileFacts.slice(0, maxFiles).map((fact) => ({
			path: fact.path,
			oldPath: fact.oldPath || undefined,
			status: fact.status,
			area: fact.area,
			additions: fact.additions,
			deletions: fact.deletions,
			description: buildFileBulletDescription(fact, {
				dominantChange: scaffold.dominantChange,
				repoRootPath: repoRoot(),
			}),
		})),
		diffEntries,
		diffSnippets: snippetPaths
			.map((path) => ({
				path,
				snippet: getDiffSnippet(path, maxSnippetChars),
			}))
			.filter((entry) => entry.snippet),
		constraints: {
			language: 'English',
			maxHeaderLength: HEADER_MAX_LENGTH,
			format: 'verb target',
			strongVerbRequired: true,
			concreteTargetRequired: true,
			noProcessLanguage: true,
		},
	};
}

async function resolveCommitScaffold(split, options = {}) {
	const repoRootPath = options.repoRootPath || repoRoot();
	const diffEntries =
		options.diffEntries ||
		getStagedDiffEntries().filter((entry) =>
			split.files.map(normalizePath).includes(entry.path),
		);
	const deterministicScaffold = buildCommitScaffold(split, {
		repoRootPath,
		diffEntries,
	});
	const policy = options.policy || loadPolicy(options.policyFile || DEFAULT_POLICY_FILE);
	if (
		!hasAiTitleConfig(policy, options.env || process.env) ||
		!shouldUseAiTitleAssist(policy, {
			confidence: deterministicScaffold.titleConfidence,
			meaningfulAreaCount: deterministicScaffold.meaningfulAreaCount,
		})
	) {
		return { scaffold: deterministicScaffold, deterministicScaffold };
	}

	const env = options.env || process.env;
	const aiPayload = buildAiTitlePayload(deterministicScaffold, policy, diffEntries);
	const controller = new AbortController();
	const timeoutMs = Number(policy?.workflow?.commit?.aiTitle?.timeoutMs || 4000);
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const aiResult = await requestAiTitleAssist(aiPayload, {
			fetchImpl: options.fetchImpl,
			endpoint: env.GATEKEEPER_AI_TITLE_ENDPOINT,
			model: env.GATEKEEPER_AI_TITLE_MODEL,
			apiKey: env.GATEKEEPER_AI_TITLE_API_KEY,
			signal: controller.signal,
		});
		const validation = validateSubjectFragment(aiResult.subject, {
			type: deterministicScaffold.type,
			scope: deterministicScaffold.scope,
			maxHeaderLength: HEADER_MAX_LENGTH,
		});
		if (!validation.ok) {
			return { scaffold: deterministicScaffold, deterministicScaffold };
		}
		const header = `${deterministicScaffold.type}(${deterministicScaffold.scope}): ${validation.subject}`;
		return {
			scaffold: {
				...deterministicScaffold,
				header,
				headerLength: header.length,
				fullMessage: `${header}\n\n${deterministicScaffold.body.join('\n')}`,
				titleSource: 'ai-assisted',
				finalSubject: validation.subject,
				aiTitleConfidence: aiResult.confidence,
				aiTitleRationale: aiResult.rationale,
			},
			deterministicScaffold,
		};
	} catch {
		return { scaffold: deterministicScaffold, deterministicScaffold };
	} finally {
		clearTimeout(timeout);
	}
}

function validateGeneratedCommitMessage(message, split, diffEntries = null) {
	const files = split.files.map(normalizePath);
	const commitDiffEntries = (diffEntries || getStagedDiffEntries()).filter((entry) =>
		files.includes(entry.path),
	);
	const result = run('npx', ['commitlint'], {
		input: `${message.trim()}\n`,
		env: {
			...process.env,
			...buildCommitlintContext(files, commitDiffEntries),
		},
	});
	return {
		ok: result.status === 0,
		output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
	};
}

function stagedFilesFromIndex() {
	const result = run('git', ['diff', '--cached', '--name-only', '-z']);
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
			printArchitecturalInterventionGuidance(session.fullReport || preflightReport, settings);
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
		printArchitecturalInterventionGuidance(report, settings);
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
	if (session.workflowRoute !== 'proceed_adu') {
		fail(
			`Session workflowRoute is "${session.workflowRoute}". Resolve the workflow blockers and re-run inspect before staging.`,
		);
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

async function scaffoldCommand(args) {
	if (!args.domain) fail('The scaffold command requires --domain <id>.');
	const policy = loadPolicy(args.policyFile);
	const settings = workflowSettings(policy, args);
	const session = loadSession(args.sessionFile);
	const validation = structuralSessionValidation(session, args, settings);
	if (!validation.ok) {
		cleanupArtifacts(args);
		fail(`Session is invalid (${validation.reason}). Re-run gatekeeper-workflow inspect.`);
	}
	if (session.workflowRoute !== 'proceed_adu') {
		fail(
			`Session workflowRoute is "${session.workflowRoute}". Resolve the workflow blockers and re-run inspect before scaffolding.`,
		);
	}
	refreshSessionFile(session, args, settings, {
		preflightReport: session?.preflightReport || null,
	});
	const split = ensureSplit(session, args.domain);
	const diffEntries = getStagedDiffEntries().filter((entry) =>
		split.files.map(normalizePath).includes(entry.path),
	);
	const resolved = await resolveCommitScaffold(split, {
		policy,
		repoRootPath: repoRoot(),
		diffEntries,
	});
	let scaffold = resolved.scaffold;
	let validationResult = validateGeneratedCommitMessage(scaffold.fullMessage, split, diffEntries);
	if (!validationResult.ok && scaffold.titleSource === 'ai-assisted') {
		scaffold = resolved.deterministicScaffold;
		validationResult = validateGeneratedCommitMessage(scaffold.fullMessage, split, diffEntries);
	}
	if (!validationResult.ok) {
		fail(
			`Generated scaffold does not satisfy commitlint:\n${validationResult.output || 'unknown validation failure'}`,
		);
	}
	if (args.json) {
		console.log(JSON.stringify(scaffold, null, 2));
		return;
	}

	console.log('📝 Commit message generated:');
	console.log(scaffold.fullMessage);
	if (args.commit) {
		console.log(
			'\n⚠️ --commit is deprecated; use "gatekeeper-workflow commit --domain <id>" instead.',
		);
		executeCommit(scaffold.fullMessage);
	}
}

function executeCommit(message) {
	console.log('\n🔄 Executing git commit...');
	const tempFile = `.git/COMMIT_EDITMSG_${Date.now()}`;
	writeFileSync(tempFile, message, 'utf8');
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

async function commitCommand(args) {
	if (!args.domain) fail('The commit command requires --domain <id>.');
	const policy = loadPolicy(args.policyFile);
	const settings = workflowSettings(policy, args);
	const session = loadSession(args.sessionFile);
	const validation = structuralSessionValidation(session, args, settings);
	if (!validation.ok) {
		cleanupArtifacts(args);
		fail(`Session is invalid (${validation.reason}). Re-run gatekeeper-workflow inspect.`);
	}
	if (session.workflowRoute !== 'proceed_adu') {
		fail(
			`Session workflowRoute is "${session.workflowRoute}". Resolve the workflow blockers and re-run inspect before committing.`,
		);
	}
	const split = ensureSplit(session, args.domain);
	const diffEntries = getStagedDiffEntries().filter((entry) =>
		split.files.map(normalizePath).includes(entry.path),
	);
	const resolved = await resolveCommitScaffold(split, {
		policy,
		repoRootPath: repoRoot(),
		diffEntries,
	});
	let scaffold = resolved.scaffold;
	let validationResult = validateGeneratedCommitMessage(scaffold.fullMessage, split, diffEntries);
	if (!validationResult.ok && scaffold.titleSource === 'ai-assisted') {
		scaffold = resolved.deterministicScaffold;
		validationResult = validateGeneratedCommitMessage(scaffold.fullMessage, split, diffEntries);
	}
	if (!validationResult.ok) {
		fail(
			`Generated commit message does not satisfy commitlint:\n${validationResult.output || 'unknown validation failure'}`,
		);
	}
	if (args.json) {
		console.log(JSON.stringify(scaffold, null, 2));
		return;
	}
	console.log('📝 Commit message validated:');
	console.log(scaffold.fullMessage);
	executeCommit(scaffold.fullMessage);
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

async function main() {
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
			await scaffoldCommand(args);
			return;
		case 'commit':
			await commitCommand(args);
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
	main().catch((error) => {
		fail(error instanceof Error ? error.message : String(error));
	});
}

export {
	autofixCommand,
	buildCommitScaffold,
	cleanupCommand,
	describeFileChange as fileDescription,
	inspectCommand,
	parseArgs,
	printArchitecturalInterventionGuidance,
	resolveCommitScaffold,
	resolvePreflightCommand,
	runGatekeeper,
	scaffoldCommand,
	commitCommand,
	resolveRunnablePnpmCommand,
	describeFileChange,
	inferDominantFileCluster,
	validateGeneratedCommitMessage,
	sessionAgeMinutes,
	stageCommand,
	structuralSessionValidation,
	syncS0Command,
	workflowSettings,
};
