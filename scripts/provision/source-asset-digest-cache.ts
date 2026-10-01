/**
 * Content-addressed cache for normalized invitation asset digests.
 *
 * Status and promotion fingerprints need only the SHA-256 of each normalized asset, but computing it
 * re-encodes every source image with sharp on every run. The digest is a pure function of the source
 * bytes, the normalization inputs, and the normalizer itself, so it is cached under a key that binds
 * all of them. Uploads never read this cache; they always normalize the real bytes.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gitCommonPath } from '../shared/git-paths.ts';

const CACHE_RELATIVE = 'db-evidence/source-asset-digests.json';
const CACHE_VERSION = 1;

/** Modules whose behavior determines the normalized bytes. */
const NORMALIZER_SOURCES = [
	'src/lib/intake/services/asset-policy.ts',
	'src/lib/invitation-preparation/image-optimization.ts',
	'src/lib/intake/constants.ts',
];

let normalizerFingerprint: string | null = null;

/** Hash of the normalizer sources and the installed sharp/libvips build. */
export function currentNormalizerFingerprint(root: string = process.cwd()): string {
	if (normalizerFingerprint) return normalizerFingerprint;
	const hash = createHash('sha256');
	for (const relative of NORMALIZER_SOURCES) {
		const path = resolve(root, relative);
		hash.update(relative);
		hash.update('\0');
		hash.update(existsSync(path) ? readFileSync(path) : 'missing');
		hash.update('\n');
	}
	const sharpPackage = resolve(root, 'node_modules', 'sharp', 'package.json');
	hash.update(existsSync(sharpPackage) ? readFileSync(sharpPackage) : 'sharp-missing');
	normalizerFingerprint = hash.digest('hex');
	return normalizerFingerprint;
}

export interface SourceAssetDigestInput {
	sourceBytes: Uint8Array;
	declaredMime: string;
	optimizationRole?: string;
	sourcePolicy?: string;
}

export function sourceAssetDigestKey(input: SourceAssetDigestInput, normalizer: string): string {
	return createHash('sha256')
		.update(
			JSON.stringify([
				CACHE_VERSION,
				normalizer,
				createHash('sha256').update(input.sourceBytes).digest('hex'),
				input.declaredMime,
				input.optimizationRole ?? null,
				input.sourcePolicy ?? null,
			]),
		)
		.digest('hex');
}

export interface SourceAssetDigestCache {
	get(key: string): string | undefined;
	set(key: string, sha256: string): void;
	flush(): void;
}

/** File-backed cache; unreadable or foreign-version files start empty. Never throws on write. */
export function openSourceAssetDigestCache(
	path: string = gitCommonPath(CACHE_RELATIVE),
): SourceAssetDigestCache {
	let entries: Record<string, string> = {};
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
			version?: number;
			entries?: Record<string, string>;
		};
		if (parsed.version === CACHE_VERSION && parsed.entries) entries = parsed.entries;
	} catch {
		entries = {};
	}
	let dirty = false;
	return {
		get: (key) => entries[key],
		set: (key, sha256) => {
			if (entries[key] === sha256) return;
			entries[key] = sha256;
			dirty = true;
		},
		flush: () => {
			if (!dirty) return;
			try {
				mkdirSync(dirname(path), { recursive: true });
				const tmp = `${path}.${process.pid}.tmp`;
				writeFileSync(tmp, JSON.stringify({ version: CACHE_VERSION, entries }), 'utf8');
				renameSync(tmp, path);
				dirty = false;
			} catch {
				// A missing cache only costs a recomputation next time.
			}
		},
	};
}
