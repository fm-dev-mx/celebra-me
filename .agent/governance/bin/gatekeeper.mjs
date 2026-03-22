/* eslint-disable */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const COLORS = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	bold: '\x1b[1m',
};
const DEFAULT_POLICY_PATH = '.agent/governance/config/policy.json';
const DEFAULT_BASELINE_PATH = '.agent/governance/config/baseline.json';
const DEFAULT_MAX_FINDINGS = 20;
const PROTECTED_BRANCHES = new Set(['main', 'develop']);
const DEFAULT_ATOMICITY_LIMIT = 12;
const require = createRequire(import.meta.url);
let typescriptApi = null;
let typescriptLoadAttempted = false;

const FORBIDDEN_FILES = [
	/\.log$/,
	/\.env$/,
	/\.env\.local$/,
	/\.DS_Store$/,
	/\.tmp$/,
	/diff\.txt$/,
	/staged\.diff$/,
	/(^|\/)dist\//,
	/(^|\/)coverage\//,
	/(^|\/)\.vercel\//,
	/(^|\/)\.astro\//,
	/(^|\/)logs\//,
];

const BLOCK_ALL = { 1: 'block', 2: 'block', 3: 'block' };
const WARN_BLOCK_BLOCK = { 1: 'warn', 2: 'block', 3: 'block' };

const DEFAULT_POLICY = {
	killSwitch: false,
	maxFindings: DEFAULT_MAX_FINDINGS,
	phaseDefaults: { defaultPhase: 1 },
	legacyAliases: { minimal: 'quick' },
	docsEvidence: {
		requireRealDiff: true,
		minChangedLines: 3,
		minChangedChars: 40,
		requireUpdateToken: false,
		acceptedUpdateTokens: ['Last Updated', 'Changelog'],
		tokenMatchMode: 'any',
	},
	atomicity: {
		defaultLimit: DEFAULT_ATOMICITY_LIMIT,
		autoBucketOversizedDomains: true,
	},
	workflow: {
		session: {
			ttlMinutes: 30,
			autoRefresh: true,
		},
		inspect: {
			preflightChecks: ['governance', 'adu'],
			heavyChecks: ['governance', 'lint', 'typecheck', 'security', 'adu'],
			typecheckSkipPatterns: ['.agent/plans/**/*.md', '.agent/plans/**/*.json'],
		},
	},
	s0Drift: {
		ignorePatterns: ['.agent/plans/**/*.md', '.agent/plans/**/*.json'],
	},
	rules: {
		forbiddenFiles: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: BLOCK_ALL,
		},
		caseCollision: {
			enabled: true,
			killSwitch: false,
			maxFindings: 10,
			severityByPhase: BLOCK_ALL,
		},
		publicAssetImport: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: BLOCK_ALL,
		},
		newAnyAdded: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: BLOCK_ALL,
		},
		serverClientBoundary: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: WARN_BLOCK_BLOCK,
			appliesTo: ['src/components/**', 'src/pages/**/*.astro', 'src/pages/**/*.tsx'],
			exemptions: ['src/pages/api/**', 'src/pages/admin/**'],
		},
		themePresetIsolation: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: WARN_BLOCK_BLOCK,
			appliesTo: ['src/styles/themes/presets/**/*.scss'],
		},
		themeSectionVariantIsolation: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: WARN_BLOCK_BLOCK,
			appliesTo: ['src/styles/themes/sections/**/*.scss'],
		},
		inlineStylePolicy: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: BLOCK_ALL,
			appliesTo: ['src/**/*.astro', 'src/**/*.tsx'],
			exemptions: ['src/pages/admin/**', 'src/components/common/Icon.astro'],
		},
		inlineScriptPolicy: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: BLOCK_ALL,
			appliesTo: ['src/**/*.astro'],
			allowlist: [
				'src/pages/[eventType]/[slug].astro',
				'src/components/common/HeaderBase.astro',
				'src/components/invitation/Footer.astro',
				'src/pages/admin/rsvp.astro',
			],
		},
		documentationMappings: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: WARN_BLOCK_BLOCK,
		},
		seoAudit: {
			enabled: true,
			killSwitch: false,
			maxFindings: 10,
			severityByPhase: { 1: 'warn', 2: 'warn', 3: 'block' },
			appliesTo: ['src/pages/[eventType]/**'],
		},
		themeGovernance: {
			enabled: true,
			killSwitch: false,
			maxFindings: 10,
			severityByPhase: WARN_BLOCK_BLOCK,
		},
		godObjectGuard: {
			enabled: true,
			killSwitch: false,
			maxFindings: 10,
			severityByPhase: BLOCK_ALL,
			appliesTo: ['src/**/*.{ts,tsx,astro,js,jsx}'],
			maxFileLines: 400,
			maxExportCount: 20,
			maxFunctionParams: 6,
		},
		couplingGuard: {
			enabled: true,
			killSwitch: false,
			maxFindings: 10,
			severityByPhase: BLOCK_ALL,
			appliesTo: ['src/**/*.{ts,tsx,astro,js,jsx}'],
			maxImportsPerFile: 30,
		},
		duplicationGuard: {
			enabled: true,
			killSwitch: false,
			maxFindings: 10,
			severityByPhase: BLOCK_ALL,
			minFingerprintLength: 40,
			maxOccurrences: 10,
		},
		obsoleteGovernanceGuard: {
			enabled: true,
			killSwitch: false,
			maxFindings: 10,
			severityByPhase: BLOCK_ALL,
			requiredPaths: [
				'.agent/governance/config/policy.json',
				'.agent/governance/config/baseline.json',
				'.agent/governance/bin/gatekeeper.mjs',
				'commitlint.config.cjs',
			],
		},
		languageGovernance: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: BLOCK_ALL,
			englishPaths: ['docs/**/*.md', 'src/**/*.{ts,tsx,astro,mjs,jsx}', 'scripts/**/*.mjs'],
			spanishUiPaths: ['src/content/events/**/*.json'],
		},
	},
	docMappings: [
		{
			id: 'theme-system-sync',
			triggers: [
				'src/content/config.ts',
				'src/content/events/**',
				'src/lib/adapters/**',
				'src/styles/themes/**',
				'src/components/invitation/**',
			],
			requiredAll: ['docs/domains/theme/architecture.md'],
		},
		{
			id: 'rsvp-architecture-sync',
			triggers: [
				'src/lib/rsvp/**',
				'src/pages/api/auth/**',
				'src/pages/api/dashboard/**',
				'src/pages/api/invitacion/**',
				'src/middleware.ts',
			],
			requiredAny: ['docs/domains/rsvp/architecture.md', 'docs/domains/rsvp/status.md'],
		},
		{
			id: 'workflow-status-sync',
			triggers: ['.agent/workflows/**'],
			requiredAll: ['docs/DOC_STATUS.md'],
		},
	],
	architectureBoundaries: {
		clientForbiddenImports: [
			'@api/',
			'src/pages/api/',
			'@backend/',
			'@services/',
			'@controllers/',
			'@repositories/',
			'@middlewares/',
			'@models/',
			'@db/',
			'nodemailer',
			'node:fs',
			'fs',
			'node:path',
			'path',
		],
	},
	autoBranching: {
		enabled: true,
		protectedBranches: ['main', 'develop'],
	},
};

const DOMAIN_MAP_PATH = '.agent/governance/config/domain-map.json';

class DomainMapper {
	constructor(policy = DEFAULT_POLICY) {
		this.config = loadJson(DOMAIN_MAP_PATH, { domains: {}, defaultDomain: 'core' });
		this.policy = policy;
	}

	matchDomain(file) {
		for (const [domain, patterns] of Object.entries(this.config.domains)) {
			if (matchAny(file, patterns)) return { domain, matched: true };
		}
		return { domain: this.config.defaultDomain || 'core', matched: false };
	}

	analyze(files) {
		const groups = {};
		const unmappedFiles = [];
		const atomicityLimit = Number(
			this.policy.atomicity?.defaultLimit || DEFAULT_ATOMICITY_LIMIT,
		);
		const autoBucket = this.policy.atomicity?.autoBucketOversizedDomains !== false;
		for (const f of files) {
			const mapped = this.matchDomain(f);
			const d = mapped.domain;
			if (!mapped.matched) unmappedFiles.push(f);
			if (!groups[d]) groups[d] = [];
			groups[d].push(f);
		}
		const suggestedSplits = [];
		for (const [id, domainFiles] of Object.entries(groups).sort(([a], [b]) =>
			a.localeCompare(b),
		)) {
			const sortedFiles = domainFiles.slice().sort((a, b) => a.localeCompare(b));
			const bucketCount =
				autoBucket && sortedFiles.length > atomicityLimit
					? Math.ceil(sortedFiles.length / atomicityLimit)
					: 1;
			for (let index = 0; index < bucketCount; index += 1) {
				const bucketFiles = sortedFiles.slice(
					index * atomicityLimit,
					(index + 1) * atomicityLimit,
				);
				suggestedSplits.push({
					id: bucketCount === 1 ? id : `${id}-${index + 1}`,
					baseDomain: id,
					bucketIndex: index + 1,
					bucketCount,
					autoBucketed: bucketCount > 1,
					files: bucketFiles,
				});
			}
		}
		const fileCount = files.length || 1;
		const splitConfidence = Number(((fileCount - unmappedFiles.length) / fileCount).toFixed(2));
		return {
			suggestedSplits,
			unmappedFiles: unmappedFiles.sort((a, b) => a.localeCompare(b)),
			splitConfidence,
			atomicityLimit,
			atomicityPassed: suggestedSplits.every((s) => s.files.length <= atomicityLimit),
		};
	}
}

function log(m, c = COLORS.reset) {
	console.log(`${c}${m}${COLORS.reset}`);
}
function fail(m) {
	console.error(`${COLORS.red}${COLORS.bold}❌ ERROR: ${m}${COLORS.reset}`);
	process.exit(1);
}
const np = (v) =>
	String(v || '')
		.replace(/\\/g, '/')
		.trim();
const uniq = (arr) => Array.from(new Set(arr));

function run(cmd, args = [], opts = {}) {
	for (const token of [cmd, ...(args || [])]) {
		if (/[\0\r\n]/.test(String(token || ''))) {
			throw new Error(`Unsafe command token detected: ${String(token)}`);
		}
	}
	const isWin = process.platform === 'win32';
	const r = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: opts.shell ?? isWin,
		stdio: opts.stdio ?? 'pipe',
	});
	if (r.error) throw r.error;
	if (typeof r.status === 'number' && r.status !== 0 && !opts.ignoreError) {
		const out = [r.stdout, r.stderr].filter(Boolean).join('\n').trim();
		throw new Error(`Command failed (${cmd} ${args.join(' ')}): ${out || `exit ${r.status}`}`);
	}
	return { status: r.status ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function arg(args, key) {
	const i = args.indexOf(key);
	return i === -1 ? null : (args[i + 1] ?? null);
}
const has = (args, key) => args.includes(key);
function parseList(txt) {
	if (!txt) return [];
	return txt.includes('\0')
		? txt.split('\0').map(np).filter(Boolean)
		: txt.split(/\r?\n/).map(np).filter(Boolean);
}
function expandBraces(pattern) {
	const normalized = np(pattern);
	const match = normalized.match(/\{([^{}]+)\}/);
	if (!match) return [normalized];
	const variants = match[1]
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	return variants.flatMap((variant) =>
		expandBraces(
			`${normalized.slice(0, match.index)}${variant}${normalized.slice((match.index || 0) + match[0].length)}`,
		),
	);
}
function globRe(g) {
	const e = np(g)
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*\*\//g, '::DS_DIR::')
		.replace(/\*\*/g, '::D::')
		.replace(/\*/g, '[^/]*')
		.replace(/::DS_DIR::/g, '(?:.*/)?')
		.replace(/::D::/g, '.*');
	return new RegExp(`^${e}$`);
}
function matchAny(p, gs = []) {
	return (gs || []).some((g) => expandBraces(g).some((variant) => globRe(variant).test(p)));
}

function loadJson(path, fallback) {
	if (!existsSync(path)) return fallback;
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return fallback;
	}
}
function loadPolicy(path) {
	const p = loadJson(path, DEFAULT_POLICY);
	return {
		...DEFAULT_POLICY,
		...p,
		docsEvidence: { ...DEFAULT_POLICY.docsEvidence, ...(p.docsEvidence || {}) },
		atomicity: { ...DEFAULT_POLICY.atomicity, ...(p.atomicity || {}) },
		workflow: {
			...DEFAULT_POLICY.workflow,
			...(p.workflow || {}),
			session: {
				...DEFAULT_POLICY.workflow.session,
				...(p.workflow?.session || {}),
			},
			inspect: {
				...DEFAULT_POLICY.workflow.inspect,
				...(p.workflow?.inspect || {}),
			},
		},
		s0Drift: {
			...DEFAULT_POLICY.s0Drift,
			...(p.s0Drift || {}),
		},
		rules: { ...DEFAULT_POLICY.rules, ...(p.rules || {}) },
	};
}
function loadBaseline(path) {
	const b = loadJson(path, { version: 2, generatedAt: null, rules: {} });
	return { version: b.version || 2, generatedAt: b.generatedAt || null, rules: b.rules || {} };
}

function modeOf(raw, aliases) {
	if (!raw) return 'strict';
	if (raw === 'strict' || raw === 'quick') return raw;
	if (aliases?.[raw]) return aliases[raw];
	return raw === 'minimal' ? 'quick' : raw;
}
function phaseOf(args, policy) {
	const v = arg(args, '--enforce-phase');
	if (['1', '2', '3'].includes(v)) return Number(v);
	const d = Number(policy.phaseDefaults?.defaultPhase || 1);
	return [1, 2, 3].includes(d) ? d : 1;
}
function outputOf(args) {
	const v = arg(args, '--output') || 'normal';
	return ['compact', 'normal', 'verbose'].includes(v) ? v : 'normal';
}
function reportProfileOf(args) {
	const v = arg(args, '--report-profile') || 'full';
	return ['full', 'workflow', 'route'].includes(v) ? v : 'full';
}
function checksOf(args) {
	const raw = arg(args, '--checks');
	if (!raw) return new Set(['governance', 'lint', 'typecheck', 'security', 'adu']);
	return new Set(
		String(raw)
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean),
	);
}
function checkEnabled(selectedChecks, checkName) {
	return selectedChecks.has(checkName);
}
function maxFindingsOf(args, policy) {
	const a = Number(arg(args, '--max-findings'));
	if (Number.isFinite(a) && a > 0) return Math.floor(a);
	const p = Number(policy.maxFindings);
	if (Number.isFinite(p) && p > 0) return Math.floor(p);
	return DEFAULT_MAX_FINDINGS;
}

function ruleEnv(ruleId) {
	return `GATEKEEPER_RULE_${ruleId
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		.replace(/[^A-Za-z0-9]+/g, '_')
		.toUpperCase()}`;
}
function sev(ruleId, phase, policy, audit) {
	if (policy.killSwitch) return 'off';
	const r = policy.rules?.[ruleId];
	if (!r || r.enabled === false || r.killSwitch) return 'off';
	const envVal = process.env[ruleEnv(ruleId)];
	if (envVal && ['off', 'warn', 'block'].includes(envVal)) {
		audit.push(`env override ${ruleEnv(ruleId)}=${envVal}`);
		return envVal;
	}
	const o = r.phaseSeverityOverride?.[String(phase)] || r.phaseSeverityOverride?.default;
	if (o && ['off', 'warn', 'block'].includes(o)) return o;
	return r.severityByPhase?.[String(phase)] || r.severityByPhase?.default || 'warn';
}

function extractImportLine(line) {
	const m1 = line.match(/from\s+['"]([^'"]+)['"]/);
	if (m1) return m1[1].trim();
	const m2 = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
	if (m2) return m2[1].trim();
	return null;
}

function inlineFingerprint(text) {
	const raw = String(text || '');
	return raw
		.replace(/"[^"]*"/g, '""')
		.replace(/'[^']*'/g, "''")
		.replace(/`[^`]*`/g, '``')
		.replace(/\b\d+\b/g, '#')
		.replace(/#[0-9a-fA-F]{3,8}\b/g, '#HEX')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 120);
}

function getTypescript() {
	if (typescriptLoadAttempted) return typescriptApi;
	typescriptLoadAttempted = true;
	try {
		typescriptApi = require('typescript');
	} catch {
		typescriptApi = null;
	}
	return typescriptApi;
}

function astroScripts(content) {
	const chunks = [];
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fm) chunks.push(fm[1]);
	const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
	let m;
	while ((m = re.exec(content)) !== null) chunks.push(m[1]);
	return chunks.join('\n');
}

function parseImportsAst(pathname, content) {
	const isAstro = pathname.endsWith('.astro');
	const code = isAstro ? astroScripts(content) : content;
	if (!code.trim())
		return {
			imports: [],
			parseFailed: false,
			covered: ['import', 'export from', 'require', 'import()'],
		};

	const ts = getTypescript();
	if (!ts) {
		const re = /(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g;
		const imports = [];
		let match;
		while ((match = re.exec(code)) !== null) imports.push(match[1].trim());
		return {
			imports: uniq(imports),
			parseFailed: true,
			covered: ['import', 'export from'],
			fallback: 'regex',
		};
	}

	let kind = ts.ScriptKind.TS;
	if (/\.jsx$/i.test(pathname)) kind = ts.ScriptKind.JSX;
	if (/\.tsx$/i.test(pathname)) kind = ts.ScriptKind.TSX;
	if (/\.(js|mjs|cjs)$/i.test(pathname)) kind = ts.ScriptKind.JS;

	try {
		const sf = ts.createSourceFile(pathname, code, ts.ScriptTarget.Latest, true, kind);
		const imports = [];
		const push = (v) => {
			if (v && typeof v === 'string') imports.push(v.trim());
		};
		const walk = (node) => {
			if (
				ts.isImportDeclaration(node) &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			)
				push(node.moduleSpecifier.text);
			if (
				ts.isExportDeclaration(node) &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			)
				push(node.moduleSpecifier.text);
			if (ts.isCallExpression(node)) {
				if (
					ts.isIdentifier(node.expression) &&
					node.expression.text === 'require' &&
					node.arguments.length === 1 &&
					ts.isStringLiteral(node.arguments[0])
				)
					push(node.arguments[0].text);
				if (
					node.expression.kind === ts.SyntaxKind.ImportKeyword &&
					node.arguments.length === 1 &&
					ts.isStringLiteral(node.arguments[0])
				)
					push(node.arguments[0].text);
			}
			ts.forEachChild(node, walk);
		};
		walk(sf);
		return {
			imports: uniq(imports.filter(Boolean)),
			parseFailed: false,
			covered: ['import', 'export from', 'require', 'import()'],
		};
	} catch {
		const re = /(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g;
		const imports = [];
		let m;
		while ((m = re.exec(code)) !== null) imports.push(m[1].trim());
		return {
			imports: uniq(imports),
			parseFailed: true,
			covered: ['import', 'export from'],
			fallback: 'regex',
		};
	}
}

class Snapshot {
	constructor(files, added, numstat, src) {
		this.files = files;
		this.fileSet = new Set(files);
		this.added = added;
		this.numstat = numstat;
		this.src = src;
		this.contentCache = new Map();
		this.shaCache = new Map();
		this.astCache = new Map();
	}
	static fromGit(s0File) {
		let files = [];
		let src = 'git index';
		if (s0File && existsSync(s0File)) {
			const raw = readFileSync(s0File, 'utf8');
			try {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed?.files)) {
					files = uniq(parsed.files.map(np).filter(Boolean));
				} else {
					files = uniq(parseList(raw));
				}
			} catch {
				files = uniq(parseList(raw));
			}
			src = s0File;
		}
		if (!files.length) {
			try {
				files = uniq(
					parseList(run('git', ['diff', '--cached', '--name-only', '-z']).stdout),
				);
			} catch (e) {
				const env = process.env.GATEKEEPER_STAGED_FILES;
				if (env) {
					files = uniq(parseList(env));
					src = 'GATEKEEPER_STAGED_FILES';
				} else if (e?.code === 'EPERM')
					fail(
						'Cannot read staged files (EPERM). Use outside sandbox or GATEKEEPER_STAGED_FILES.',
					);
				else fail('Failed to get staged files from index.');
			}
		}
		return new Snapshot(files, collectAdded(files), collectNumstat(files), src);
	}
	has(f) {
		return this.fileSet.has(f);
	}
	lines(f) {
		return this.added.get(f) || [];
	}
	stat(f) {
		return this.numstat.get(f) || { added: 0, deleted: 0 };
	}
	content(f) {
		if (this.contentCache.has(f)) return this.contentCache.get(f);
		let c = '';
		try {
			const res = run('git', ['show', `:${f}`], { ignoreError: true });
			c = res.status === 0 ? res.stdout : '';
		} catch (e) {
			if (e?.code === 'EPERM' && existsSync(f)) {
				c = readFileSync(f, 'utf8');
				log(
					`⚠️  EPERM reading index blob for ${f}; fallback to filesystem content.`,
					COLORS.yellow,
				);
			}
		}
		this.contentCache.set(f, c);
		return c;
	}
	sha(f) {
		if (this.shaCache.has(f)) return this.shaCache.get(f);
		let s = '';
		try {
			s = run('git', ['rev-parse', `:${f}`], { ignoreError: true }).stdout.trim();
		} catch {
			/* ignore */
		}
		if (!s) s = createHash('sha1').update(this.content(f)).digest('hex');
		this.shaCache.set(f, s);
		return s;
	}
	astImports(f) {
		if (this.astCache.has(f)) return this.astCache.get(f);
		const parsed = parseImportsAst(f, this.content(f));
		this.astCache.set(f, parsed);
		return parsed;
	}
	signature() {
		const payload = this.files
			.map((f) => `${f}|${this.stat(f).added}|${this.stat(f).deleted}`)
			.join('\n');
		return createHash('sha256').update(payload).digest('hex').slice(0, 12);
	}
	detailedSignature() {
		const files = this.files
			.slice()
			.sort((a, b) => a.localeCompare(b))
			.map((f) => ({
				path: f,
				sha: this.sha(f),
				added: this.stat(f).added || 0,
				deleted: this.stat(f).deleted || 0,
			}));
		const signature = createHash('sha256')
			.update(JSON.stringify(files))
			.digest('hex')
			.slice(0, 16);
		return { signature, files };
	}

	tsSignature() {
		const tsFiles = this.files
			.filter((f) => /\.(ts|tsx|astro)$/.test(f))
			.sort((a, b) => a.localeCompare(b));
		if (!tsFiles.length) return '';
		const payload = tsFiles.map((f) => `${f}|${this.sha(f)}`).join('\n');
		return createHash('sha256').update(payload).digest('hex').slice(0, 12);
	}
}

function collectAdded(files) {
	const m = new Map();
	if (!files.length) return m;
	// Optimization: Use a single diff call for both added lines and numstat if possible
	// but for now let's just ensure we handle errors better and keep it simple.
	let out = '';
	try {
		out = run('git', ['diff', '--cached', '--unified=0', '--no-color', '--', ...files], {
			ignoreError: true,
		}).stdout;
	} catch {
		const env = process.env.GATEKEEPER_ADDED_LINES_JSON;
		if (env) {
			const p = JSON.parse(env);
			for (const [f, arr] of Object.entries(p))
				m.set(
					np(f),
					(arr || []).map((x) => ({
						line: Number(x.line || 0),
						text: String(x.text || ''),
					})),
				);
			return m;
		}
		return m;
	}
	let file = null;
	let line = 0;
	for (const raw of out.split(/\r?\n/)) {
		if (raw.startsWith('+++ b/')) {
			file = np(raw.slice(6));
			if (!m.has(file)) m.set(file, []);
			continue;
		}
		if (raw.startsWith('@@')) {
			const mm = raw.match(/\+([0-9]+)(?:,([0-9]+))?/);
			if (mm) line = Number(mm[1]);
			continue;
		}
		if (!file) continue;
		if (raw.startsWith('+') && !raw.startsWith('+++')) {
			m.get(file).push({ line, text: raw.slice(1) });
			line += 1;
			continue;
		}
		if (raw.startsWith(' ')) line += 1;
	}
	return m;
}

function collectNumstat(files) {
	const m = new Map();
	if (!files.length) return m;
	try {
		const out = run('git', ['diff', '--cached', '--numstat', '--', ...files], {
			ignoreError: true,
		}).stdout;
		for (const line of out.split(/\r?\n/)) {
			if (!line.trim()) continue;
			const p = line.split('\t');
			if (p.length < 3) continue;
			const f = np(p.slice(2).join('\t'));
			const added = p[0] === '-' ? 0 : Number(p[0] || 0);
			const deleted = p[1] === '-' ? 0 : Number(p[1] || 0);
			m.set(f, { added, deleted });
		}
	} catch {
		/* ignore */
	}
	return m;
}

function legacyFp(ruleId, file, line, msg) {
	return createHash('sha1')
		.update(`${ruleId}|${file || ''}|${line || 0}|${msg}`)
		.digest('hex');
}
function stableKey(ruleId, type, subject, scope) {
	return `${ruleId}|${type}|${np(String(subject || '').toLowerCase()) || '-'}|${np(String(scope || '').toLowerCase()) || '-'}`;
}
function baselineHas(baseline, f) {
	const xs = baseline.rules?.[f.ruleId] || [];
	return xs.includes(f.stableKey) || xs.includes(f.legacyFingerprint);
}

function reporterOf({ baseline, reportJson, output, maxGlobal, phase, mode }) {
	const findings = [];
	const byRule = new Map();
	const truncByRule = new Map();
	let truncGlobal = 0;
	const sevRank = { block: 0, warn: 1, off: 2 };

	const add = (f, ruleMax) => {
		if (f.severity === 'off') return;
		f.stableKey = stableKey(
			f.ruleId,
			f.findingType,
			f.normalizedSubject,
			f.scope || f.file || '',
		);
		f.legacyFingerprint = legacyFp(f.ruleId, f.file, f.line, f.message);
		if (baselineHas(baseline, f)) return;
		const n = byRule.get(f.ruleId) || 0;
		if (findings.length >= maxGlobal) {
			truncGlobal += 1;
			return;
		}
		if (n >= ruleMax) {
			truncByRule.set(f.ruleId, (truncByRule.get(f.ruleId) || 0) + 1);
			return;
		}
		byRule.set(f.ruleId, n + 1);
		findings.push(f);
	};

	const summarize = () => {
		const grouped = new Map();
		let blocked = false;
		let autoFixable = false;

		for (const f of findings) {
			if (!grouped.has(f.ruleId)) grouped.set(f.ruleId, []);
			grouped.get(f.ruleId).push(f);
			if (f.severity === 'block') blocked = true;
			if (f.autoFixable) autoFixable = true;
		}
		const orderedFindings = findings
			.slice()
			.sort(
				(a, b) =>
					(sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3) ||
					String(a.ruleId || '').localeCompare(String(b.ruleId || '')) ||
					String(a.file || '').localeCompare(String(b.file || '')) ||
					Number(a.line || 0) - Number(b.line || 0) ||
					String(a.stableKey || '').localeCompare(String(b.stableKey || '')),
			);

		if (!reportJson) {
			if (!grouped.size) log('PASS all governance rules', COLORS.green);
			for (const [ruleId, arr] of grouped.entries()) {
				const hasBlock = arr.some((x) => x.severity === 'block');
				const t = truncByRule.get(ruleId) || 0;
				log(
					`${hasBlock ? 'BLOCKED' : 'WARN'} ${ruleId} (${arr.length}${t ? ` +${t} truncated` : ''})`,
					hasBlock ? COLORS.red : COLORS.yellow,
				);
				if (output === 'compact') continue;
				const show = output === 'verbose' ? arr.length : Math.min(arr.length, 8);
				for (const f of orderedFindings.filter((x) => x.ruleId === ruleId).slice(0, show)) {
					const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '';
					log(`  - ${loc} ${f.message}`.trim());
				}
				if (output !== 'verbose' && arr.length > show)
					log(`  - ...and ${arr.length - show} more`);
			}
			if (truncGlobal)
				log(`⚠️ Global findings cap reached (+${truncGlobal} truncated).`, COLORS.yellow);
		}

		return {
			blocked,
			autoFixable,
			findings: orderedFindings,
			truncatedGlobal: truncGlobal,
			summary: Array.from(grouped.entries())
				.map(([ruleId, arr]) => ({
					ruleId,
					count: arr.length,
					truncated: truncByRule.get(ruleId) || 0,
					hasBlock: arr.some((x) => x.severity === 'block'),
				}))
				.sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
			meta: { phase, mode, output, maxGlobal, truncatedGlobal: truncGlobal },
		};
	};

	return { add, summarize };
}

function ruleMax(policy, ruleId, fallback) {
	const r = Number(policy.rules?.[ruleId]?.maxFindings);
	return Number.isFinite(r) && r > 0 ? Math.floor(r) : fallback;
}

function addFinding(rep, policy, globalMax, f) {
	rep.add(f, ruleMax(policy, f.ruleId, globalMax));
}

const SECRET_PATTERNS = [
	{ id: 'api-key-assignment', re: /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/i },
	{ id: 'secret-assignment', re: /\bsecret\b\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/i },
	{ id: 'token-assignment', re: /\btoken\b\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/i },
	{ id: 'password-assignment', re: /\bpassword\b\s*[:=]\s*['"][^'"]{8,}['"]/i },
	{ id: 'sendgrid-key', re: /\bSG\.[A-Za-z0-9._-]{20,}\b/ },
	{ id: 'openai-key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
	{ id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
	{ id: 'jwt-like', re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

function isLikelyTextFile(file) {
	const lowered = file.toLowerCase();
	// Explicitly non-text/binary extensions in invitation projects
	if (
		/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|otf|mp4|webm|pdf|zip|gz|exe|dll|so|wav|mp3|ico)$/i.test(
			lowered,
		)
	) {
		return false;
	}
	return /\.(ts|tsx|js|jsx|astro|json|mdx?|txt|yml|yaml|scss|css|html|sql|sh|ps1|mjs|cjs|env|local|config|cjs)$/i.test(
		lowered,
	);
}

function verifyS0Drift(snapshot, signatureFile, policy = DEFAULT_POLICY) {
	if (!signatureFile || !existsSync(signatureFile)) return { enabled: false, hasDrift: false };
	const expected = loadJson(signatureFile, null);
	if (!expected || !Array.isArray(expected.files)) {
		return { enabled: true, hasDrift: true, reason: 'invalid_s0_signature_file' };
	}
	const current = snapshot.detailedSignature();
	const ignorePatterns = policy.s0Drift?.ignorePatterns || [];
	const isIgnored = (file) => ignorePatterns.length > 0 && matchAny(file, ignorePatterns);
	const expMap = new Map(expected.files.map((f) => [f.path, f]));
	const curMap = new Map(current.files.map((f) => [f.path, f]));
	const missing = expected.files.filter((f) => !curMap.has(f.path)).map((f) => f.path);
	const added = current.files.filter((f) => !expMap.has(f.path)).map((f) => f.path);
	const modified = [];
	for (const f of current.files) {
		const exp = expMap.get(f.path);
		if (!exp) continue;
		if (
			exp.sha !== f.sha ||
			Number(exp.added || 0) !== f.added ||
			Number(exp.deleted || 0) !== f.deleted
		)
			modified.push(f.path);
	}
	const blockingMissing = missing.filter((file) => !isIgnored(file));
	const blockingAdded = added.filter((file) => !isIgnored(file));
	const blockingModified = modified.filter((file) => !isIgnored(file));
	return {
		enabled: true,
		hasDrift:
			blockingMissing.length > 0 || blockingAdded.length > 0 || blockingModified.length > 0,
		expectedSignature: expected.signature,
		currentSignature: current.signature,
		missing,
		added,
		modified,
		blockingMissing,
		blockingAdded,
		blockingModified,
		ignoredOnly:
			(expected.signature !== current.signature ||
				missing.length > 0 ||
				added.length > 0 ||
				modified.length > 0) &&
			blockingMissing.length === 0 &&
			blockingAdded.length === 0 &&
			blockingModified.length === 0,
	};
}

function validateDocEvidence(
	snapshot,
	mapId,
	docPath,
	ev,
	rep,
	policy,
	maxGlobal,
	docsSev,
	changedDocToken,
) {
	if (!snapshot.has(docPath)) return false;
	const st = snapshot.stat(docPath);
	const changed = Number(st.added || 0) + Number(st.deleted || 0);
	const minLines = Number(ev.minChangedLines || 3);
	const minChars = Number(ev.minChangedChars || 40);
	if (ev.requireRealDiff && changed < minLines) {
		addFinding(rep, policy, maxGlobal, {
			ruleId: 'documentationMappings',
			severity: docsSev,
			file: docPath,
			message: `Required doc has weak diff (${changed} lines, min ${minLines}).`,
			findingType: 'doc-lines-too-low',
			normalizedSubject: docPath,
			scope: mapId,
		});
		return false;
	}
	if (ev.requireRealDiff) {
		const chars = snapshot
			.lines(docPath)
			.map((x) => x.text || '')
			.join('\n')
			.replace(/\s+/g, '').length;
		if (chars < minChars) {
			addFinding(rep, policy, maxGlobal, {
				ruleId: 'documentationMappings',
				severity: docsSev,
				file: docPath,
				message: `Required doc has weak textual change (${chars} chars, min ${minChars}).`,
				findingType: 'doc-chars-too-low',
				normalizedSubject: docPath,
				scope: mapId,
			});
			return false;
		}
	}
	const requireToken = Boolean(ev.requireUpdateToken || changedDocToken);
	if (requireToken) {
		const toks = changedDocToken
			? [changedDocToken]
			: Array.isArray(ev.acceptedUpdateTokens)
				? ev.acceptedUpdateTokens
				: [];
		const txt = snapshot
			.lines(docPath)
			.map((x) => x.text || '')
			.join('\n');
		const ok =
			ev.tokenMatchMode === 'all'
				? toks.every((t) => txt.includes(t))
				: toks.some((t) => txt.includes(t));
		if (!ok) {
			addFinding(rep, policy, maxGlobal, {
				ruleId: 'documentationMappings',
				severity: docsSev,
				file: docPath,
				message: `Required doc update token evidence missing (${toks.join(', ')}).`,
				findingType: 'doc-token-missing',
				normalizedSubject: docPath,
				scope: mapId,
			});
			return false;
		}
	}
	return true;
}

function checks(
	snapshot,
	policy,
	baseline,
	phase,
	mode,
	reportJson,
	output,
	maxGlobal,
	changedDocToken,
	audit,
) {
	const rep = reporterOf({ baseline, reportJson, output, maxGlobal, phase, mode, snapshot });
	const forbidden = policy.architectureBoundaries?.clientForbiddenImports || [];

	const severity = (id) => sev(id, phase, policy, audit);

	for (const file of snapshot.files)
		if (severity('forbiddenFiles') !== 'off' && FORBIDDEN_FILES.some((re) => re.test(file)))
			addFinding(rep, policy, maxGlobal, {
				ruleId: 'forbiddenFiles',
				severity: severity('forbiddenFiles'),
				file,
				message: 'Forbidden staged file detected.',
				findingType: 'forbidden-file',
				normalizedSubject: file,
			});

	if (severity('caseCollision') !== 'off') {
		const map = new Map();
		for (const f of snapshot.files) {
			const k = f.toLowerCase();
			if (!map.has(k)) map.set(k, new Set());
			map.get(k).add(f);
		}
		for (const set of map.values())
			if (set.size > 1)
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'caseCollision',
					severity: severity('caseCollision'),
					message: `Case-only path collision: ${Array.from(set).join(', ')}`,
					findingType: 'case-collision',
					normalizedSubject: Array.from(set).join('|'),
				});
	}

	if (severity('publicAssetImport') !== 'off')
		for (const file of snapshot.files)
			for (const line of snapshot.lines(file)) {
				const t = extractImportLine(line.text.trim());
				if (
					t &&
					(t.includes('/public/') || t.startsWith('public/') || t.startsWith('/public/'))
				)
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'publicAssetImport',
						severity: severity('publicAssetImport'),
						file,
						line: line.line,
						message: 'Do not import files from public/** as modules.',
						findingType: 'public-import',
						normalizedSubject: t,
						scope: file,
					});
			}

	if (severity('newAnyAdded') !== 'off')
		for (const file of snapshot.files)
			if (/\.(ts|tsx|astro)$/i.test(file))
				for (const line of snapshot.lines(file))
					if (/\bany\b/.test(line.text) || /as\s+any\b/.test(line.text))
						addFinding(rep, policy, maxGlobal, {
							ruleId: 'newAnyAdded',
							severity: severity('newAnyAdded'),
							file,
							line: line.line,
							message: 'New any detected in added line.',
							findingType: 'new-any',
							normalizedSubject: 'any',
							scope: file,
						});

	const boundarySev = severity('serverClientBoundary');
	if (boundarySev !== 'off') {
		const rule = policy.rules.serverClientBoundary || {};
		for (const file of snapshot.files) {
			if (!matchAny(file, rule.appliesTo || [])) continue;
			if (matchAny(file, rule.exemptions || [])) continue;
			const zone = file.startsWith('src/components/')
				? 'components'
				: file.startsWith('src/pages/')
					? 'pages'
					: 'client';

			if (boundarySev === 'block' && phase >= 2) {
				const parsed = snapshot.astImports(file);
				if (parsed.parseFailed) {
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'serverClientBoundary',
						severity: 'warn',
						file,
						message: `AST parser fallback active for boundary checks; only ${parsed.covered.join(', ')} covered reliably.`,
						findingType: 'ast-fallback',
						normalizedSubject: zone,
						scope: file,
					});
					for (const line of snapshot.lines(file)) {
						const t = extractImportLine(line.text.trim());
						if (t && forbidden.some((x) => t === x || t.startsWith(x)))
							addFinding(rep, policy, maxGlobal, {
								ruleId: 'serverClientBoundary',
								severity: 'warn',
								file,
								line: line.line,
								message: `Client file imports server-only dependency: ${t}`,
								findingType: 'import-regex-fallback',
								normalizedSubject: `${zone}|${t}`,
								scope: file,
							});
					}
				} else {
					for (const t of parsed.imports)
						if (forbidden.some((x) => t === x || t.startsWith(x)))
							addFinding(rep, policy, maxGlobal, {
								ruleId: 'serverClientBoundary',
								severity: boundarySev,
								file,
								message: `Client file imports server-only dependency: ${t}`,
								findingType: 'import-ast',
								normalizedSubject: `${zone}|${t}`,
								scope: file,
							});
				}
			} else {
				for (const line of snapshot.lines(file)) {
					const t = extractImportLine(line.text.trim());
					if (t && forbidden.some((x) => t === x || t.startsWith(x)))
						addFinding(rep, policy, maxGlobal, {
							ruleId: 'serverClientBoundary',
							severity: boundarySev,
							file,
							line: line.line,
							message: `Client file imports server-only dependency: ${t}`,
							findingType: 'import-line',
							normalizedSubject: `${zone}|${t}`,
							scope: file,
						});
				}
			}
		}
	}

	if (severity('themePresetIsolation') !== 'off') {
		const globs = policy.rules.themePresetIsolation?.appliesTo || [];
		for (const file of snapshot.files)
			if (matchAny(file, globs))
				for (const line of snapshot.lines(file)) {
					const t = line.text.trim();
					if (!t || t.startsWith('//') || t.startsWith('/*')) continue;
					if (/^--[a-z0-9-]+\s*:/.test(t) || /^\$[a-z0-9-]+\s*:/.test(t)) continue;
					if (/^[.#[&a-zA-Z][^;]*\{\s*$/.test(t))
						addFinding(rep, policy, maxGlobal, {
							ruleId: 'themePresetIsolation',
							severity: severity('themePresetIsolation'),
							file,
							line: line.line,
							message:
								'Preset file must not add style selectors; keep variables only.',
							findingType: 'selector',
							normalizedSubject: t,
							scope: file,
						});
					if (/^[a-z-]+\s*:\s*.+;\s*$/.test(t) && !t.startsWith('--'))
						addFinding(rep, policy, maxGlobal, {
							ruleId: 'themePresetIsolation',
							severity: severity('themePresetIsolation'),
							file,
							line: line.line,
							message: 'Preset file should avoid direct UI property declarations.',
							findingType: 'property',
							normalizedSubject: t.split(':')[0].trim(),
							scope: file,
						});
				}
	}

	if (severity('themeSectionVariantIsolation') !== 'off') {
		const globs = policy.rules.themeSectionVariantIsolation?.appliesTo || [];
		for (const file of snapshot.files)
			if (matchAny(file, globs))
				for (const line of snapshot.lines(file)) {
					const t = line.text.trim();
					if (/jewelry-box|luxury-hacienda/.test(t) && !/\[data-variant/.test(t))
						addFinding(rep, policy, maxGlobal, {
							ruleId: 'themeSectionVariantIsolation',
							severity: severity('themeSectionVariantIsolation'),
							file,
							line: line.line,
							message:
								'Variant-specific selector should use [data-variant="..."] scope.',
							findingType: 'variant-scope',
							normalizedSubject: t,
							scope: file,
						});
				}
	}

	const inlineStyleSev = severity('inlineStylePolicy');
	const inlineScriptSev = severity('inlineScriptPolicy');
	const styleRule = policy.rules.inlineStylePolicy || {};
	const scriptRule = policy.rules.inlineScriptPolicy || {};
	for (const file of snapshot.files)
		for (const line of snapshot.lines(file)) {
			const txt = line.text;
			if (
				inlineStyleSev !== 'off' &&
				matchAny(file, styleRule.appliesTo || []) &&
				!matchAny(file, styleRule.exemptions || [])
			) {
				if (/\sstyle="|\sstyle=\{/.test(txt))
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'inlineStylePolicy',
						severity: inlineStyleSev,
						file,
						line: line.line,
						message:
							'Inline style attribute is discouraged; move style to SCSS/theme files.',
						findingType: 'style-attr',
						normalizedSubject: `style-attr|${inlineFingerprint(txt)}`,
						scope: file,
					});
				if (/<style(?![^>]*lang="scss")[^>]*>/.test(txt))
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'inlineStylePolicy',
						severity: inlineStyleSev,
						file,
						line: line.line,
						message: '<style> in Astro should use lang="scss" unless exempted.',
						findingType: 'style-tag',
						normalizedSubject: `style-tag|${inlineFingerprint(txt)}`,
						scope: file,
					});
			}
			if (
				inlineScriptSev !== 'off' &&
				matchAny(file, scriptRule.appliesTo || []) &&
				!matchAny(file, scriptRule.allowlist || []) &&
				/<script[^>]*\sis:inline\b/.test(txt)
			) {
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'inlineScriptPolicy',
					severity: inlineScriptSev,
					file,
					line: line.line,
					message: 'Inline script requires explicit allowlist entry.',
					findingType: 'inline-script',
					normalizedSubject: `inline-script|${inlineFingerprint(txt)}`,
					scope: file,
				});
			}
		}

	const docsSev = severity('documentationMappings');
	if (docsSev !== 'off') {
		const ev = policy.docsEvidence || {};
		for (const map of policy.docMappings || []) {
			const touched = snapshot.files.some((f) => matchAny(f, map.triggers || []));
			if (!touched) continue;

			for (const req of map.requiredAll || []) {
				if (!snapshot.has(req)) {
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'documentationMappings',
						severity: docsSev,
						message: `Missing required documentation update: ${req} (mapping: ${map.id}).`,
						findingType: 'missing-doc',
						normalizedSubject: req,
						scope: map.id,
					});
					continue;
				}
				validateDocEvidence(
					snapshot,
					map.id,
					req,
					ev,
					rep,
					policy,
					maxGlobal,
					docsSev,
					changedDocToken,
				);
			}

			const any = map.requiredAny || [];
			if (any.length) {
				let anyOk = false;
				let anyStaged = false;
				for (const d of any) {
					if (!snapshot.has(d)) continue;
					anyStaged = true;
					if (
						validateDocEvidence(
							snapshot,
							map.id,
							d,
							ev,
							rep,
							policy,
							maxGlobal,
							docsSev,
							changedDocToken,
						)
					)
						anyOk = true;
				}
				if (!anyOk) {
					const reason = anyStaged
						? 'staged docs did not satisfy evidence thresholds'
						: 'none of the required docs were staged';
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'documentationMappings',
						severity: docsSev,
						message: `Missing one required documentation update (${any.join(' OR ')}) for mapping: ${map.id} (${reason}).`,
						findingType: 'missing-doc-any',
						normalizedSubject: map.id,
						scope: map.id,
					});
				}
			}
		}
	}

	if (severity('seoAudit') !== 'off') {
		const rule = policy.rules.seoAudit || {};
		for (const file of snapshot.files) {
			if (!matchAny(file, rule.appliesTo || [])) continue;
			const content = snapshot.content(file);
			const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/i);
			if (titleMatch && titleMatch[1].length > 60) {
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'seoAudit',
					severity: severity('seoAudit'),
					file,
					message: `Title too long (${titleMatch[1].length} chars, max 60).`,
					findingType: 'seo-title-length',
					normalizedSubject: 'title',
					scope: file,
				});
			}
			const descMatch = content.match(
				/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i,
			);
			if (descMatch && descMatch[1].length > 155) {
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'seoAudit',
					severity: severity('seoAudit'),
					file,
					message: `Description too long (${descMatch[1].length} chars, max 155).`,
					findingType: 'seo-desc-length',
					normalizedSubject: 'description',
					scope: file,
				});
			}
		}
	}

	if (severity('themeGovernance') !== 'off') {
		if (
			snapshot.has('src/content/config.ts') ||
			snapshot.files.some((f) => f.startsWith('src/styles/themes/'))
		) {
			try {
				const r = run('node', ['scripts/validate-schema.mjs'], { ignoreError: true });
				if (r.status !== 0) {
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'themeGovernance',
						severity: severity('themeGovernance'),
						message:
							'Theme schema / CSS sync check failed. Run scripts/validate-schema.js for details.',
						findingType: 'schema-unsynced',
						normalizedSubject: 'theme-system',
					});
				}
			} catch {
				/* ignore */
			}
		}
	}

	if (severity('godObjectGuard') !== 'off') {
		const rule = policy.rules.godObjectGuard || {};
		const maxFileLines = Number(rule.maxFileLines || 400);
		const maxExportCount = Number(rule.maxExportCount || 20);
		const maxFunctionParams = Number(rule.maxFunctionParams || 6);
		for (const file of snapshot.files) {
			if (!matchAny(file, rule.appliesTo || [])) continue;
			const content = snapshot.content(file);
			const lines = content.split(/\r?\n/).length;
			if (lines > maxFileLines)
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'godObjectGuard',
					severity: severity('godObjectGuard'),
					file,
					message: `Potential God object: file length ${lines} exceeds ${maxFileLines}.`,
					findingType: 'file-lines',
					normalizedSubject: `${file}|${lines}`,
					scope: file,
				});
			const exportCount = (content.match(/^\s*export\s+/gm) || []).length;
			if (exportCount > maxExportCount)
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'godObjectGuard',
					severity: severity('godObjectGuard'),
					file,
					message: `Potential God object: export count ${exportCount} exceeds ${maxExportCount}.`,
					findingType: 'export-count',
					normalizedSubject: `${file}|${exportCount}`,
					scope: file,
				});
			for (const line of snapshot.lines(file)) {
				const m = line.text.match(/\(([^)]*)\)\s*=>|\w+\s*\(([^)]*)\)\s*{/);
				if (!m) continue;
				const params = (m[1] || m[2] || '')
					.split(',')
					.map((x) => x.trim())
					.filter(Boolean).length;
				if (params > maxFunctionParams)
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'godObjectGuard',
						severity: severity('godObjectGuard'),
						file,
						line: line.line,
						message: `Potential God function: ${params} parameters exceeds ${maxFunctionParams}.`,
						findingType: 'function-params',
						normalizedSubject: `${file}|${params}`,
						scope: file,
					});
			}
		}
	}

	if (severity('couplingGuard') !== 'off') {
		const rule = policy.rules.couplingGuard || {};
		const maxImportsPerFile = Number(rule.maxImportsPerFile || 30);
		for (const file of snapshot.files) {
			if (!matchAny(file, rule.appliesTo || [])) continue;
			const parsed = snapshot.astImports(file);
			if (parsed.imports.length > maxImportsPerFile)
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'couplingGuard',
					severity: severity('couplingGuard'),
					file,
					message: `Tight coupling risk: ${parsed.imports.length} imports exceeds ${maxImportsPerFile}.`,
					findingType: 'import-count',
					normalizedSubject: `${file}|${parsed.imports.length}`,
					scope: file,
				});
		}
	}

	if (severity('duplicationGuard') !== 'off') {
		const rule = policy.rules.duplicationGuard || {};
		const minFingerprintLength = Number(rule.minFingerprintLength || 40);
		const maxOccurrences = Number(rule.maxOccurrences || 2);
		const fpMap = new Map();
		for (const file of snapshot.files) {
			if (file.includes('src/styles/tokens/')) continue;
			for (const line of snapshot.lines(file)) {
				const fp = inlineFingerprint(line.text || '');
				if (fp.length < minFingerprintLength) continue;
				if (!fpMap.has(fp)) fpMap.set(fp, []);
				fpMap.get(fp).push({ file, line: line.line });
			}
		}
		for (const [fp, hits] of fpMap.entries())
			if (hits.length > maxOccurrences)
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'duplicationGuard',
					severity: severity('duplicationGuard'),
					file: hits[0].file,
					line: hits[0].line,
					message: `Duplicated logic fingerprint repeated ${hits.length} times in staged diff.`,
					findingType: 'duplicate-fingerprint',
					normalizedSubject: fp,
					scope: hits.map((x) => x.file).join('|'),
				});
	}

	if (severity('obsoleteGovernanceGuard') !== 'off') {
		const requiredPaths = policy.rules.obsoleteGovernanceGuard?.requiredPaths || [];
		for (const path of requiredPaths)
			if (!existsSync(path))
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'obsoleteGovernanceGuard',
					severity: severity('obsoleteGovernanceGuard'),
					message: `Required governance path missing: ${path}`,
					findingType: 'missing-governance-path',
					normalizedSubject: path,
					scope: path,
				});
	}

	if (severity('languageGovernance') !== 'off') {
		const rule = policy.rules.languageGovernance || {};
		const englishPaths = rule.englishPaths || [];
		const spanishUiPaths = rule.spanishUiPaths || [];
		const spanishIndicators =
			/\b(el|la|los|las|de|para|con|sin|por|que|como|cuando|donde|cambio|actualizar)\b|[áéíóúñ]/i;
		const englishIndicators =
			/\b(the|and|with|from|for|when|where|please|update|fix|change|button|form|submit)\b/i;
		for (const file of snapshot.files)
			for (const line of snapshot.lines(file)) {
				const txt = String(line.text || '');
				if (
					matchAny(file, englishPaths) &&
					/\/\/|\/\*|\*|#/.test(txt) &&
					spanishIndicators.test(txt)
				)
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'languageGovernance',
						severity: severity('languageGovernance'),
						file,
						line: line.line,
						message: 'Code/docs comments must be written in English.',
						findingType: 'non-english-code-doc',
						normalizedSubject: inlineFingerprint(txt),
						scope: file,
					});
				if (matchAny(file, spanishUiPaths) && englishIndicators.test(txt))
					addFinding(rep, policy, maxGlobal, {
						ruleId: 'languageGovernance',
						severity: severity('languageGovernance'),
						file,
						line: line.line,
						message: 'Visible UI text must be in Spanish.',
						findingType: 'non-spanish-ui',
						normalizedSubject: inlineFingerprint(txt),
						scope: file,
					});
			}
	}

	return { ...rep.summarize(), rep };
}

function lint(files, reportJson, rep, policy, maxGlobal) {
	if (!reportJson) log('\n🔍 Running linters on staged files...', COLORS.blue);
	const js = files.filter((f) => /\.(js|ts|tsx|astro)$/.test(f) && existsSync(f));
	const scss = files.filter((f) => /\.(scss|css)$/.test(f) && existsSync(f));
	let bad = false;
	const details = [];

	if (js.length) {
		try {
			if (!reportJson) log(`  • ESLint checking ${js.length} files...`);
			run('npx', ['eslint', ...js], { stdio: reportJson ? 'pipe' : 'inherit' });
			details.push({ tool: 'eslint', status: 'passed', files: js.length });
		} catch {
			bad = true;
			details.push({ tool: 'eslint', status: 'failed', files: js.length });
			if (reportJson) {
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'linting',
					severity: 'block',
					message: 'ESLint findings detected.',
					findingType: 'eslint-fail',
					autoFixable: true,
					fixCommand: 'pnpm lint:fix',
				});
			} else log('  ❌ ESLint failed.', COLORS.red);
		}
	}
	if (scss.length) {
		try {
			if (!reportJson) log(`  • Stylelint checking ${scss.length} files...`);
			run('npx', ['stylelint', ...scss], { stdio: reportJson ? 'pipe' : 'inherit' });
			details.push({ tool: 'stylelint', status: 'passed', files: scss.length });
		} catch {
			bad = true;
			details.push({ tool: 'stylelint', status: 'failed', files: scss.length });
			if (reportJson) {
				addFinding(rep, policy, maxGlobal, {
					ruleId: 'linting',
					severity: 'block',
					message: 'Stylelint findings detected.',
					findingType: 'stylelint-fail',
					autoFixable: true,
					fixCommand: 'pnpm lint:scss:fix',
				});
			} else log('  ❌ Stylelint failed.', COLORS.red);
		}
	}
	if (!reportJson && bad) fail('Linting failed. Please fix the errors above.');
	if (!reportJson) log('✅ Linting passed.', COLORS.green);
	return { failed: bad, details };
}

function shouldRunTypecheck(snapshot, policy, selectedChecks, mode) {
	if (!checkEnabled(selectedChecks, 'typecheck')) {
		return { run: false, status: 'skipped', reason: 'check_not_selected' };
	}
	if (!snapshot.files.length) {
		return { run: false, status: 'skipped', reason: 'empty_snapshot' };
	}
	const hasTs = snapshot.files.some((f) => /\.(ts|tsx|astro)$/.test(f));
	const skipPatterns = policy.workflow?.inspect?.typecheckSkipPatterns || [];
	const matchesSkipPatterns =
		skipPatterns.length > 0 && snapshot.files.every((file) => matchAny(file, skipPatterns));
	if (matchesSkipPatterns) {
		return { run: false, status: 'skipped', reason: 'policy_skipped' };
	}
	if (!hasTs && mode !== 'strict') {
		return { run: false, status: 'skipped', reason: 'no_ts_files' };
	}
	return { run: true, status: 'not_run', reason: hasTs ? 'ts_files_present' : 'strict_mode' };
}

function typecheck(snapshot, reportJson) {
	if (!reportJson) log('\n📐 Running full type check (Strict Mode)...', COLORS.blue);
	try {
		run('pnpm', ['type-check'], { stdio: reportJson ? 'pipe' : 'inherit' });
		if (!reportJson) log('✅ Type check passed.', COLORS.green);
		return { failed: false, status: 'passed' };
	} catch {
		if (reportJson) return { failed: true, status: 'failed', message: 'Type check failed' };
		fail('Type check failed.');
	}
	return { failed: false, status: 'passed' };
}

function trackedFiles() {
	try {
		return parseList(run('git', ['ls-files']).stdout);
	} catch (e) {
		const env = process.env.GATEKEEPER_TRACKED_FILES;
		if (env) return uniq(parseList(env));
		if (e?.code === 'EPERM')
			fail(
				'Cannot list tracked files (EPERM). Use outside sandbox or GATEKEEPER_TRACKED_FILES.',
			);
		throw e;
	}
}

function buildBaseline(policy, baselinePath) {
	const files = trackedFiles();
	const added = new Map();
	for (const f of files) {
		let c = '';
		try {
			c = run('git', ['show', `:${f}`], { ignoreError: true }).stdout || '';
		} catch (e) {
			if (e?.code === 'EPERM' && existsSync(f)) {
				c = readFileSync(f, 'utf8');
				log(
					`⚠️  EPERM reading index blob for ${f}; baseline fallback uses filesystem content.`,
					COLORS.yellow,
				);
			}
		}
		added.set(
			f,
			c.split(/\r?\n/).map((t, i) => ({ line: i + 1, text: t })),
		);
	}
	const snap = new Snapshot(files, added, new Map(), 'baseline-index');
	const baseline = { version: 2, generatedAt: new Date().toISOString(), rules: {} };
	const audit = [];
	const res = checks(
		snap,
		policy,
		{ version: 2, rules: {} },
		3,
		'strict',
		false,
		'compact',
		100000,
		null,
		audit,
	);
	for (const f of res.findings) {
		if (!baseline.rules[f.ruleId]) baseline.rules[f.ruleId] = [];
		baseline.rules[f.ruleId].push(f.stableKey);
	}
	for (const k of Object.keys(baseline.rules)) baseline.rules[k] = uniq(baseline.rules[k]);
	const parent = dirname(baselinePath);
	if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
	writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
	log(`✅ Baseline v2 generated at ${baselinePath}`, COLORS.green);
}

function scanStagedSecrets(snapshot, policy, phase, audit, rep, maxGlobal) {
	const severity = sev('forbiddenFiles', phase, policy, audit) === 'off' ? 'off' : 'block';
	let found = 0;
	for (const file of snapshot.files) {
		if (!isLikelyTextFile(file)) continue;
		const content = snapshot.content(file);
		if (!content) continue;
		for (const pattern of SECRET_PATTERNS) {
			if (!pattern.re.test(content)) continue;
			found += 1;
			addFinding(rep, policy, maxGlobal, {
				ruleId: 'secretScan',
				severity,
				file,
				message: `Potential secret found in staged content (${pattern.id}).`,
				findingType: 'staged-secret',
				normalizedSubject: pattern.id,
				scope: file,
			});
		}
	}
	return { failed: found > 0, findings: found };
}

function computeRoute(findings, adu) {
	const hasBlocks = findings.some((f) => f.severity === 'block');
	const hasAutoFix = findings.some((f) => Boolean(f.autoFixable));
	const routeReasons = [];
	if (hasBlocks) routeReasons.push('blocking_findings_present');
	if (!hasBlocks && hasAutoFix) routeReasons.push('autofix_findings_present');
	if (adu.unmappedFiles.length > 0) routeReasons.push('unmapped_files_present');
	if (adu.splitConfidence < 0.6) routeReasons.push('low_split_confidence');
	if (!adu.atomicityPassed) routeReasons.push('adu_atomicity_limit_exceeded');
	let route = 'proceed_adu';
	if (hasBlocks || adu.splitConfidence < 0.6 || !adu.atomicityPassed)
		route = 'architectural_intervention';
	else if (hasAutoFix) route = 'auto_fix';
	return { route, routeReasons };
}
function computeWorkflowRoute({ findings, adu, s0Drift, session }) {
	const hasBlocks = findings.some((f) => f.severity === 'block');
	const hasAutoFix = findings.some((f) => Boolean(f.autoFixable));
	const workflowReasons = [];
	if (hasBlocks) workflowReasons.push('blocking_findings_present');
	if (!hasBlocks && hasAutoFix) workflowReasons.push('autofix_findings_present');
	if (adu.unmappedFiles.length > 0) workflowReasons.push('unmapped_files_present');
	if (adu.splitConfidence < 0.6) workflowReasons.push('low_split_confidence');
	if (!adu.atomicityPassed) workflowReasons.push('adu_atomicity_limit_exceeded');
	if (s0Drift?.enabled && s0Drift?.hasDrift) workflowReasons.push('s0_drift_present');
	if (session?.invalidReason) workflowReasons.push('session_invalid');
	let workflowRoute = 'proceed_adu';
	if (
		hasBlocks ||
		adu.unmappedFiles.length > 0 ||
		adu.splitConfidence < 0.6 ||
		!adu.atomicityPassed ||
		(s0Drift?.enabled && s0Drift?.hasDrift) ||
		session?.invalidReason
	)
		workflowRoute = 'architectural_intervention';
	else if (hasAutoFix) workflowRoute = 'auto_fix';
	return { workflowRoute, workflowReasons: uniq(workflowReasons) };
}
function uniqueAutoFixCommands(findings) {
	return uniq(findings.filter((f) => f.autoFixable && f.fixCommand).map((f) => f.fixCommand));
}
function formatGovernanceFinding(f) {
	return {
		ruleId: f.ruleId,
		severity: f.severity,
		file: f.file,
		line: f.line,
		findingType: f.findingType,
		normalizedSubject: f.normalizedSubject,
		stableKey: f.stableKey,
		message: f.message,
		autoFixable: f.autoFixable,
		fixCommand: f.fixCommand,
	};
}
function buildFinalReport({
	snapshot,
	routeData,
	workflowData,
	branchManagement,
	s0Drift,
	completeChecks,
	governanceFinal,
	lintResult,
	typecheckResult,
	securityResult,
	adu,
	reportProfile,
	session,
}) {
	const findings = governanceFinal.findings.map(formatGovernanceFinding);
	const blockingFindings = governanceFinal.findings
		.filter((f) => f.severity === 'block')
		.map((f) => ({
			ruleId: f.ruleId,
			file: f.file,
			line: f.line,
			message: f.message,
		}));
	const fullReport = {
		schemaVersion: 2,
		route: routeData.route,
		workflowRoute: workflowData.workflowRoute,
		routeReasons: routeData.routeReasons,
		workflowReasons: workflowData.workflowReasons,
		status: workflowData.workflowRoute === 'architectural_intervention' ? 'failed' : 'passed',
		staged: {
			signature: snapshot.signature(),
			detailedSignature: snapshot.detailedSignature(),
			tsSignature: snapshot.tsSignature(),
			count: snapshot.files.length,
			source: snapshot.src,
		},
		branch: branchManagement,
		session,
		s0Drift,
		checks: completeChecks,
		governance: {
			summary: governanceFinal.summary,
			findings,
		},
		lint: lintResult,
		typecheck: typecheckResult,
		security: securityResult,
		adu,
		autoFixCommands: uniqueAutoFixCommands(governanceFinal.findings),
		blockingFindings,
		meta: governanceFinal.meta,
	};
	if (reportProfile === 'full') return fullReport;
	if (reportProfile === 'workflow') {
		return {
			schemaVersion: fullReport.schemaVersion,
			route: fullReport.route,
			workflowRoute: fullReport.workflowRoute,
			routeReasons: fullReport.routeReasons,
			workflowReasons: fullReport.workflowReasons,
			status: fullReport.status,
			staged: fullReport.staged,
			session: fullReport.session,
			checks: fullReport.checks,
			adu: fullReport.adu,
			blockingFindings: fullReport.blockingFindings,
			autoFixCommands: fullReport.autoFixCommands,
			branch: fullReport.branch,
			s0Drift: fullReport.s0Drift,
		};
	}
	return {
		schemaVersion: fullReport.schemaVersion,
		route: fullReport.route,
		workflowRoute: fullReport.workflowRoute,
		routeReasons: fullReport.routeReasons,
		workflowReasons: fullReport.workflowReasons,
		status: fullReport.status,
		staged: fullReport.staged,
		session: fullReport.session,
		checks: fullReport.checks,
		adu: {
			suggestedSplits: fullReport.adu.suggestedSplits,
			unmappedFiles: fullReport.adu.unmappedFiles,
			splitConfidence: fullReport.adu.splitConfidence,
		},
		blockingFindings: fullReport.blockingFindings,
		autoFixCommands: fullReport.autoFixCommands,
	};
}

function getCurrentBranch() {
	const res = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { ignoreError: true });
	if (res.status !== 0) return null;
	return String(res.stdout || '').trim();
}

function branchExists(name) {
	if (!name) return false;
	const res = run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${name}`], {
		ignoreError: true,
	});
	return res.status === 0;
}

function classifyBranchPrefix(files) {
	const scores = { docs: 0, test: 0, style: 0, chore: 0, feat: 0 };
	files.forEach((f) => {
		const path = np(f).toLowerCase();
		if (path.startsWith('docs/') || path.endsWith('.md')) scores.docs++;
		else if (path.startsWith('tests/') || path.includes('.test.')) scores.test++;
		else if (path.startsWith('src/styles/') || /\.(scss|css)$/i.test(path)) scores.style++;
		else if (path.startsWith('scripts/') || path.startsWith('.agent/')) scores.chore++;
		else scores.feat++;
	});

	const total = files.length || 1;
	if (scores.docs / total > 0.7) return 'docs';
	if (scores.test / total > 0.7) return 'test';
	if (scores.style / total > 0.7) return 'style';
	if (scores.chore / total > 0.7) return 'chore';
	return 'feat';
}

function branchSlugFromFiles(files, domain = '') {
	const ignored = new Set([
		'src',
		'docs',
		'tests',
		'scripts',
		'components',
		'pages',
		'styles',
		'lib',
		'content',
		'index',
		'common',
		'utils',
		'shared',
		'ui',
		'app',
		'base',
		'core',
		'main',
		'manifest',
		'all',
		(domain || '').toLowerCase(),
	]);
	const shortAllowlist = new Set(['api', 'ui', 'db', 'ci', 'ux', 'gk']);
	const normalizeToken = (token) => {
		const map = {
			cfg: 'config',
			configs: 'config',
			authn: 'auth',
			authz: 'auth',
			gk: 'gatekeeper',
			gate: 'gatekeeper',
		};
		return map[token] || token;
	};

	const tokens = new Set();
	const sortedFiles = files.slice().sort((a, b) => b.split('/').length - a.split('/').length);

	for (let i = 0; i < 3; i++) {
		for (const file of sortedFiles) {
			const parts = np(file)
				.toLowerCase()
				.split(/[/.\\_[\]-]+/)
				.filter(Boolean);
			const validParts = parts
				.map(normalizeToken)
				.filter((p) => !ignored.has(p) && /^[a-z0-9]+$/.test(p))
				.filter((p) => p.length >= 4 || shortAllowlist.has(p))
				.reverse();

			const part = validParts[i];
			if (part && !tokens.has(part)) {
				tokens.add(part);
				if (tokens.size >= 3) break;
			}
		}
		if (tokens.size >= 3) break;
	}

	return Array.from(tokens).join('-') || 'changes';
}

function inferBranchName(snapshot, policy) {
	const mapper = new DomainMapper(policy);
	const adu = mapper.analyze(snapshot.files);
	const preferred = adu.suggestedSplits
		.slice()
		.sort((a, b) => b.files.length - a.files.length || a.id.localeCompare(b.id))[0];
	const domain = preferred?.id || 'core';
	const prefix = classifyBranchPrefix(snapshot.files);
	const slug = branchSlugFromFiles(snapshot.files, domain);
	const raw = `${prefix}/${domain}-${slug}`.replace(/-+/g, '-').replace(/\/-/, '/');
	return raw.slice(0, 72);
}

function ensureWorkingBranch(snapshot, policy, reportJson) {
	const enabled = policy.autoBranching?.enabled !== false;
	if (!enabled) return { enabled: false, changed: false };
	const current = getCurrentBranch();
	if (!current || current === 'HEAD')
		return { enabled: true, changed: false, skipped: 'detached_head' };
	const protectedBranches = new Set(
		(policy.autoBranching?.protectedBranches || Array.from(PROTECTED_BRANCHES)).map((x) =>
			String(x || '').trim(),
		),
	);
	if (!protectedBranches.has(current)) return { enabled: true, changed: false, current };
	const target = inferBranchName(snapshot, policy);
	if (!target || target === current) return { enabled: true, changed: false, current };

	const switchArgs = branchExists(target) ? ['switch', target] : ['switch', '-c', target];
	const switched = run('git', switchArgs, {
		ignoreError: true,
		stdio: reportJson ? 'pipe' : 'inherit',
	});
	if (switched.status !== 0) {
		fail(`Gatekeeper could not switch from protected branch "${current}" to "${target}".`);
	}
	return {
		enabled: true,
		changed: true,
		from: current,
		to: target,
		action: switchArgs.join(' '),
	};
}

function main() {
	const args = process.argv.slice(2);
	const policyPath = arg(args, '--policy') || DEFAULT_POLICY_PATH;
	const baselinePath = arg(args, '--baseline') || DEFAULT_BASELINE_PATH;
	const policy = loadPolicy(policyPath);
	const s0File = arg(args, '--s0-file');
	const s0SignatureFile = arg(args, '--s0-signature-file');
	const requestedMode = arg(args, '--mode') || 'strict';
	const phase = phaseOf(args, policy);
	const mode = modeOf(requestedMode, policy.legacyAliases || {});
	const reportJson = has(args, '--report-json');
	const reportProfile = reportProfileOf(args);
	const selectedChecks = checksOf(args);
	const noAutoBranch = has(args, '--no-auto-branch');
	const requireCompleteReport = has(args, '--require-complete-report');
	const secretScanStaged =
		(checkEnabled(selectedChecks, 'security') && has(args, '--secret-scan-staged')) ||
		(checkEnabled(selectedChecks, 'security') && reportJson);
	const writeS0Signature = has(args, '--write-s0-signature');
	const output = outputOf(args);
	const changedDocToken = arg(args, '--changed-doc-token');
	const maxGlobal = maxFindingsOf(args, policy);
	const build = has(args, '--build-baseline');
	const session = {
		file: arg(args, '--session-file'),
		invalidReason: arg(args, '--session-invalid-reason'),
	};
	const audit = [];

	if (!reportJson) {
		log(`🛡️  Starting Gatekeeper [Mode: ${mode.toUpperCase()} | Phase: ${phase}]`, COLORS.bold);
		log(`⚙️  Output: ${output} | Max findings: ${maxGlobal}`);
	}

	if (build) {
		buildBaseline(policy, baselinePath);
		return;
	}

	const snapshot = Snapshot.fromGit(s0File);
	if (!snapshot.files.length) {
		if (reportJson) {
			console.log(
				JSON.stringify(
					{
						schemaVersion: 2,
						route: 'proceed_adu',
						workflowRoute: 'proceed_adu',
						status: 'passed',
						routeReasons: ['empty_staged_set'],
						workflowReasons: ['empty_staged_set'],
						session,
						meta: { empty: true },
					},
					null,
					2,
				),
			);
		} else {
			log('⚠️  No files staged. Nothing to check.', COLORS.yellow);
		}
		return;
	}

	const branchManagement = noAutoBranch
		? { enabled: false, changed: false, skipped: 'disabled_by_flag' }
		: ensureWorkingBranch(snapshot, policy, reportJson);

	if (writeS0Signature && s0SignatureFile) {
		const payload = { generatedAt: new Date().toISOString(), ...snapshot.detailedSignature() };
		const parent = dirname(s0SignatureFile);
		if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
		writeFileSync(s0SignatureFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
		if (!reportJson) log(`✅ S0 signature written to ${s0SignatureFile}`, COLORS.green);
		return;
	}

	if (!reportJson) {
		log(`📌 Staged source: ${snapshot.src}`);
		log(`📄 Analyzing ${snapshot.files.length} staged file(s) from index...`);
		if (branchManagement.changed) {
			log(
				`🌿 Auto-switched branch: ${branchManagement.from} -> ${branchManagement.to}`,
				COLORS.blue,
			);
		}
	}

	const baseline = loadBaseline(baselinePath);
	const governance = checks(
		snapshot,
		policy,
		baseline,
		phase,
		mode,
		reportJson,
		output,
		maxGlobal,
		changedDocToken,
		audit,
	);
	const lintResult = checkEnabled(selectedChecks, 'lint')
		? lint(snapshot.files, reportJson, governance.rep, policy, maxGlobal)
		: { failed: false, status: 'skipped', details: [] };
	const typecheckDecision = shouldRunTypecheck(snapshot, policy, selectedChecks, mode);
	let typecheckResult = {
		failed: false,
		status: typecheckDecision.status,
		reason: typecheckDecision.reason,
	};
	if (typecheckDecision.run) {
		typecheckResult = typecheck(snapshot, reportJson);
	} else if (!reportJson && requestedMode !== 'strict') {
		log('\nℹ️  Type-check not requested. Use --checks typecheck to enable.');
	} else if (!reportJson && typecheckDecision.reason === 'policy_skipped') {
		log('\nℹ️  Skipping type check for plan-only markdown/json workflow changes.');
	} else if (!reportJson && typecheckDecision.reason === 'no_ts_files') {
		log('\nℹ️  Skipping type check (no TS/Astro files changed and not in strict mode).');
	}
	const securityResult =
		checkEnabled(selectedChecks, 'security') && secretScanStaged
			? scanStagedSecrets(snapshot, policy, phase, audit, governance.rep, maxGlobal)
			: { failed: false, findings: 0, skipped: true };
	const s0Drift = verifyS0Drift(snapshot, s0SignatureFile, policy);
	if (s0Drift.enabled && s0Drift.hasDrift) {
		addFinding(governance.rep, policy, maxGlobal, {
			ruleId: 's0ScopeDrift',
			severity: 'block',
			message: 'Scope drift detected between S0 snapshot and current staged state.',
			findingType: 's0-drift',
			normalizedSubject: s0Drift.currentSignature || 'unknown',
			scope: s0SignatureFile || '.git/gatekeeper-s0-signature.json',
		});
	}
	const governanceFinal = governance.rep.summarize();
	const mapper = new DomainMapper(policy);
	const adu = mapper.analyze(snapshot.files);
	const routeData = computeRoute(governanceFinal.findings, adu);
	const workflowData = computeWorkflowRoute({
		findings: governanceFinal.findings,
		adu,
		s0Drift,
		session,
	});
	const completeChecks = {
		governance: 'done',
		lint: checkEnabled(selectedChecks, 'lint') ? 'done' : 'skipped',
		typecheck: typecheckResult.status || (typecheckResult.failed ? 'failed' : 'passed'),
		security: checkEnabled(selectedChecks, 'security') && secretScanStaged ? 'done' : 'skipped',
		adu: 'done',
	};
	if (
		reportJson &&
		requireCompleteReport &&
		Object.values(completeChecks).some((v) => v === 'not_run')
	) {
		fail('Incomplete report: one or more required checks were not executed.');
	}

	if (audit.length && !reportJson) {
		log('\n🧭 Override audit log:', COLORS.blue);
		for (const item of uniq(audit)) log(`  - ${item}`);
	}

	if (!reportJson && workflowData.workflowRoute === 'architectural_intervention') {
		if (adu.unmappedFiles.length > 0) {
			console.log('\n📄 Unmapped Files detected in working tree:', adu.unmappedFiles);
		}
		fail('Gatekeeper checks failed. Fix BLOCKED findings before committing.');
	}

	if (!reportJson) {
		log('\n✨ Gatekeeper passed. You are ready to commit.', COLORS.green);
		log('\n💡 To commit:\n   git commit -m "type(scope): description"', COLORS.blue);
		return;
	}

	const finalReport = buildFinalReport({
		snapshot,
		routeData,
		workflowData,
		branchManagement,
		s0Drift,
		completeChecks,
		governanceFinal,
		lintResult,
		typecheckResult,
		securityResult,
		adu,
		reportProfile,
		session,
	});
	console.log(JSON.stringify(finalReport, null, 2));
	if (workflowData.workflowRoute === 'architectural_intervention') {
		process.exitCode = 1;
	}
}

const isMain =
	import.meta.url ===
	`file://${process.platform === 'win32' ? '/' : ''}${process.argv[1]?.replace(/\\/g, '/')}`;

if (isMain) {
	main();
}

export {
	DEFAULT_POLICY,
	DEFAULT_POLICY_PATH,
	DomainMapper,
	loadPolicy,
	matchAny,
	shouldRunTypecheck,
	verifyS0Drift,
};
