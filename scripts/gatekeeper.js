import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { spawnSync } from 'child_process';
import ts from 'typescript';

const COLORS = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	bold: '\x1b[1m',
};
const DEFAULT_POLICY_PATH = '.agent/gatekeeper/policy.json';
const DEFAULT_BASELINE_PATH = '.agent/gatekeeper/baseline.json';
const DEFAULT_MAX_FINDINGS = 20;

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
	rules: {
		forbiddenFiles: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: { 1: 'block', 2: 'block', 3: 'block' },
		},
		caseCollision: {
			enabled: true,
			killSwitch: false,
			maxFindings: 10,
			severityByPhase: { 1: 'block', 2: 'block', 3: 'block' },
		},
		publicAssetImport: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: { 1: 'block', 2: 'block', 3: 'block' },
		},
		newAnyAdded: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: { 1: 'block', 2: 'block', 3: 'block' },
		},
		serverClientBoundary: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: { 1: 'warn', 2: 'block', 3: 'block' },
			appliesTo: ['src/components/**', 'src/pages/**/*.astro', 'src/pages/**/*.tsx'],
			exemptions: ['src/pages/api/**', 'src/pages/admin/**'],
		},
		themePresetIsolation: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: { 1: 'warn', 2: 'block', 3: 'block' },
			appliesTo: ['src/styles/themes/presets/**/*.scss'],
		},
		themeSectionVariantIsolation: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: { 1: 'warn', 2: 'block', 3: 'block' },
			appliesTo: ['src/styles/themes/sections/**/*.scss'],
		},
		inlineStylePolicy: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: { 1: 'warn', 2: 'warn', 3: 'block' },
			appliesTo: ['src/**/*.astro', 'src/**/*.tsx'],
			exemptions: ['src/pages/admin/**', 'src/components/common/Icon.astro'],
		},
		inlineScriptPolicy: {
			enabled: true,
			killSwitch: false,
			maxFindings: 20,
			severityByPhase: { 1: 'warn', 2: 'warn', 3: 'block' },
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
			severityByPhase: { 1: 'warn', 2: 'block', 3: 'block' },
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
			requiredAll: ['docs/THEME_SYSTEM.md'],
		},
		{
			id: 'rsvp-architecture-sync',
			triggers: [
				'src/lib/rsvp-v2/**',
				'src/pages/api/auth/**',
				'src/pages/api/dashboard/**',
				'src/pages/api/invitacion/**',
				'src/middleware.ts',
			],
			requiredAny: ['docs/architecture/rsvp-module.md', 'docs/RSVP_STATUS.md'],
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
};

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
	const r = spawnSync(cmd, args, {
		encoding: 'utf8',
		shell: opts.shell ?? process.platform === 'win32',
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
function globRe(g) {
	const e = np(g)
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*\*/g, '::D::')
		.replace(/\*/g, '[^/]*')
		.replace(/::D::/g, '.*');
	return new RegExp(`^${e}$`);
}
function matchAny(p, gs = []) {
	return (gs || []).some((g) => globRe(g).test(p));
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
			files = uniq(parseList(readFileSync(s0File, 'utf8')));
			src = s0File;
		}
		if (!files.length) {
			try {
				files = uniq(
					parseList(
						run('git', ['diff', '--cached', '--name-only', '-z', '--diff-filter=d'])
							.stdout,
					),
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
			c = run('git', ['show', `:${f}`], { ignoreError: true }).stdout || '';
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
		const k = `${f}|${this.sha(f)}`;
		if (this.astCache.has(k)) return this.astCache.get(k);
		const parsed = parseImportsAst(f, this.content(f));
		this.astCache.set(k, parsed);
		return parsed;
	}
}

function collectAdded(files) {
	const m = new Map();
	if (!files.length) return m;
	let out = '';
	try {
		out = run('git', ['diff', '--cached', '--unified=0', '--no-color', '--', ...files], {
			ignoreError: true,
		}).stdout;
	} catch (e) {
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
		if (e?.code === 'EPERM') {
			log('⚠️ Unable to read staged diff (EPERM). Added-line checks reduced.', COLORS.yellow);
			return m;
		}
		throw e;
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
		for (const f of findings) {
			if (!grouped.has(f.ruleId)) grouped.set(f.ruleId, []);
			grouped.get(f.ruleId).push(f);
		}
		if (!grouped.size) log('PASS all governance rules', COLORS.green);
		for (const [ruleId, arr] of grouped.entries()) {
			const hasBlock = arr.some((x) => x.severity === 'block');
			if (hasBlock) blocked = true;
			const t = truncByRule.get(ruleId) || 0;
			log(
				`${hasBlock ? 'BLOCKED' : 'WARN'} ${ruleId} (${arr.length}${t ? ` +${t} truncated` : ''})`,
				hasBlock ? COLORS.red : COLORS.yellow,
			);
			if (output === 'compact') continue;
			const show = output === 'verbose' ? arr.length : Math.min(arr.length, 8);
			for (const f of arr.slice(0, show)) {
				const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '';
				log(`  - ${loc} ${f.message}`.trim());
			}
			if (output !== 'verbose' && arr.length > show)
				log(`  - ...and ${arr.length - show} more`);
		}
		if (truncGlobal)
			log(`⚠️ Global findings cap reached (+${truncGlobal} truncated).`, COLORS.yellow);
		if (reportJson) {
			// eslint-disable-next-line no-console
			console.log(
				JSON.stringify(
					{
						status: blocked ? 'failed' : 'passed',
						meta: { phase, mode, output, maxGlobal, truncatedGlobal: truncGlobal },
						summary: Array.from(grouped.entries()).map(([ruleId, arr]) => ({
							ruleId,
							count: arr.length,
							truncated: truncByRule.get(ruleId) || 0,
							hasBlock: arr.some((x) => x.severity === 'block'),
						})),
						findings: findings.map((f) => ({
							ruleId: f.ruleId,
							severity: f.severity,
							file: f.file,
							line: f.line,
							findingType: f.findingType,
							normalizedSubject: f.normalizedSubject,
							stableKey: f.stableKey,
							message: output === 'verbose' ? f.message : undefined,
						})),
					},
					null,
					2,
				),
			);
		}
		return { blocked, findings };
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
	const rep = reporterOf({ baseline, reportJson, output, maxGlobal, phase, mode });
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

	return rep.summarize();
}

function lint(files) {
	log('\n🔍 Running linters on staged files...', COLORS.blue);
	const js = files.filter((f) => /\.(js|ts|tsx|astro)$/.test(f));
	const scss = files.filter((f) => /\.(scss|css)$/.test(f));
	let bad = false;
	if (js.length) {
		try {
			log(`  • ESLint checking ${js.length} files...`);
			run('npx', ['eslint', ...js], { stdio: 'inherit' });
		} catch {
			bad = true;
			log('  ❌ ESLint failed.', COLORS.red);
		}
	}
	if (scss.length) {
		try {
			log(`  • Stylelint checking ${scss.length} files...`);
			run('npx', ['stylelint', ...scss], { stdio: 'inherit' });
		} catch {
			bad = true;
			log('  ❌ Stylelint failed.', COLORS.red);
		}
	}
	if (bad) fail('Linting failed. Please fix the errors above.');
	log('✅ Linting passed.', COLORS.green);
}
function typecheck() {
	log('\n📐 Running full type check (Strict Mode)...', COLORS.blue);
	try {
		run('pnpm', ['type-check'], { stdio: 'inherit' });
		log('✅ Type check passed.', COLORS.green);
	} catch {
		fail('Type check failed.');
	}
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

function main() {
	const args = process.argv.slice(2);
	const policyPath = arg(args, '--policy') || DEFAULT_POLICY_PATH;
	const baselinePath = arg(args, '--baseline') || DEFAULT_BASELINE_PATH;
	const s0File = arg(args, '--s0-file');
	const requestedMode = arg(args, '--mode') || 'strict';
	const phase = phaseOf(args, loadPolicy(policyPath));
	const policy = loadPolicy(policyPath);
	const mode = modeOf(requestedMode, policy.legacyAliases || {});
	const reportJson = has(args, '--report-json');
	const output = outputOf(args);
	const changedDocToken = arg(args, '--changed-doc-token');
	const maxGlobal = maxFindingsOf(args, policy);
	const build = has(args, '--build-baseline');
	const audit = [];

	log(`🛡️  Starting Gatekeeper [Mode: ${mode.toUpperCase()} | Phase: ${phase}]`, COLORS.bold);
	log(`⚙️  Output: ${output} | Max findings: ${maxGlobal}`);

	if (build) {
		buildBaseline(policy, baselinePath);
		return;
	}

	const snapshot = Snapshot.fromGit(s0File);
	if (!snapshot.files.length) {
		log('⚠️  No files staged. Nothing to check.', COLORS.yellow);
		return;
	}

	log(`📌 Staged source: ${snapshot.src}`);
	log(`📄 Analyzing ${snapshot.files.length} staged file(s) from index...`);

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

	if (audit.length) {
		log('\n🧭 Override audit log:', COLORS.blue);
		for (const item of uniq(audit)) log(`  - ${item}`);
	}

	if (governance.blocked)
		fail('Gatekeeper governance checks failed. Fix BLOCKED findings before committing.');

	lint(snapshot.files);
	if (mode === 'strict') {
		const hasTs = snapshot.files.some((f) => /\.(ts|tsx|astro)$/.test(f));
		if (hasTs) typecheck();
		else log('\nℹ️  Skipping type check (no TS/Astro files changed).');
	} else {
		log('\nℹ️  Quick mode selected: skipping type-check.');
	}

	log('\n✨ Gatekeeper passed. You are ready to commit.', COLORS.green);
	log('\n💡 To commit:\n   git commit -m "type(scope): description"', COLORS.blue);
}

main();
