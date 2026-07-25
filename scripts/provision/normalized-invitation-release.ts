/** Environment-neutral managed invitation release builder. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { normalizeInvitationImage, extractBlobRawBytes } from '../../src/lib/intake/services/asset-policy.ts';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import { getInvitationDefinition } from './invitations/registry.ts';
import type { InvitationDefinition, UploadedAssetMap, UploadedAssetRef } from './invitations/invitation-definition.ts';
import { resolveLocalEnv } from './local-provision-env.ts';

export const RELEASE_SCHEMA_VERSION = '2.0.0';
export const ASSET_KEY_PREFIX = '__INVITATION_ASSET_KEY__:';
export const STORAGE_URL_PLACEHOLDER = '__STORAGE_URL__';

export interface NormalizedInvitationAsset {
	key: string; displayName: string; alt: string; focalPoint?: Record<string, string>;
	bytes: Uint8Array; dataBase64: string; sha256: string; mimeType: string;
	width: number; height: number; fileSize: number; validationVersion: number;
	originalMimeType: string; originalFileSize: number;
}
export interface NormalizedInvitationRelease {
	schemaVersion: string; slug: string; definitionCreatedAt: string;
	sourceHash: string; metadataHash: string; projectionHash: string; assetManifestHash: string;
	metadata: { title: string; eventType: string; baseDemoId: string; themeId: string; visualProfileId: string; clientName: string; clientEmail: string; clientWhatsapp: string; photosReceived: boolean; snapshot: Record<string, unknown> };
	draftContent: Record<string, unknown>; publishedProjection: Record<string, unknown>; assets: NormalizedInvitationAsset[];
}
export function canonicalize(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}
function hash(value: unknown): string {
	if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
		return createHash('sha256').update(value).digest('hex');
	}
	return createHash('sha256').update(typeof value === 'string' ? value : canonicalize(value)).digest('hex');
}
export function semanticAssetRef(key: string): UploadedAssetRef { return { type: 'uploaded', assetId: `${ASSET_KEY_PREFIX}${key}`, src: `${STORAGE_URL_PLACEHOLDER}/${ASSET_KEY_PREFIX}${key}` }; }
export function buildSemanticAssetMap(definition: InvitationDefinition): UploadedAssetMap { return Object.fromEntries(definition.assets.map((asset) => [asset.key, semanticAssetRef(asset.key)])); }
import { buildCloudinaryOgImageUrl } from './cloudinary-adapter.ts';

export function materializeAssetReferences(
	value: unknown,
	assets: Record<string, UploadedAssetRef>,
	parentKey?: string,
): unknown {
	if (Array.isArray(value)) return value.map((item) => materializeAssetReferences(item, assets, parentKey));
	if (value !== null && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		if (record.type === 'uploaded' && typeof record.assetId === 'string' && record.assetId.startsWith(ASSET_KEY_PREFIX)) {
			const key = record.assetId.slice(ASSET_KEY_PREFIX.length);
			const ref = assets[key];
			if (!ref) throw new Error(`No target asset mapping exists for semantic key "${record.assetId}".`);
			if (parentKey === 'ogImage' && ref.src.includes('cloudinary.com')) {
				return { ...ref, src: buildCloudinaryOgImageUrl(ref.src) };
			}
			return ref;
		}
		return Object.fromEntries(
			Object.entries(record).map(([k, item]) => [k, materializeAssetReferences(item, assets, k)]),
		);
	}
	return value;
}

/** Load assets from the persistent-local Supabase DB and Storage (no sourceDir provided). */
async function loadPersistedAssets(
	slug: string,
	specs: InvitationDefinition['assets'],
): Promise<NormalizedInvitationAsset[]> {
	const env = resolveLocalEnv();
	const supabase = createClient(env.apiUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
	const { data: inv } = await supabase.from('invitations').select('id').eq('slug', slug).is('archived_at', null).maybeSingle();
	if (!inv?.id) throw new Error(`No persistent-local invitation found for slug "${slug}" and no sourceDir provided.`);

	const { data: dbAssets } = await supabase.from('invitation_assets').select('*').eq('invitation_id', inv.id).is('deleted_at', null);
	if (!dbAssets || dbAssets.length === 0) throw new Error(`No persisted invitation assets found for slug "${slug}".`);

	const dbAssetMap = new Map((dbAssets as Array<Record<string, unknown>>).map((r) => [r.display_name as string, r]));
	const assets: NormalizedInvitationAsset[] = [];

	for (const spec of specs) {
		const match = dbAssetMap.get(spec.displayName);
		if (!match) throw new Error(`Missing persisted asset matching displayName "${spec.displayName}" for key "${spec.key}".`);

		const storagePath = match.storage_path as string;
		const { data: fileData, error } = await supabase.storage.from('invitation-assets').download(storagePath);
		if (error || !fileData) throw new Error(`Failed to download persisted storage object "${storagePath}" for asset "${spec.key}": ${error?.message}`);

		const bytes = new Uint8Array(await fileData.arrayBuffer());
		assets.push({
			key: spec.key,
			displayName: spec.displayName,
			alt: spec.alt,
			focalPoint: spec.focalPoint,
			bytes,
			dataBase64: Buffer.from(bytes).toString('base64'),
			sha256: hash(bytes),
			mimeType: match.mime_type as string,
			width: Number(match.width),
			height: Number(match.height),
			fileSize: Number(match.file_size),
			validationVersion: Number(match.validation_version ?? 1),
			originalMimeType: (match.original_mime_type as string) || (match.mime_type as string),
			originalFileSize: Number(match.original_file_size ?? match.file_size),
		});
	}
	return assets;
}

import { detectFileMimeType } from '../../src/lib/intake/services/asset-policy.ts';
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';

import { getInvitationAssetSourceDir } from './invitations/invitation-definition.ts';

export async function buildNormalizedInvitationRelease(options: { slug: string; sourceDir?: string }): Promise<NormalizedInvitationRelease> {
	const definition = getInvitationDefinition(options.slug);
	let assets: NormalizedInvitationAsset[];

	const effectiveSourceDir = options.sourceDir || getInvitationAssetSourceDir(definition);
	const resolvedRoot = resolve(effectiveSourceDir);

	if (existsSync(resolvedRoot) && statSync(resolvedRoot).isDirectory()) {
		const root = resolvedRoot;
		assets = [];
		for (const asset of definition.assets) {
			const source = resolve(root, asset.relativePath);
			if (!source.startsWith(`${root}${sep}`) || !existsSync(source) || !statSync(source).isFile()) throw new Error(`Declared asset "${asset.key}" is missing or escapes the asset root.`);
			const sourceBytes = readFileSync(source);
			const declaredMime = detectFileMimeType(asset.relativePath, sourceBytes);
			const normalized = await normalizeInvitationImage(new Blob([Uint8Array.from(sourceBytes)], { type: declaredMime }), declaredMime);
			const raw = await extractBlobRawBytes(normalized.blob);
			if (!raw) throw new Error('Could not extract bytes from Blob.');
			const bytes = raw;
			assets.push({ key: asset.key, displayName: asset.displayName, alt: asset.alt, focalPoint: asset.focalPoint, bytes, dataBase64: Buffer.from(bytes).toString('base64'), sha256: hash(bytes), mimeType: normalized.mimeType, width: normalized.width, height: normalized.height, fileSize: normalized.fileSize, validationVersion: normalized.validationVersion, originalMimeType: normalized.originalMimeType, originalFileSize: normalized.originalFileSize });
		}
	} else if (options.sourceDir) {
		throw new Error(`Invitation asset root does not exist: ${resolvedRoot}`);
	} else {
		assets = await loadPersistedAssets(options.slug, definition.assets);
	}

	assets.sort((a, b) => a.key.localeCompare(b.key));
	const snapshot = findDemoPreset(definition.baseDemoId);
	if (!snapshot || snapshot.themeId !== definition.themeId) throw new Error(`Definition has invalid preset/theme pairing: ${definition.baseDemoId}.`);
	const metadata = { title: definition.title, eventType: definition.eventType, baseDemoId: definition.baseDemoId, themeId: definition.themeId, visualProfileId: definition.visualProfileId, clientName: definition.clientName, clientEmail: definition.clientEmail ?? '', clientWhatsapp: definition.clientWhatsapp ?? '', photosReceived: definition.photosReceived ?? true, snapshot: snapshot as unknown as Record<string, unknown> };
	const draftContent = definition.buildPublishedContent(buildSemanticAssetMap(definition));

	const canonicalValidation = eventContentSchema.safeParse(draftContent);
	if (!canonicalValidation.success) {
		const issues = canonicalValidation.error.issues
			.map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`)
			.join('; ');
		throw new Error(`Managed invitation "${definition.slug}" failed canonical publication validation: ${issues}`);
	}

	const assetManifestHash = hash(assets.map(({ bytes: _bytes, dataBase64: _data, ...asset }) => asset));
	const metadataHash = hash(metadata);
	const projectionHash = hashPublicationProjection(draftContent);
	const sourceHash = hash({ schemaVersion: RELEASE_SCHEMA_VERSION, slug: definition.slug, createdAt: definition.createdAt, metadata, draftContent, assetManifestHash });
	return { schemaVersion: RELEASE_SCHEMA_VERSION, slug: definition.slug, definitionCreatedAt: definition.createdAt, sourceHash, metadataHash, projectionHash, assetManifestHash, metadata, draftContent, publishedProjection: draftContent, assets };
}
