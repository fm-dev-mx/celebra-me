import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { PLATFORM_ENV_BY_ENVIRONMENT } from '@/lib/platform/server/config';
import { ENV_FILES, compareEnvFile, readTemplateNames } from '../../scripts/agent/env-files.ts';

const ROOT = process.cwd();
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.astro', '.yml', '.jsonc']);
const CODE_ROOTS = ['src', 'scripts', '.github/workflows', 'workers'];
const CODE_FILES_AT_ROOT = ['astro.config.mjs', 'wrangler.jsonc'];
/** Files that only enumerate names (allow-lists), so they do not prove that a name is read. */
const NAME_LIST_FILES = new Set([
	'scripts/agent/env-files.ts',
	'scripts/ops/cloudflare-preview-secrets.ts',
]);

function collectCodeFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		if (entry === 'node_modules' || entry === 'dist') return [];
		const fullPath = join(directory, entry);
		if (statSync(fullPath).isDirectory()) return collectCodeFiles(fullPath);
		return CODE_EXTENSIONS.has(extname(entry)) ? [fullPath] : [];
	});
}

function readCodeCorpus(): string {
	const files = [
		...CODE_ROOTS.flatMap((root) => collectCodeFiles(join(ROOT, root))),
		...CODE_FILES_AT_ROOT.map((file) => join(ROOT, file)),
		...readdirSync(ROOT)
			.filter((file) => /^playwright.*\.config\.ts$/.test(file))
			.map((file) => join(ROOT, file)),
	];
	return files
		.filter((file) => !NAME_LIST_FILES.has(relative(ROOT, file).replaceAll('\\', '/')))
		.map((file) => readFileSync(file, 'utf8'))
		.join('\n');
}

function templateNames(template: string): string[] {
	return readTemplateNames(readFileSync(join(ROOT, template), 'utf8'));
}

describe('env file templates', () => {
	const corpus = readCodeCorpus();

	it.each(ENV_FILES.map((spec) => [spec.template]))(
		'%s lists unique names that code actually reads',
		(template) => {
			const names = templateNames(template);
			expect(names.length).toBeGreaterThan(0);
			expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
			expect(names.filter((name) => !new RegExp(`\\b${name}\\b`).test(corpus))).toEqual([]);
		},
	);

	it('keeps test runner and Production operator names in their own file only', () => {
		const local = new Set(templateNames('.env.example'));
		const preview = new Set(templateNames('.env.preview.local.example'));
		for (const template of ['.env.e2e.local.example', '.env.production.local.example']) {
			for (const name of templateNames(template)) {
				expect([name, local.has(name) || preview.has(name)]).toEqual([name, false]);
			}
		}
		expect(
			templateNames('.env.production.local.example').every((name) =>
				name.startsWith('PROD_'),
			),
		).toBe(true);
		expect(
			templateNames('.env.preview.local.example').filter((name) =>
				/PRODUCTION|^PROD_/.test(name),
			),
		).toEqual([]);
		// Local-only diagnostics: deployments read the plain names.
		const localOnly = new Set(
			Object.values(PLATFORM_ENV_BY_ENVIRONMENT).flatMap((entry) => Object.values(entry)),
		);
		expect(
			templateNames('.env.preview.local.example').filter((name) => localOnly.has(name)),
		).toEqual([]);
	});

	it('reports missing, empty and unknown names without values', () => {
		expect(
			compareEnvFile('.env.x', ['A', 'B', 'C'], { A: 'value', B: ' ', EXTRA: 'x' }),
		).toEqual({
			file: '.env.x',
			present: true,
			missing: ['C'],
			empty: ['B'],
			unknown: ['EXTRA'],
		});
		expect(compareEnvFile('.env.x', ['A'], null)).toEqual({
			file: '.env.x',
			present: false,
			missing: ['A'],
			empty: [],
			unknown: [],
		});
	});
});
