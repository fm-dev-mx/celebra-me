import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const GRAPHIFY_VERSION = '0.9.18';
export const REQUIRED_CORPUS_FILES = [
	'src/pages/api/invitacion/public/[eventType]/[slug]/rsvp.ts',
] as const;

export const FORBIDDEN_CORPUS_MARKERS = [
	'node_modules/',
	'dist/',
	'.astro/',
	'.vercel/',
	'coverage/',
	'graphify-out/',
	'.agent/',
	'.hermes/',
	'supabase/.temp/',
	'supabase/.branches/',
	'scripts/graphify/',
	'scripts/graphify-operational-views.ts',
	'tests/fixtures/graphify-operational/',
	'tests/unit/graphify-operational-views.test.ts',
	'tests/unit/graphify-corpus.test.ts',
] as const;

const SQL_EXTENSION = '.sql';
const PACKAGE_PATTERN = /^(?:@[^/]+\/)?[^/]+$/u;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

export type JsonObject = Record<string, unknown>;

export function normalizeCorpusPath(value: unknown): string {
	return typeof value === 'string' ? value.replaceAll('\\', '/').replace(/^\.\//u, '') : '';
}

export function manifestFiles(manifest: unknown): string[] {
	if (Array.isArray(manifest)) {
		return manifest.map(normalizeCorpusPath).filter(Boolean).sort();
	}
	if (!manifest || typeof manifest !== 'object') {
		throw new Error('Graphify manifest must be an object or array.');
	}
	const object = manifest as JsonObject;
	const candidate = object.files;
	if (Array.isArray(candidate)) {
		return candidate.map(normalizeCorpusPath).filter(Boolean).sort();
	}
	return Object.keys(object)
		.map(normalizeCorpusPath)
		.filter((file) => file && !file.startsWith('_'))
		.sort();
}

export function graphSourceFiles(graph: JsonObject): Set<string> {
	const files = new Set<string>();
	for (const node of (graph.nodes as JsonObject[]) ?? []) {
		const sourceFile = normalizeCorpusPath(node.source_file);
		if (sourceFile) files.add(sourceFile);
	}
	return files;
}

function rootOf(file: string): string {
	if (file.startsWith('src/')) return 'src';
	if (file.startsWith('tests/')) return 'tests';
	if (file.startsWith('scripts/')) return 'scripts';
	if (file.startsWith('supabase/')) return 'supabase';
	return 'configRoot';
}

function extensionOf(file: string): string {
	const base = path.posix.basename(file);
	if (base === 'package.json') return 'package.json';
	return path.posix.extname(base).toLowerCase() || '(none)';
}

function countBy(values: string[]): Record<string, number> {
	return values.reduce<Record<string, number>>((counts, value) => {
		counts[value] = (counts[value] ?? 0) + 1;
		return counts;
	}, {});
}

function pathMatchesMarker(file: string, marker: string): boolean {
	return file === marker.replace(/\/$/u, '') || file.startsWith(marker);
}

export function forbiddenCorpusFiles(files: Iterable<string>): string[] {
	return [...files]
		.map(normalizeCorpusPath)
		.filter((file) =>
			FORBIDDEN_CORPUS_MARKERS.some((marker) => pathMatchesMarker(file, marker)),
		)
		.sort();
}

export function sqlFiles(files: Iterable<string>): string[] {
	return [...files]
		.map(normalizeCorpusPath)
		.filter((file) => file.toLowerCase().endsWith(SQL_EXTENSION))
		.sort();
}

export interface CorpusHealth {
	schemaVersion: 1;
	manifestFileCount: number;
	nodeCount: number;
	sourceFileNodeCount: number;
	filesWithNodes: number;
	filesWithoutNodes: string[];
	graphOnlySourceFiles: string[];
	manifestFilesByRoot: Record<string, number>;
	manifestFilesByExtension: Record<string, number>;
	nodesByRoot: Record<string, number>;
	nodesByExtension: Record<string, number>;
	sql: {
		manifestFiles: number;
		filesWithNodes: number;
		nodes: number;
		coverageRatio: number;
	};
	forbiddenManifestFiles: string[];
	forbiddenGraphSourceFiles: string[];
	missingRequiredManifestFiles: string[];
	missingRequiredGraphFiles: string[];
	symbolicReferences: {
		nodesWithoutSourceFile: number;
		packages: number;
		scss: number;
		images: number;
	};
}

export function computeCorpusHealth(manifest: unknown, graph: JsonObject): CorpusHealth {
	const files = manifestFiles(manifest);
	const sourceFiles = graphSourceFiles(graph);
	const nodes = (graph.nodes as JsonObject[]) ?? [];
	const sourceFileNodes = nodes.filter((node) => normalizeCorpusPath(node.source_file));
	const sqlManifest = sqlFiles(files);
	const sqlNodeFiles = sqlFiles(sourceFiles);
	const nodeSourceFiles = [...sourceFiles].sort();

	return {
		schemaVersion: 1,
		manifestFileCount: files.length,
		nodeCount: nodes.length,
		sourceFileNodeCount: sourceFileNodes.length,
		filesWithNodes: files.filter((file) => sourceFiles.has(file)).length,
		filesWithoutNodes: files.filter((file) => !sourceFiles.has(file)),
		graphOnlySourceFiles: nodeSourceFiles.filter((file) => !files.includes(file)),
		manifestFilesByRoot: countBy(files.map(rootOf)),
		manifestFilesByExtension: countBy(files.map(extensionOf)),
		nodesByRoot: countBy(
			sourceFileNodes.map((node) => rootOf(normalizeCorpusPath(node.source_file))),
		),
		nodesByExtension: countBy(
			sourceFileNodes.map((node) => extensionOf(normalizeCorpusPath(node.source_file))),
		),
		sql: {
			manifestFiles: sqlManifest.length,
			filesWithNodes: sqlNodeFiles.length,
			nodes: sourceFileNodes.filter((node) =>
				normalizeCorpusPath(node.source_file).toLowerCase().endsWith(SQL_EXTENSION),
			).length,
			coverageRatio: sqlManifest.length === 0 ? 1 : sqlNodeFiles.length / sqlManifest.length,
		},
		forbiddenManifestFiles: forbiddenCorpusFiles(files),
		forbiddenGraphSourceFiles: forbiddenCorpusFiles(sourceFiles),
		missingRequiredManifestFiles: REQUIRED_CORPUS_FILES.filter((file) => !files.includes(file)),
		missingRequiredGraphFiles: REQUIRED_CORPUS_FILES.filter((file) => !sourceFiles.has(file)),
		symbolicReferences: {
			nodesWithoutSourceFile: nodes.length - sourceFileNodes.length,
			packages: nodes.filter((node) => {
				if (normalizeCorpusPath(node.source_file)) return false;
				return PACKAGE_PATTERN.test(String(node.id ?? node.label ?? ''));
			}).length,
			scss: sourceFileNodes.filter(
				(node) => extensionOf(normalizeCorpusPath(node.source_file)) === '.scss',
			).length,
			images: nodes.filter((node) =>
				IMAGE_EXTENSIONS.has(extensionOf(normalizeCorpusPath(node.source_file))),
			).length,
		},
	};
}

export function assertCorpusContract(health: CorpusHealth): void {
	const failures: string[] = [];
	if (health.forbiddenManifestFiles.length > 0) {
		failures.push(`forbidden files in manifest: ${health.forbiddenManifestFiles.join(', ')}`);
	}
	if (health.forbiddenGraphSourceFiles.length > 0) {
		failures.push(
			`forbidden graph source files: ${health.forbiddenGraphSourceFiles.join(', ')}`,
		);
	}
	if (health.missingRequiredManifestFiles.length > 0) {
		failures.push(
			`required files missing from manifest: ${health.missingRequiredManifestFiles.join(', ')}`,
		);
	}
	if (health.missingRequiredGraphFiles.length > 0) {
		failures.push(
			`required files missing from graph: ${health.missingRequiredGraphFiles.join(', ')}`,
		);
	}
	if (health.sql.manifestFiles > 0 && health.sql.filesWithNodes === 0) {
		failures.push(
			'SQL files are present in the manifest but no SQL source files generated graph nodes',
		);
	}
	if (failures.length > 0) {
		throw new Error(`Graphify corpus contract failed:\n- ${failures.join('\n- ')}`);
	}
}

export function graphifyIgnoreSha256(root: string): string {
	return createHash('sha256')
		.update(readFileSync(path.join(root, '.graphifyignore')))
		.digest('hex');
}
