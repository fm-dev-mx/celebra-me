#!/usr/bin/env tsx
/**
 * env-files.ts — Check and synchronize the ignored local env files of the worktree lanes.
 *
 * Integration holds the canonical files. Only named lanes and purposes receive copies.
 * Differing files are preserved; Production and hosted-test files are never distributed.
 * Preview copies go only to Preview-default lanes. Output contains no values.
 *
 * Usage:
 *   pnpm env:check                      # compare this checkout's files with their templates
 *   pnpm env:check -- --runtime local   # validate the runtime files this lane needs (or preview)
 *   pnpm env:sync -- --target f09-docs --purpose local          # dry run
 *   pnpm env:sync -- --target f11-preview --purpose preview --apply
 *   pnpm env:audit                      # templates vs code: unread, undocumented, stale names
 */
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
	existsSync,
	linkSync,
	lstatSync,
	readFileSync,
	readdirSync,
	realpathSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { findRepoRoot, gitInspectionEnv, listExpectedLanePaths } from '../shared/worktree-lane';
import { assertRuntimeSupabaseIdentity } from '../shared/celebra-runtime-env';

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
	try {
		return parseEnv(readFileSync(path, 'utf8')) as Record<string, string>;
	} catch {
		throw new Error(`Cannot parse configuration file: ${basename(path)}.`);
	}
}

function checkCheckout(cwd: string): boolean {
	console.info('Template inventory only; this does not certify runtime or operation readiness.');
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

export type EnvPurpose = 'local' | 'preview';
const PURPOSE_FILES: Record<EnvPurpose, string> = {
	local: '.env.local',
	preview: '.env.preview.local',
};

export interface SyncOptions {
	targets: string[];
	purposes: EnvPurpose[];
	apply: boolean;
}

/** Reject broad/unknown requests before opening configuration or other checkouts. */
export function parseSyncArgs(args: string[]): SyncOptions {
	const options: SyncOptions = { targets: [], purposes: [], apply: false };
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === '--apply') {
			options.apply = true;
			continue;
		}
		const value = args[++index];
		if (!value || value.startsWith('--'))
			throw new Error(
				'Expected --target <lane> and --purpose <local|preview>; --all is not supported.',
			);
		if (arg === '--target') options.targets.push(value);
		else if (arg === '--purpose' && Object.hasOwn(PURPOSE_FILES, value))
			options.purposes.push(value as EnvPurpose);
		else
			throw new Error(
				'Unsupported sync option/purpose. Production, hosted-test and bulk sync are excluded.',
			);
	}
	if (!options.targets.length || !options.purposes.length)
		throw new Error('Name at least one --target <lane> and --purpose <local|preview>.');
	return options;
}

interface SyncEntry {
	from: string;
	to: string;
	label: string;
	content: Buffer;
	targetContent: Buffer | null;
	template: string;
	sourceSchema: string;
	targetSchema: string;
}

class EnvSyncError extends Error {}

/** Never print filesystem errors, which can carry machine paths or secret fragments. */
function checkedFile(path: string, required: boolean): Buffer | null {
	const info = lstatSync(path, { throwIfNoEntry: false });
	if (!info) {
		if (required) throw new EnvSyncError(`Required file is missing: ${basename(path)}.`);
		return null;
	}
	if (!info.isFile() || info.isSymbolicLink())
		throw new EnvSyncError(`Expected a regular file: ${basename(path)}.`);
	return readFileSync(path);
}

function canonicalPath(value: string): string {
	return process.platform === 'win32' ? resolve(value).toLowerCase() : resolve(value);
}

function assertRealDirectory(path: string): void {
	const info = lstatSync(path);
	if (
		!info.isDirectory() ||
		info.isSymbolicLink() ||
		canonicalPath(realpathSync(path)) !== canonicalPath(path)
	) {
		throw new EnvSyncError('Directory redirection is not allowed for configuration sync.');
	}
}

function schemaAt(root: string, template: string): string {
	const source = checkedFile(resolve(root, template), true)!.toString('utf8');
	const names = readTemplateNames(source);
	if (!names.length || new Set(names).size !== names.length)
		throw new EnvSyncError(`Invalid schema: ${template}.`);
	return names.sort().join('\n');
}

function assertSyncTarget(repoRoot: string, target: string): void {
	assertRealDirectory(target);
	let commonDir: string;
	try {
		commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
			cwd: target,
			env: gitInspectionEnv(),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		throw new EnvSyncError('Destination repository identity is unavailable.');
	}
	if (
		canonicalPath(realpathSync(resolve(target, commonDir))) !==
		canonicalPath(realpathSync(resolve(repoRoot, '.git')))
	) {
		throw new EnvSyncError('Destination belongs to another repository.');
	}
}

function syncEntry(repoRoot: string, target: string, spec: EnvFileSpec): SyncEntry {
	const sourceSchema = schemaAt(repoRoot, spec.template);
	const targetSchema = schemaAt(target, spec.template);
	if (sourceSchema !== targetSchema)
		throw new EnvSyncError(`Destination template is incompatible: ${spec.template}.`);
	const from = resolve(repoRoot, spec.file);
	const content = checkedFile(from, true)!;
	let values: Record<string, string>;
	try {
		values = parseEnv(content.toString('utf8')) as Record<string, string>;
	} catch {
		throw new EnvSyncError(`Invalid configuration syntax: ${spec.file}.`);
	}
	const report = compareEnvFile(spec.file, sourceSchema.split('\n'), values);
	if (report.unknown.length || report.missing.length)
		throw new EnvSyncError(`Source does not match its template: ${spec.file}.`);
	const to = resolve(target, spec.file);
	const targetContent = checkedFile(to, false);
	if (targetContent && !targetContent.equals(content))
		throw new EnvSyncError(
			`Conflict preserved: ${basename(target)}/${spec.file}. Resolve the named file separately.`,
		);
	return {
		from,
		to,
		label: `${basename(target)}/${spec.file}`,
		content,
		targetContent,
		template: spec.template,
		sourceSchema,
		targetSchema,
	};
}

/** Plans are transient, contain secrets and must never be serialized or persisted. */
function prepareSync(repoRoot: string, options: SyncOptions): SyncEntry[] {
	const lanes = listExpectedLanePaths(repoRoot);
	// Validate every id before inspecting any destination.
	const selected = [...new Set(options.targets)].map((id) => {
		const lane = lanes.find((entry) => entry.id === id && entry.id !== 'integration');
		if (!lane)
			throw new EnvSyncError('Destination must be an explicitly named external lane id.');
		return lane;
	});
	const purposes = [...new Set(options.purposes)];
	const specs = purposes.map((purpose) => {
		const file = Object.hasOwn(PURPOSE_FILES, purpose) ? PURPOSE_FILES[purpose] : undefined;
		if (!file)
			throw new EnvSyncError(
				'Production is excluded from configuration sync; so is hosted-test configuration.',
			);
		return ENV_FILES.find((spec) => spec.file === file)!;
	});
	// The Preview overlay belongs only to Preview-default lanes (F11/F12).
	if (purposes.includes('preview') && selected.some((lane) => lane.runtimeDefault !== 'preview'))
		throw new EnvSyncError('The preview purpose is limited to Preview-default lanes.');
	const targets = selected.map((lane) => lane.path);
	assertRealDirectory(repoRoot);
	return targets.flatMap((target) => {
		assertSyncTarget(repoRoot, target);
		return specs.map((spec) => syncEntry(repoRoot, target, spec));
	});
}

function recheckSync(repoRoot: string, entries: SyncEntry[]): void {
	assertRealDirectory(repoRoot);
	for (const entry of entries) {
		const target = resolve(entry.to, '..');
		assertSyncTarget(repoRoot, target);
		const current = checkedFile(entry.to, false);
		if (
			!checkedFile(entry.from, true)!.equals(entry.content) ||
			(current === null) !== (entry.targetContent === null) ||
			(current && !current.equals(entry.targetContent!)) ||
			schemaAt(repoRoot, entry.template) !== entry.sourceSchema ||
			schemaAt(target, entry.template) !== entry.targetSchema
		) {
			throw new EnvSyncError(
				'Configuration changed after preflight; nothing further will be copied.',
			);
		}
	}
}

/** Publish a complete file without replacing a destination created concurrently. */
function publishCopy(entry: SyncEntry): void {
	const temporary = `${entry.to}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temporary, entry.content, { flag: 'wx', mode: 0o600 });
		linkSync(temporary, entry.to);
	} finally {
		if (existsSync(temporary)) unlinkSync(temporary);
	}
}

export function synchronizeEnv(
	repoRoot: string,
	options: SyncOptions,
	log: (message: string) => void = console.info,
): void {
	let copied = 0;
	try {
		const entries = prepareSync(repoRoot, options);
		if (options.apply) recheckSync(repoRoot, entries);
		for (const entry of entries) {
			const state = entry.targetContent
				? 'identical'
				: options.apply
					? 'copied'
					: 'would copy';
			if (options.apply && !entry.targetContent) {
				recheckSync(repoRoot, entries);
				publishCopy(entry);
				copied++;
				entry.targetContent = entry.content;
			}
			log(`${entry.label}: ${state}`);
		}
		log(options.apply ? `Completed: ${copied} file(s) copied.` : 'Dry run: nothing copied.');
	} catch (error: unknown) {
		const reason =
			error instanceof EnvSyncError
				? error.message
				: 'File access or repository identity check failed.';
		throw new Error(
			`Configuration sync refused or failed; ${copied} file(s) copied. ${reason} No files were overwritten.`,
			{ cause: error },
		);
	}
}

/** Selected runtime check: never opens operator or hosted-test configuration. */
export function assertCheckoutRuntime(cwd: string, target: 'local' | 'preview'): void {
	const local = readValues(resolve(cwd, '.env.local'));
	if (!local) throw new Error('Required runtime file is missing: .env.local.');
	const preview = target === 'preview' ? readValues(resolve(cwd, '.env.preview.local')) : null;
	if (target === 'preview' && !preview)
		throw new Error('Required runtime file is missing: .env.preview.local.');
	const values = { ...local, ...preview };
	assertRuntimeSupabaseIdentity(values, target);
	for (const key of [
		'SUPABASE_ANON_KEY',
		'PUBLIC_SUPABASE_ANON_KEY',
		'SUPABASE_SERVICE_ROLE_KEY',
	]) {
		if (!values[key]?.trim()) throw new Error(`Required runtime name is empty: ${key}.`);
	}
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
		if (rest.length) {
			const target = rest[1];
			if (
				rest.length !== 2 ||
				rest[0] !== '--runtime' ||
				(target !== 'local' && target !== 'preview')
			)
				throw new Error('Usage: env:check -- --runtime local|preview');
			assertCheckoutRuntime(process.cwd(), target);
			console.info(
				`File configuration for ${target} runtime is valid; shell overrides, operation authority and live connectivity are not certified.`,
			);
			return;
		}
		if (!checkCheckout(process.cwd())) process.exitCode = 1;
		return;
	}
	if (command === 'sync') {
		const options = parseSyncArgs(rest);
		synchronizeEnv(findRepoRoot(), options);
		return;
	}
	if (command === 'audit') {
		if (!auditCheckout(findRepoRoot())) process.exitCode = 1;
		return;
	}
	throw new Error(
		'Usage: env-files.ts check [--runtime local|preview] | audit | sync --target <lane> --purpose <local|preview> [--apply]',
	);
}

if (process.argv[1] && /^env-files\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	try {
		main();
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : 'env-files failed.');
		process.exitCode = 1;
	}
}
