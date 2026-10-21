/**
 * Media manifests for frozen invitations.
 *
 * Frozen client invitations no longer keep their image binaries in Git. Each asset directory holds a
 * `media-manifest.json` with the normalized digest and the metadata that feeds sourceHash and
 * packageHash. The normalized bytes live in R2 under content-addressed keys
 * (`<key>-<sha256>.<ext>`); readers download them, verify the sha256, and keep a local copy so the
 * same object is fetched once per machine. The normalizer never runs again on these bytes.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
	buildR2ObjectKey,
	R2_INVITATION_MEDIA,
} from '../../src/lib/intake/services/r2-invitation-media.ts';
import { gitCommonPath } from '../shared/git-paths.ts';

export const MEDIA_MANIFEST_FILE = 'media-manifest.json';
export const MEDIA_MANIFEST_SCHEMA_VERSION = 1;

export interface InvitationMediaManifestEntry {
	key: string;
	relativePath: string;
	sha256: string;
	mimeType: string;
	width: number;
	height: number;
	fileSize: number;
	validationVersion: number;
	originalMimeType: string;
	originalFileSize: number;
	/** Digest of the source file before normalization; lets content guards recognize copies. */
	originalSha256: string;
}

export interface InvitationMediaManifest {
	schemaVersion: number;
	slug: string;
	eventType: string;
	assets: InvitationMediaManifestEntry[];
}

interface ManifestDefinition {
	slug: string;
	eventType: string;
	assets: ReadonlyArray<{ key: string; relativePath: string }>;
}

const SHA256 = /^[a-f0-9]{64}$/u;

export function readInvitationMediaManifest(root: string): InvitationMediaManifest | null {
	const path = join(root, MEDIA_MANIFEST_FILE);
	if (!existsSync(path)) return null;
	const manifest = JSON.parse(readFileSync(path, 'utf8')) as InvitationMediaManifest;
	if (manifest.schemaVersion !== MEDIA_MANIFEST_SCHEMA_VERSION)
		throw new Error(`${path}: unsupported media manifest schema ${manifest.schemaVersion}.`);
	for (const entry of manifest.assets) {
		if (!SHA256.test(entry.sha256) || !SHA256.test(entry.originalSha256))
			throw new Error(
				`${path}: asset "${entry.key}" needs sha256 and originalSha256 digests.`,
			);
	}
	return manifest;
}

/** The manifest must describe exactly the assets the definition declares, at the same paths. */
export function assertManifestMatchesDefinition(
	manifest: InvitationMediaManifest,
	definition: ManifestDefinition,
): Map<string, InvitationMediaManifestEntry> {
	if (manifest.slug !== definition.slug || manifest.eventType !== definition.eventType)
		throw new Error(
			`Media manifest for "${manifest.eventType}/${manifest.slug}" does not belong to "${definition.eventType}/${definition.slug}".`,
		);
	const entries = new Map(manifest.assets.map((entry) => [entry.key, entry]));
	const declared = new Set(definition.assets.map((asset) => asset.key));
	for (const asset of definition.assets) {
		const entry = entries.get(asset.key);
		if (!entry || entry.relativePath !== asset.relativePath)
			throw new Error(
				`Media manifest for "${definition.slug}" has no entry for asset "${asset.key}" (${asset.relativePath}).`,
			);
	}
	const extra = manifest.assets.filter((entry) => !declared.has(entry.key));
	if (extra.length)
		throw new Error(
			`Media manifest for "${definition.slug}" lists undeclared assets: ${extra.map((entry) => entry.key).join(', ')}.`,
		);
	return entries;
}

export function invitationMediaObjectKey(
	manifest: Pick<InvitationMediaManifest, 'slug' | 'eventType'>,
	entry: Pick<InvitationMediaManifestEntry, 'key' | 'sha256' | 'mimeType'>,
): string {
	return buildR2ObjectKey({
		eventType: manifest.eventType,
		slug: manifest.slug,
		key: entry.key,
		sha256: entry.sha256,
		mimeType: entry.mimeType,
	});
}

function defaultCacheDir(): string {
	const configured = process.env.CELEBRA_INVITATION_MEDIA_CACHE?.trim();
	if (configured) return resolve(configured);
	try {
		return gitCommonPath('invitation-media');
	} catch {
		return resolve('.cache', 'invitation-media');
	}
}

function sha256Of(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export interface InvitationMediaFetchOptions {
	cacheDir?: string;
	fetchImpl?: typeof fetch;
	/** Production first: every managed invitation is published there; Preview is the fallback. */
	origins?: readonly string[];
}

/** Normalized bytes of a manifest entry, verified against its sha256. */
export async function loadInvitationMediaBytes(
	manifest: Pick<InvitationMediaManifest, 'slug' | 'eventType'>,
	entry: Pick<InvitationMediaManifestEntry, 'key' | 'sha256' | 'mimeType'>,
	options: InvitationMediaFetchOptions = {},
): Promise<Uint8Array> {
	const cacheDir = options.cacheDir ?? defaultCacheDir();
	const cached = join(cacheDir, entry.sha256);
	if (existsSync(cached)) {
		const bytes = new Uint8Array(readFileSync(cached));
		if (sha256Of(bytes) === entry.sha256) return bytes;
	}
	const fetchImpl = options.fetchImpl ?? fetch;
	const origins = options.origins ?? [
		R2_INVITATION_MEDIA.production.origin,
		R2_INVITATION_MEDIA.preview.origin,
	];
	const objectKey = invitationMediaObjectKey(manifest, entry);
	const failures: string[] = [];
	for (const origin of origins) {
		const url = `${origin}/${objectKey}`;
		try {
			const response = await fetchImpl(url);
			if (!response.ok) {
				failures.push(`${url} → HTTP ${response.status}`);
				continue;
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			const actual = sha256Of(bytes);
			if (actual !== entry.sha256) {
				failures.push(`${url} → sha256 ${actual}`);
				continue;
			}
			mkdirSync(cacheDir, { recursive: true });
			const partial = `${cached}.${process.pid}.partial`;
			writeFileSync(partial, bytes);
			renameSync(partial, cached);
			return bytes;
		} catch (error) {
			failures.push(`${url} → ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	throw new Error(
		`Could not load invitation media "${manifest.slug}/${entry.key}" (${entry.sha256}): ${failures.join('; ')}`,
	);
}
