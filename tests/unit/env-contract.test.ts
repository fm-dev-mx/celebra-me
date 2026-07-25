import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const RUNTIME_SOURCE_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);
const BUILT_IN_IMPORT_META_ENV_NAMES = new Set(['BASE_URL', 'DEV', 'MODE', 'PROD', 'SITE', 'SSR']);

function readProjectFile(relativePath: string): string {
	return readFileSync(join(ROOT, relativePath), 'utf8');
}

function collectMatches(source: string, pattern: RegExp): Set<string> {
	return new Set(Array.from(source.matchAll(pattern), (match) => match[1]));
}

function collectRuntimeSourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(directory, entry.name);
		if (entry.isDirectory()) return collectRuntimeSourceFiles(fullPath);
		if (entry.name.endsWith('.d.ts') || !RUNTIME_SOURCE_EXTENSIONS.has(extname(entry.name))) {
			return [];
		}
		return [fullPath];
	});
}

function collectRuntimeEnvNames(): Set<string> {
	const names = new Set<string>();

	for (const filePath of collectRuntimeSourceFiles(join(ROOT, 'src'))) {
		const source = readFileSync(filePath, 'utf8');
		const runtimePatterns = [
			/getEnv\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g,
			/process\.env\.([A-Z][A-Z0-9_]*)/g,
			/process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
		];

		for (const pattern of runtimePatterns) {
			for (const name of collectMatches(source, pattern)) names.add(name);
		}

		const importMetaPatterns = [
			/import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
			/import\.meta\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
		];
		for (const pattern of importMetaPatterns) {
			for (const name of collectMatches(source, pattern)) {
				if (!BUILT_IN_IMPORT_META_ENV_NAMES.has(name)) names.add(name);
			}
		}
	}

	return names;
}

function readDocumentedCategory(category: string): Set<string> {
	const docs = readProjectFile('docs/env-workflow.md');
	const row = docs.split(/\r?\n/).find((line) => line.includes(`| \`${category}\``));

	if (!row) throw new Error(`Missing env contract category "${category}"`);
	return collectMatches(row, /`([A-Z][A-Z0-9_]*)`/g);
}

function sorted(values: Iterable<string>): string[] {
	return Array.from(values).sort();
}

function difference(values: Set<string>, excluded: Set<string>): Set<string> {
	return new Set(Array.from(values).filter((value) => !excluded.has(value)));
}

describe('environment contract', () => {
	const templateNames = collectMatches(readProjectFile('.env.example'), /^([A-Z][A-Z0-9_]*)=/gm);
	const typedRuntimeNames = collectMatches(
		readProjectFile('src/env.d.ts'),
		/\breadonly\s+([A-Z][A-Z0-9_]*)(?:\?)?:\s*string;/g,
	);
	const runtimeNames = collectRuntimeEnvNames();
	const operationalOnlyNames = readDocumentedCategory('operational-script-only');
	const platformRuntimeNames = readDocumentedCategory('platform-provided-runtime');

	it('types every active app/runtime variable and no script-only variables', () => {
		expect(sorted(typedRuntimeNames)).toEqual(sorted(runtimeNames));
	});

	it('reconciles template and typing through documented categories', () => {
		expect(sorted(difference(operationalOnlyNames, templateNames))).toEqual([]);
		expect(
			sorted(difference(operationalOnlyNames, difference(templateNames, typedRuntimeNames))),
		).toEqual([]);
		expect(sorted(difference(platformRuntimeNames, typedRuntimeNames))).toEqual([]);
		expect(
			sorted(difference(platformRuntimeNames, difference(typedRuntimeNames, templateNames))),
		).toEqual([]);

		expect(sorted(difference(templateNames, operationalOnlyNames))).toEqual(
			sorted(difference(typedRuntimeNames, platformRuntimeNames)),
		);
	});

	it('keeps the shared runtime helper process.env-only', () => {
		const helperSource = readProjectFile('src/lib/server/env.ts');
		expect(helperSource).toContain('process.env[key]');
		expect(helperSource).not.toMatch(/node:fs|dotenv|loadEnv|readFile|existsSync/);
	});
});
