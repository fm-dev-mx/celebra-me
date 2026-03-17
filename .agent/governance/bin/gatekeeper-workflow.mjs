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

function normalizePath(value) {
	return String(value || '')
		.replace(/\\/g, '/')
		.trim();
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

function inferDominantFileCluster(files) {
	const normalized = files.map(normalizePath);
	if (!normalized.length) return { kind: 'generic', target: 'change set' };
	if (normalized.some((file) => file.startsWith('src/lib/presenters/'))) {
		if (normalized.some((file) => file.startsWith('src/pages/'))) {
			return { kind: 'presenter-route', target: 'invitation presenter-driven route' };
		}
		return { kind: 'presenter', target: 'invitation page presenter' };
	}
	if (
		normalized.some((file) => file.startsWith('src/components/invitation/')) &&
		normalized.some((file) => file.startsWith('src/pages/[eventType]/'))
	) {
		return { kind: 'invitation-route', target: 'invitation route rendering' };
	}
	if (normalized.every((file) => file.startsWith('.agent/plans/'))) {
		return { kind: 'plan', target: 'plan status and validation notes' };
	}
	if (normalized.every((file) => file.startsWith('tests/'))) {
		return { kind: 'test', target: 'workflow coverage' };
	}
	if (normalized.every((file) => file.startsWith('docs/'))) {
		return { kind: 'docs', target: 'governance guidance' };
	}
	return { kind: 'generic', target: scaffoldTarget({ files }) || 'change set' };
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

function describeFileChange(file, splitContext = {}) {
	const stem = stemOf(file).toLowerCase();
	const normalizedStem = stem.replace(/-/g, ' ');
	const dominantCluster = splitContext.dominantCluster?.kind || 'generic';

	if (file.startsWith('src/lib/presenters/') && file.endsWith('.ts')) {
		return 'assemble invitation props from content and context';
	}
	if (file.startsWith('src/pages/') && file.endsWith('.astro')) {
		return dominantCluster === 'presenter-route'
			? 'reduce the route to guest loading and presenter rendering'
			: 'reduce the route to data loading and presenter rendering';
	}
	if (file.startsWith('src/components/invitation/') && file.endsWith('.astro')) {
		return 'extract invitation section rendering into a dedicated component';
	}
	if (file.startsWith('tests/unit/') && file.includes('invitation.presenter.test')) {
		return 'cover presenter outputs with fixture-based tests';
	}
	if (file.endsWith('/manifest.json') && file.startsWith('.agent/plans/')) {
		return 'update plan status, blockers, and phase metadata';
	}
	if (file.endsWith('/CHANGELOG.md') && file.startsWith('.agent/plans/')) {
		return 'log delivered work, validation runs, and remaining blockers';
	}
	if (/^\.agent\/plans\/.+\/phases\/\d{2}-/.test(file)) {
		return 'document delivered scope, validation, and unresolved blockers';
	}
	if (file.endsWith('/README.md') && file.startsWith('.agent/plans/')) {
		return 'mark the plan status and summarize verified implementation progress';
	}
	if (file === 'docs/core/architecture.md') {
		return 'define presenters as the BFF assembly layer for complex routes';
	}
	if (file === 'docs/core/project-conventions.md') {
		return 'document the presenters folder convention and route-facing usage guidance';
	}

	if (file.includes('/schemas/')) return `add ${normalizedStem} schema definition`;
	if (file.includes('config.ts') && file.includes('/content/'))
		return 'simplify to import from modular schemas';
	if (file.includes('/adapters/')) return 'update adapter for schema changes';

	// Keyword-based fallback for quality
	try {
		const content = readFileSync(resolve(repoRoot(), file), 'utf8');
		if (content.includes('z.object')) return `define ${normalizedStem} validation schema`;
		if (content.includes('export const')) return `implement ${normalizedStem} constants`;
		if (content.includes('<script')) return `add interactive logic to ${normalizedStem}`;
		if (content.includes('interface ') || content.includes('type '))
			return `define ${normalizedStem} type contracts`;
	} catch {
		/* ignore read failures for new/deleted files */
	}

	if (file.endsWith('README.md')) return 'describe plan status and overview';
	if (file.endsWith('CHANGELOG.md')) return 'track milestones and decisions';
	if (/\/phases\/\d{2}-/.test(file)) return 'define phase scope and deliverables';
	if (file.endsWith('manifest.json')) return 'define plan metadata and phases';
	if (file.endsWith('.json')) return `harden ${normalizedStem || 'json'} implementation`;
	if (file.endsWith('.md')) return `document ${normalizedStem || 'documentation'} notes`;
	if (file.endsWith('.mjs')) return `implement ${normalizedStem || 'script'} logic`;
	if (file.endsWith('.sh')) return 'configure hook execution';
	if (file.endsWith('.schema.ts')) return `add ${normalizedStem} schema`;
	return `align ${normalizedStem || 'file'} implementation`;
}

function headerSubject(scope, split) {
	const commitType = inferCommitType(split.files);
	const baseDomain = split.baseDomain || scope;
	const dominantCluster = inferDominantFileCluster(split.files);
	const target = dominantCluster.target || scaffoldTarget(split);
	const candidates = [];

	if (baseDomain.startsWith('gov-plans-archive'))
		candidates.push('archive hardening fixture plan files');
	if (dominantCluster.kind === 'presenter-route') {
		candidates.push(`implement ${target}`);
		candidates.push('refactor invitation route rendering');
	}
	if (dominantCluster.kind === 'presenter') {
		candidates.push(`implement ${target}`);
	}
	if (dominantCluster.kind === 'invitation-route') {
		candidates.push(`refactor ${target}`);
	}
	if (dominantCluster.kind === 'plan') {
		candidates.push('define plan validation gates');
		candidates.push('clarify plan blockers and next steps');
	}
	if (dominantCluster.kind === 'docs') {
		candidates.push(`clarify ${target}`);
	}
	if (dominantCluster.kind === 'test') {
		candidates.push(`add ${target}`);
	}
	if (baseDomain === 'gov-agent-config') candidates.push('harden gatekeeper workflow guards');
	if (baseDomain === 'gov-workflows') candidates.push(`harden ${target} workflow`);
	if (baseDomain.startsWith('gov-tooling')) candidates.push(`refine ${target}`);
	if (baseDomain === 'core' && split.files.some((f) => f.includes('/schemas/'))) {
		candidates.push(`extract ${truncateText(scaffoldTarget(split), 24)} into modular schemas`);
	}
	candidates.push(`align ${truncateText(scaffoldTarget(split), 24)} implementation`);
	return (
		candidates
			.map((value) => value.replace(/\s+/g, ' ').trim())
			.find((value) => `${commitType}(${scope}): ${value}`.length <= HEADER_MAX_LENGTH) ||
		'refine scoped change set'
	);
}

function buildCommitScaffold(split) {
	const commitType = inferCommitType(split.files);
	const scope = split.id;
	const dominantCluster = inferDominantFileCluster(split.files);
	const header = `${commitType}(${scope}): ${headerSubject(scope, split)}`;
	const body = split.files.map((file) => {
		const description = describeFileChange(file, { split, dominantCluster });
		const bulletPrefix = `- ${file}: `;
		// Never truncate path (bulletPrefix). If line is too long, truncate description.
		const remainingLength = BULLET_MAX_LENGTH - bulletPrefix.length;

		if (remainingLength < 10) {
			// Path itself is almost 100 chars, nothing we can do but keep the path and hope for the best/warn
			return `${bulletPrefix}${truncateText(description, 10)}`;
		}

		if (bulletPrefix.length + description.length > BULLET_MAX_LENGTH) {
			return `${bulletPrefix}${truncateText(description, remainingLength)}`;
		}
		return `${bulletPrefix}${description}`;
	});
	return {
		type: commitType,
		scope,
		header,
		headerLength: header.length,
		body,
		fullMessage: `${header}\n\n${body.join('\n')}`,
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
			const path = normalizePath(parts[parts.length - 1]);
			const area =
				path.startsWith('docs/') || path.endsWith('.md') || path.endsWith('.mdx')
					? 'docs'
					: path.startsWith('tests/') ||
						  path.includes('.test.') ||
						  path.includes('.spec.')
						? 'test'
						: path.startsWith('src/assets/')
							? 'asset'
							: path.startsWith('scripts/') || path.startsWith('.agent/')
								? 'script'
								: path.endsWith('.json') || path.endsWith('.cjs')
									? 'config'
									: 'source';
			return { path, status, area };
		});
}

function validateGeneratedCommitMessage(message, split) {
	const files = split.files.map(normalizePath);
	const diffEntries = getStagedDiffEntries().filter((entry) => files.includes(entry.path));
	const result = run('npx', ['commitlint'], {
		input: `${message.trim()}\n`,
		env: {
			...process.env,
			...buildCommitlintContext(files, diffEntries),
		},
	});
	return {
		ok: result.status === 0,
		output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
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
	if (session.workflowRoute !== 'proceed_adu') {
		fail(
			`Session workflowRoute is "${session.workflowRoute}". Resolve the workflow blockers and re-run inspect before scaffolding.`,
		);
	}
	refreshSessionFile(session, args, settings, {
		preflightReport: session?.preflightReport || null,
	});
	const split = ensureSplit(session, args.domain);
	const scaffold = buildCommitScaffold(split);
	if (!args.json) {
		const validationResult = validateGeneratedCommitMessage(scaffold.fullMessage, split);
		if (!validationResult.ok) {
			fail(
				`Generated scaffold does not satisfy commitlint:\n${validationResult.output || 'unknown validation failure'}`,
			);
		}
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

function commitCommand(args) {
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
	const scaffold = buildCommitScaffold(split);
	const validationResult = validateGeneratedCommitMessage(scaffold.fullMessage, split);
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
		case 'commit':
			commitCommand(args);
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
	describeFileChange as fileDescription,
	inspectCommand,
	parseArgs,
	printArchitecturalInterventionGuidance,
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
