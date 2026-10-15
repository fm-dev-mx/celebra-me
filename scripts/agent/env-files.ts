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
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
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
	throw new Error('Usage: env-files.ts check | sync [--all] [--apply]');
}

if (process.argv[1] && /^env-files\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	try {
		main();
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : 'env-files failed.');
		process.exitCode = 1;
	}
}
