/**
 * Deterministic fingerprints for Local Render Corpus observability freshness.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
	EXPECTED_LOCAL_RENDER_CORPUS_SIZE,
	listLocalRenderCorpus,
} from '../provision/local-render-corpus/registry.ts';
import type { ObservabilityFingerprints } from './types.ts';

const PROJECT_ROOT = process.cwd();

const INPUT_PATHS = [
	'scripts/provision/local-render-corpus/registry.ts',
	'scripts/provision/local-render-corpus/content.ts',
	'scripts/provision/local-render-corpus/screenshot-pages.ts',
	'scripts/provision/local-render-corpus/fixtures',
	'tests/provision/local-render-corpus-regression.test.ts',
] as const;

function sha256Hex(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

function hashFileContents(absPath: string): string {
	return createHash('sha256').update(readFileSync(absPath)).digest('hex');
}

function collectFilesRecursive(absDir: string): string[] {
	if (!existsSync(absDir)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(absDir, { withFileTypes: true })) {
		const child = join(absDir, entry.name);
		if (entry.isDirectory()) {
			out.push(...collectFilesRecursive(child));
		} else if (entry.isFile()) {
			out.push(child);
		}
	}
	return out.sort();
}

function hashPathInput(relPath: string): string {
	const abs = resolve(PROJECT_ROOT, relPath);
	if (!existsSync(abs)) {
		return `${relPath}:MISSING`;
	}
	const st = statSync(abs);
	if (st.isDirectory()) {
		const files = collectFilesRecursive(abs);
		const parts = files.map((file) => {
			const rel = relative(PROJECT_ROOT, file).replace(/\\/g, '/');
			return `${rel}:${hashFileContents(file)}`;
		});
		return `${relPath}:DIR:${sha256Hex(parts.join('\n'))}`;
	}
	return `${relPath}:${hashFileContents(abs)}`;
}

/** Stable fingerprint of the Local Render Corpus registry membership + strategies. */
export function computeCorpusFingerprint(): string {
	const corpus = listLocalRenderCorpus();
	const lines = [
		`size:${EXPECTED_LOCAL_RENDER_CORPUS_SIZE}`,
		...corpus.map((entry) =>
			[
				entry.slug,
				entry.eventType,
				entry.classification,
				entry.sourceStrategy,
				entry.assetStrategy,
				entry.themeId ?? '',
				entry.visualProfileId ?? '',
				entry.fixtureFile ?? '',
			].join('|'),
		),
	];
	return sha256Hex(lines.join('\n'));
}

/** Hash of code + fixture inputs that affect regression / screenshot evidence. */
export function computeInputFingerprint(): string {
	const parts = INPUT_PATHS.map((p) => hashPathInput(p));
	return sha256Hex(parts.join('\n'));
}

export function computeObservabilityFingerprints(): ObservabilityFingerprints {
	return {
		corpusFingerprint: computeCorpusFingerprint(),
		inputFingerprint: computeInputFingerprint(),
	};
}
