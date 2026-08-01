/**
 * Repository + fixture asset health for the Local Render Corpus.
 * Does not download remote binaries.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
	listLocalRenderCorpus,
	type CorpusAssetStrategy,
	type LocalRenderCorpusEntry,
} from '../provision/local-render-corpus/registry.ts';
import { loadLegacyCorpusFixture } from '../provision/local-render-corpus/load-fixture.ts';
import type { AssetHealthRow, AssetHealthState } from './types.ts';

const PROJECT_ROOT = process.cwd();
const ASSETS_ROOT = resolve(PROJECT_ROOT, 'src/assets/invitations');

const REMOTE_URL_RE = /https?:\/\//i;
const LOCAL_ASSET_HINT_RE =
	/(?:src\/assets\/invitations\/|@\/assets\/invitations\/|assets\/invitations\/|\/invitations\/[a-z0-9-]+\/)/i;

function countFilesRecursive(dir: string): number {
	if (!existsSync(dir)) return 0;
	let count = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const child = join(dir, entry.name);
		if (entry.isDirectory()) {
			count += countFilesRecursive(child);
		} else if (entry.isFile()) {
			count += 1;
		}
	}
	return count;
}

function walkStrings(value: unknown, visit: (s: string) => void): void {
	if (typeof value === 'string') {
		visit(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) walkStrings(item, visit);
		return;
	}
	if (value && typeof value === 'object') {
		for (const child of Object.values(value as Record<string, unknown>)) {
			walkStrings(child, visit);
		}
	}
}

function isMediaishRemoteUrl(url: string): boolean {
	if (!REMOTE_URL_RE.test(url)) return false;
	const lower = url.toLowerCase();
	// Skip maps / registry / commercial links — focus on deliverable media.
	if (
		lower.includes('google.com/maps') ||
		lower.includes('maps.apple.com') ||
		lower.includes('maps.app.goo.gl') ||
		lower.includes('liverpool.com') ||
		lower.includes('amazon.com') ||
		lower.includes('sears.com')
	) {
		return false;
	}
	return (
		lower.includes('cloudinary.com') ||
		lower.includes('/storage/v1/object/') ||
		lower.includes('invitation-assets') ||
		/\.(mp3|m4a|wav|ogg|webp|jpe?g|png|gif|mp4|webm)(\?|$)/i.test(lower)
	);
}

export function analyzePublishedContentMedia(publishedContent: Record<string, unknown>): {
	remoteMediaReferenceCount: number;
	localAssetKeyReferenceCount: number;
} {
	let remoteMediaReferenceCount = 0;
	let localAssetKeyReferenceCount = 0;
	walkStrings(publishedContent, (s) => {
		if (isMediaishRemoteUrl(s)) {
			remoteMediaReferenceCount += 1;
			return;
		}
		if (LOCAL_ASSET_HINT_RE.test(s) || (!REMOTE_URL_RE.test(s) && s.includes('gallery-'))) {
			localAssetKeyReferenceCount += 1;
		}
	});
	return { remoteMediaReferenceCount, localAssetKeyReferenceCount };
}

function classifyAssetStatus(input: {
	strategy: CorpusAssetStrategy;
	localFileCount: number;
	remoteMediaReferenceCount: number;
	localAssetKeyReferenceCount: number;
}): { status: AssetHealthState; detail: string } {
	const { strategy, localFileCount, remoteMediaReferenceCount, localAssetKeyReferenceCount } =
		input;

	if (strategy === 'VERSIONED_MANAGED_ASSET') {
		if (localFileCount > 0) {
			return { status: 'OK', detail: `${localFileCount} versioned managed asset file(s)` };
		}
		return { status: 'MISSING', detail: 'No files under src/assets/invitations/{slug}' };
	}

	if (strategy === 'VERSIONED_LOCAL_ASSET') {
		if (localFileCount > 0) {
			return { status: 'OK', detail: `${localFileCount} local asset file(s)` };
		}
		return { status: 'MISSING', detail: 'Expected local assets missing' };
	}

	// HYBRID_VERSIONED_AND_REMOTE
	if (remoteMediaReferenceCount > 0 && localFileCount === 0 && localAssetKeyReferenceCount === 0) {
		return {
			status: 'REMOTE_REFERENCE',
			detail: `${remoteMediaReferenceCount} remote media reference(s); no local inventory`,
		};
	}
	if (remoteMediaReferenceCount > 0 && localFileCount > 0) {
		return {
			status: 'PARTIAL',
			detail: `Hybrid: ${localFileCount} local file(s) + ${remoteMediaReferenceCount} remote ref(s)`,
		};
	}
	if (remoteMediaReferenceCount > 0) {
		return {
			status: 'REMOTE_REFERENCE',
			detail: `${remoteMediaReferenceCount} remote media reference(s)`,
		};
	}
	if (localFileCount > 0 || localAssetKeyReferenceCount > 0) {
		return {
			status: 'OK',
			detail: `${localFileCount} local file(s); ${localAssetKeyReferenceCount} local key ref(s)`,
		};
	}
	return { status: 'UNVERIFIED', detail: 'No local inventory or remote media references detected' };
}

function evaluateEntry(
	entry: LocalRenderCorpusEntry,
	dbAssetCountBySlug?: ReadonlyMap<string, number | null>,
): AssetHealthRow {
	const assetDir = resolve(ASSETS_ROOT, entry.slug);
	const localFileCount = existsSync(assetDir) && statSync(assetDir).isDirectory()
		? countFilesRecursive(assetDir)
		: 0;

	let remoteMediaReferenceCount = 0;
	let localAssetKeyReferenceCount = 0;

	if (entry.classification === 'legacy' && entry.fixtureFile) {
		try {
			const fixture = loadLegacyCorpusFixture(entry);
			const media = analyzePublishedContentMedia(fixture.publishedContent);
			remoteMediaReferenceCount = media.remoteMediaReferenceCount;
			localAssetKeyReferenceCount = media.localAssetKeyReferenceCount;
		} catch {
			return {
				slug: entry.slug,
				assetStrategy: entry.assetStrategy,
				status: 'UNVERIFIED',
				localFileCount,
				remoteMediaReferenceCount: 0,
				localAssetKeyReferenceCount: 0,
				dbAssetCount: dbAssetCountBySlug?.get(entry.slug) ?? null,
				detail: 'Fixture media analysis failed',
			};
		}
	}

	const { status, detail } = classifyAssetStatus({
		strategy: entry.assetStrategy,
		localFileCount,
		remoteMediaReferenceCount,
		localAssetKeyReferenceCount,
	});

	return {
		slug: entry.slug,
		assetStrategy: entry.assetStrategy,
		status,
		localFileCount,
		remoteMediaReferenceCount,
		localAssetKeyReferenceCount,
		dbAssetCount: dbAssetCountBySlug?.get(entry.slug) ?? null,
		detail,
	};
}

export function evaluateAssetHealth(
	dbAssetCountBySlug?: ReadonlyMap<string, number | null>,
): AssetHealthRow[] {
	const rows: AssetHealthRow[] = [];
	for (const entry of listLocalRenderCorpus()) {
		try {
			rows.push(evaluateEntry(entry, dbAssetCountBySlug));
		} catch {
			rows.push({
				slug: entry.slug,
				assetStrategy: entry.assetStrategy,
				status: 'UNVERIFIED',
				localFileCount: 0,
				remoteMediaReferenceCount: 0,
				localAssetKeyReferenceCount: 0,
				dbAssetCount: dbAssetCountBySlug?.get(entry.slug) ?? null,
				detail: 'Asset classifier failure',
			});
		}
	}
	return rows;
}
