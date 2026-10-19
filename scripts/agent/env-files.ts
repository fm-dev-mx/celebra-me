#!/usr/bin/env tsx
/**
 * env-files.ts — Check and synchronize the ignored local env files of the worktree lanes.
 *
 * Each ignored file has one purpose and one tracked template (`ENV_FILES`). The Integration
 * checkout (repo root) holds the canonical copies; the development lanes receive identical copies.
 * Output lists names, file states and short digests only — never values.
 *
 * Usage:
 *   pnpm env:check                      # compare this checkout's files with their templates
 *   pnpm env:sync                       # dry run: what would change in this checkout
 *   pnpm env:sync -- --all              # dry run for every development lane
 *   pnpm env:sync -- --all --apply      # copy the Integration files into every development lane
 *   pnpm env:audit                      # templates vs code: unread, undocumented, stale names
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { findRepoRoot, listExpectedLanePaths } from '../shared/worktree-lane';

export interface EnvFileSpec {
	/** Ignored file holding real values. */
	file: string;
	/** Tracked, secret-free template that lists every allowed name. */
	template: string;
	purpose: string;
}

export const ENV_FILES: readonly EnvFileSpec[] = [
	{ file: '.env.local', template: '.env.example', purpose: 'Local development' },
	{
		file: '.env.preview.local',
		template: '.env.preview.local.example',
		purpose: 'Preview lane, Preview DB workflows and Preview Worker secrets',
	},
	{
		file: '.env.production.local',
		template: '.env.production.local.example',
		purpose: 'Production operator workflows',
	},
	{
		file: '.env.e2e.local',
		template: '.env.e2e.local.example',
		purpose: 'Hosted test runner and smoke credentials',
	},
];

export interface EnvFileReport {
	file: string;
	present: boolean;
	/** Template names absent from the file. */
	missing: string[];
	/** Template names present with an empty value. */
	empty: string[];
	/** Names in the file that the template does not allow. */
	unknown: string[];
}

export function readTemplateNames(source: string): string[] {
	return Array.from(source.matchAll(/^([A-Z][A-Z0-9_]*)=/gm), (match) => match[1]);
}

export function compareEnvFile(
	file: string,
	templateNames: readonly string[],
	values: Record<string, string> | null,
): EnvFileReport {
	if (!values)
		return { file, present: false, missing: [...templateNames], empty: [], unknown: [] };
	const allowed = new Set(templateNames);
	return {
		file,
		present: true,
		missing: templateNames.filter((name) => !(name in values)),
		empty: templateNames.filter((name) => name in values && !values[name].trim()),
		unknown: Object.keys(values)
			.filter((name) => !allowed.has(name))
			.sort(),
	};
}

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.astro', '.yml', '.jsonc']);
const CODE_ROOTS = ['src', 'scripts', '.github/workflows', 'workers'];
const CODE_FILES_AT_ROOT = ['astro.config.mjs', 'wrangler.jsonc'];
/** Files that only enumerate names (allow-lists), so they do not prove that a name is read. */
const NAME_LIST_FILES = new Set([
	'scripts/agent/env-files.ts',
	'scripts/ops/cloudflare-worker-secrets.ts',
]);
/** Retired providers and mechanisms that template comments must no longer mention. */
const RETIRED_WORDS = /\b(?:vercel|cloudinary|CRON_SECRET)\b/i;
const SECTION_RULE = /^#\s*-{10,}\s*$/;

function collectCodeFiles(directory: string): string[] {
	if (!existsSync(directory)) return [];
	return readdirSync(directory).flatMap((entry) => {
		if (entry === 'node_modules' || entry === 'dist') return [];
		const fullPath = join(directory, entry);
		if (statSync(fullPath).isDirectory()) return collectCodeFiles(fullPath);
		return CODE_EXTENSIONS.has(extname(entry)) ? [fullPath] : [];
	});
}

/** Concatenated source of every file that may read an env name (tests and docs excluded). */
export function readCodeCorpus(root: string): string {
	const files = [
		...CODE_ROOTS.flatMap((entry) => collectCodeFiles(join(root, entry))),
		...CODE_FILES_AT_ROOT.map((file) => join(root, file)).filter((file) => existsSync(file)),
		...readdirSync(root)
			.filter((file) => /^playwright.*\.config\.ts$/.test(file))
			.map((file) => join(root, file)),
	];
	return files
		.filter((file) => !NAME_LIST_FILES.has(relative(root, file).replaceAll('\\', '/')))
		.map((file) => readFileSync(file, 'utf8'))
		.join('\n');
}

export function findUnreadNames(names: readonly string[], corpus: string): string[] {
	return names.filter((name) => !new RegExp(`\\b${name}\\b`).test(corpus));
}

export interface TemplateAudit {
	/** Names with no comment in their block (consecutive non-blank lines). */
	undocumented: string[];
	/** Section titles with no name under them. */
	emptySections: string[];
	/** 1-based line numbers of comments that mention a retired provider. */
	staleCommentLines: number[];
}

/**
 * Documentation rules for a template: every name sits in a block that holds a comment, every
 * `# ---` / `# Title` / `# ---` section lists at least one name, and no comment mentions a
 * retired provider.
 */
export function auditTemplate(source: string): TemplateAudit {
	const lines = source.split(/\r?\n/).map((line) => line.trim());
	const audit: TemplateAudit = { undocumented: [], emptySections: [], staleCommentLines: [] };
	let block: string[] = [];
	let blockHasComment = false;
	let section: { title: string; names: number } | null = null;
	const closeBlock = () => {
		if (!blockHasComment) audit.undocumented.push(...block);
		block = [];
		blockHasComment = false;
	};
	const closeSection = () => {
		if (section && section.names === 0) audit.emptySections.push(section.title);
	};
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (line.startsWith('#') && RETIRED_WORDS.test(line))
			audit.staleCommentLines.push(index + 1);
		if (!line) {
			closeBlock();
			continue;
		}
		const title = lines[index + 1];
		if (
			SECTION_RULE.test(line) &&
			title?.startsWith('#') &&
			SECTION_RULE.test(lines[index + 2] ?? '')
		) {
			closeBlock();
			closeSection();
			section = { title: title.replace(/^#\s*/, ''), names: 0 };
			if (RETIRED_WORDS.test(title)) audit.staleCommentLines.push(index + 2);
			index += 2;
			continue;
		}
		if (line.startsWith('#')) {
			if (!/^#\s*[=-]+\s*$/.test(line)) blockHasComment = true;
			continue;
		}
		const name = line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1];
		if (!name) continue;
		block.push(name);
		if (section) section.names += 1;
	}
	closeBlock();
	closeSection();
	return audit;
}

function readValues(path: string): Record<string, string> | null {
	if (!existsSync(path)) return null;
	return parseEnv(readFileSync(path, 'utf8')) as Record<string, string>;
}

function digest(path: string): string | null {
	if (!existsSync(path)) return null;
	return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
}

function checkCheckout(cwd: string): boolean {
	let ok = true;
	for (const spec of ENV_FILES) {
		const templatePath = resolve(cwd, spec.template);
		if (!existsSync(templatePath)) {
			console.error(
				`✖ ${spec.template} is missing; this checkout predates the env templates.`,
			);
			ok = false;
			continue;
		}
		const report = compareEnvFile(
			spec.file,
			readTemplateNames(readFileSync(templatePath, 'utf8')),
			readValues(resolve(cwd, spec.file)),
		);
		if (!report.present) {
			console.warn(
				`• ${spec.file}: absent (${spec.purpose}). Copy ${spec.template} to create it.`,
			);
			continue;
		}
		const mark = report.unknown.length || report.missing.length ? '✖' : '✓';
		console.info(`${mark} ${spec.file} (${spec.purpose})`);
		if (report.unknown.length) {
			console.error(`    not in ${spec.template}: ${report.unknown.join(', ')}`);
			ok = false;
		}
		if (report.missing.length) {
			console.error(`    missing names: ${report.missing.join(', ')}`);
			ok = false;
		}
		if (report.empty.length)
			console.info(`    empty (optional or pending): ${report.empty.join(', ')}`);
	}
	return ok;
}

function syncTargets(repoRoot: string, all: boolean): string[] {
	if (!all) return [process.cwd()];
	return listExpectedLanePaths(repoRoot)
		.filter((lane) => lane.id !== 'integration' && existsSync(lane.path))
		.map((lane) => lane.path);
}

/** Canonical files must match this checkout's templates before they are copied anywhere. */
function sourceIsClean(source: string): boolean {
	let clean = true;
	for (const spec of ENV_FILES) {
		const values = readValues(resolve(source, spec.file));
		if (!values) continue;
		const report = compareEnvFile(
			spec.file,
			readTemplateNames(readFileSync(resolve(process.cwd(), spec.template), 'utf8')),
			values,
		);
		if (report.unknown.length || report.missing.length) {
			console.error(
				`✖ Integration ${spec.file} does not match ${spec.template} (unknown: ${report.unknown.join(', ') || 'none'}; missing: ${report.missing.join(', ') || 'none'}).`,
			);
			clean = false;
		}
	}
	return clean;
}

function sync(repoRoot: string, all: boolean, apply: boolean): void {
	const source = resolve(repoRoot);
	if (!sourceIsClean(source)) {
		process.exitCode = 1;
		if (apply) throw new Error('Refusing to copy: fix the Integration files first.');
	}
	for (const target of syncTargets(repoRoot, all)) {
		if (resolve(target) === source) {
			console.info(
				`• ${basename(target)}: Integration holds the canonical files; nothing to copy.`,
			);
			continue;
		}
		console.info(`${basename(target)}:`);
		for (const spec of ENV_FILES) {
			const from = resolve(source, spec.file);
			const to = resolve(target, spec.file);
			const sourceDigest = digest(from);
			if (!sourceDigest) {
				console.warn(`    ${spec.file}: absent in Integration; left untouched`);
				continue;
			}
			const targetDigest = digest(to);
			if (sourceDigest === targetDigest) {
				console.info(`    ${spec.file}: identical`);
				continue;
			}
			const state = targetDigest ? `differs (${targetDigest} → ${sourceDigest})` : 'absent';
			if (apply) copyFileSync(from, to);
			console.info(`    ${spec.file}: ${state}${apply ? ' — copied' : ' — would copy'}`);
		}
	}
	if (!apply) console.info('Dry run: nothing copied. Add --apply to copy.');
}

function auditCheckout(root: string): boolean {
	const corpus = readCodeCorpus(root);
	let ok = true;
	for (const spec of ENV_FILES) {
		const source = readFileSync(resolve(root, spec.template), 'utf8');
		const names = readTemplateNames(source);
		const audit = auditTemplate(source);
		const problems: [string, readonly (string | number)[]][] = [
			['read by no code', findUnreadNames(names, corpus)],
			['listed twice', names.filter((name, index) => names.indexOf(name) !== index)],
			['no comment', audit.undocumented],
			['empty sections', audit.emptySections],
			['retired provider in comment, line', audit.staleCommentLines],
		];
		const failed = problems.filter(([, items]) => items.length);
		console.info(`${failed.length ? '✖' : '✓'} ${spec.template}: ${names.length} names`);
		for (const [label, items] of failed) console.error(`    ${label}: ${items.join(', ')}`);
		if (failed.length) ok = false;
	}
	return ok;
}

function main(): void {
	const [command = 'check', ...rest] = process.argv.slice(2).filter((arg) => arg !== '--');
	if (command === 'check') {
		if (!checkCheckout(process.cwd())) process.exitCode = 1;
		return;
	}
	if (command === 'sync') {
		sync(findRepoRoot(), rest.includes('--all'), rest.includes('--apply'));
		return;
	}
	if (command === 'audit') {
		if (!auditCheckout(findRepoRoot())) process.exitCode = 1;
		return;
	}
	throw new Error('Usage: env-files.ts check | audit | sync [--all] [--apply]');
}

if (process.argv[1] && /^env-files\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	try {
		main();
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : 'env-files failed.');
		process.exitCode = 1;
	}
}
