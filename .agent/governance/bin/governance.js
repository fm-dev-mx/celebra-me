import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';

/**
 * Celebra-me Governance Micro-CLI
 * Consolidated tool for System Alignment, Drift Detection, and S0 Verification.
 */

const CONFIG = {
	domainMapPath: '.agent/governance/config/domain-map.json',
	s0SignaturePath: '.agent/governance/state/system-s0.json',
	docsPath: 'docs',
	agentPath: '.agent',
};

const COLORS = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	bold: '\x1b[1m',
};

// --- Utilities ---

const log = (msg, color = COLORS.reset) => console.log(`${color}${msg}${COLORS.reset}`);

function run(cmd, args = []) {
	const isWin = process.platform === 'win32';
	const r = spawnSync(cmd, args, { encoding: 'utf8', shell: isWin, stdio: 'pipe' });
	if (r.error) throw r.error;
	return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function loadJson(path, fallback = null) {
	if (!existsSync(path)) return fallback;
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return fallback;
	}
}

function getTrackedFiles() {
	log('🔍 Listing tracked files via git...', COLORS.blue);
	const res = run('git', ['ls-files']);
	if (res.status !== 0) {
		log('❌ Git ls-files failed!', COLORS.red);
		return [];
	}
	const files = res.stdout
		.split(/\r?\n/)
		.filter(Boolean)
		.map((f) => f.replace(/\\/g, '/'));
	log(`📦 Found ${files.length} tracked files.`, COLORS.blue);
	return files;
}

const REGEX_CACHE = new Map();
function globRe(g) {
	if (REGEX_CACHE.has(g)) return REGEX_CACHE.get(g);
	const e = g
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*\*/g, '::D::')
		.replace(/\*/g, '[^/]*')
		.replace(/::D::/g, '.*');
	const re = new RegExp(`^${e}$`);
	REGEX_CACHE.set(g, re);
	return re;
}

// --- Core Logic ---

class Governance {
	constructor(options = {}) {
		this.reportJson = options.reportJson || false;
		this.fix = options.fix || false;
		this.domainMap = loadJson(CONFIG.domainMapPath, { domains: {} });
		this.findings = [];
	}

	addFinding(finding) {
		this.findings.push({
			timestamp: new Date().toISOString(),
			...finding,
		});
	}

	/**
	 * B-7: Strict Naming Conventions based on Domain Map
	 */
	checkNamingConventions(files) {
		log('⚖️  Checking Naming Conventions (B-7)...', COLORS.blue);
		const domainsByPattern = Object.entries(this.domainMap.domains).flatMap(
			([name, patterns]) => patterns.map((p) => ({ name, re: globRe(p) })),
		);

		let count = 0;
		for (const file of files) {
			count++;
			if (count % 100 === 0)
				log(`  - Processed ${count}/${files.length} files for naming...`);

			let matchedDomain = null;
			for (const d of domainsByPattern) {
				if (d.re.test(file)) {
					matchedDomain = d.name;
					break;
				}
			}

			const filename = file.split('/').pop();

			// --- Calibrated Exclusions ---
			// Allow standard ALL_CAPS.md files (e.g. README, CHANGELOG, ARCHITECTURE, SKILL)
			if (/^[A-Z0-9_]+\.md$/.test(filename) || filename.includes('README')) continue;
			// Allow PascalCase & tests
			if (/^[A-Z][a-zA-Z0-9]*(\.[a-z0-9-]+)*\.(astro|tsx?|ts)$/.test(filename)) continue;
			// Allow camelCase for assets, libs, and utils
			if (
				file.includes('src/assets/') ||
				file.includes('src/lib/') ||
				file.includes('src/utils/') ||
				file.includes('src/data/') ||
				file.includes('tests/')
			)
				continue;
			if (filename.startsWith('.')) continue; // .agent, .gitignore, etc
			if (filename.startsWith('_')) continue; // SCSS partials
			if (filename.startsWith('!')) continue;
			if (filename.match(/^\[.*\]\.([a-z]+)$/)) continue; // Dynamic routes [id].ts or [slug].astro

			// Original rule: kebab-case
			if (matchedDomain && !/^[a-z0-9.-]+$/.test(filename)) {
				this.addFinding({
					ruleId: 'namingConvention',
					severity: 'warn',
					file: file,
					message: `File "${filename}" in domain "${matchedDomain}" does not follow strict kebab-case.`,
					type: 'naming-violation',
				});
			}
		}
		log('✅ Naming convention check complete.', COLORS.green);
	}

	/**
	 * A-3: Intent Drift (Baseline)
	 */
	checkFileIntegrity(files) {
		log('🧠 Scanning for Intent Drift (Broken References)...', COLORS.blue);
		const fileSet = new Set(files);
		const docs = files.filter((f) => f.startsWith('docs/') && f.endsWith('.md'));
		const workflows = files.filter(
			(f) => f.startsWith('.agent/workflows/') && f.endsWith('.md'),
		);

		const toCheck = [...docs, ...workflows];
		log(`  - Checking ${toCheck.length} documents for integrity...`, COLORS.blue);

		for (const doc of toCheck) {
			const content = readFileSync(doc, 'utf8');
			// More precise regex for paths: `src/path/file.ext` or `.agent/path/file.ext`
			const paths =
				content.match(/(`|\[|")(src\/|docs\/|\.agent\/)[a-zA-Z0-0./_-]+(`|\]|")/g) || [];

			for (const rawPath of paths) {
				const cleanPath = rawPath
					.replace(/[`[\]"]/g, '')
					.split('#')[0]
					.replace(/\/$/, '');
				if (cleanPath && !fileSet.has(cleanPath) && !existsSync(cleanPath)) {
					this.addFinding({
						ruleId: 'intentDrift',
						severity: 'block',
						file: doc,
						message: `Document references non-existent file: "${cleanPath}"`,
						type: 'broken-reference',
					});
				}
			}
		}
		log('✅ Intent drift check complete.', COLORS.green);
	}

	/**
	 * A-4: S0 Signature
	 */
	computeS0Signature(files) {
		log('🔑 Computing S0 Signature (A-4)...', COLORS.blue);
		// Get all tracked files with their shas in one go
		const res = run('git', ['ls-files', '-s']);
		if (res.status !== 0) return '';

		const lines = res.stdout.split(/\r?\n/).filter(Boolean);
		const fileMap = new Map();
		for (const line of lines) {
			const parts = line.split(/\s+/);
			if (parts.length >= 4) {
				const path = parts.slice(3).join(' ');
				fileMap.set(path, parts[1]); // Just the SHA
			}
		}

		const payload = files
			.sort()
			.map((f) => {
				return `${f}|${fileMap.get(f) || 'untracked'}`;
			})
			.join('\n');

		const sig = createHash('sha256').update(payload).digest('hex');
		log(`✅ S0 Signature computed: ${sig.slice(0, 12)}`, COLORS.green);
		return sig;
	}

	signS0(files) {
		const signature = this.computeS0Signature(files);
		const data = {
			generatedAt: new Date().toISOString(),
			signature,
			fileCount: files.length,
		};
		const dir = dirname(CONFIG.s0SignaturePath);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(CONFIG.s0SignaturePath, JSON.stringify(data, null, 2));
		return data;
	}

	verifyS0(files) {
		const current = this.computeS0Signature(files);
		const saved = loadJson(CONFIG.s0SignaturePath);

		if (!saved) return { status: 'missing' };
		if (saved.signature !== current) {
			this.addFinding({
				ruleId: 's0Integrity',
				severity: 'block',
				message:
					'System S0 integrity mismatch. Current state differs from signed baseline.',
				type: 's0-drift',
			});
			return { status: 'drift', expected: saved.signature, actual: current };
		}
		return { status: 'valid' };
	}

	renderReport() {
		if (this.reportJson) {
			console.log(
				JSON.stringify(
					{
						status: this.findings.some((f) => f.severity === 'block')
							? 'failed'
							: 'passed',
						findingCount: this.findings.length,
						findings: this.findings,
					},
					null,
					2,
				),
			);
			return;
		}

		if (this.findings.length === 0) {
			log('✨ All governance checks passed (Zero findings).', COLORS.green);
			return;
		}

		log(`\n🕵️  Found ${this.findings.length} governance issues:`, COLORS.yellow);
		for (const f of this.findings) {
			const label = f.severity === 'block' ? 'BLOCK' : 'WARN';
			const color = f.severity === 'block' ? COLORS.red : COLORS.yellow;
			log(`  [${label}] ${f.file ? f.file + ': ' : ''}${f.message}`, color);
		}

		if (this.findings.some((f) => f.severity === 'block')) {
			process.exitCode = 1;
		}
	}
}

// --- CLI Runner ---

function main() {
	const args = process.argv.slice(2);
	const command = args[0] || 'audit';
	const options = {
		reportJson: args.includes('--report-json'),
		fix: args.includes('--fix'),
		verifyS0: args.includes('--verify-s0'),
	};

	const gov = new Governance(options);
	const files = getTrackedFiles();

	if (command === 'sign-s0') {
		const result = gov.signS0(files);
		log(`✅ System signed. Hash: ${result.signature.slice(0, 12)}`, COLORS.green);
		return;
	}

	if (options.verifyS0 || command === 'audit') {
		gov.verifyS0(files);
	}

	if (command === 'drift' || command === 'audit') {
		gov.checkNamingConventions(files);
		gov.checkFileIntegrity(files);
	}

	gov.renderReport();
}

main();
