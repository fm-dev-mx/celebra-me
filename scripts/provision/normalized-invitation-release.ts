/** Environment-neutral managed invitation release builder. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
	detectFileMimeType,
	normalizeInvitationImage,
	extractBlobRawBytes,
	ROLE_AWARE_ASSET_POLICY_VERSION,
} from '../../src/lib/intake/services/asset-policy.ts';
import {
	getImageOptimizationRoleForPath,
	getWeightTargetBytes,
} from '../../src/lib/invitation-preparation/image-optimization.ts';
import { collectUploadedContentRefs } from '../../src/lib/invitation-preparation/uploaded-content-refs.ts';
import { findDemoPreset } from '../../src/lib/intake/demo-preset-catalog.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { buildCloudinaryOgImageUrl } from './cloudinary-adapter.ts';
import { getInvitationDefinition } from './invitations/registry.ts';
import {
	getInvitationAssetSourceDir,
	type InvitationDefinition,
	type UploadedAssetMap,
	type UploadedAssetRef,
} from './invitations/invitation-definition.ts';
import { resolveLocalEnv } from './local-provision-env.ts';

export const RELEASE_SCHEMA_VERSION = '2.0.0';
export const ASSET_KEY_PREFIX = '__INVITATION_ASSET_KEY__:';
export const STORAGE_URL_PLACEHOLDER = '__STORAGE_URL__';

export interface NormalizedInvitationAsset {
	key: string;
	displayName: string;
	alt: string;
	focalPoint?: Record<string, string>;
	bytes: Uint8Array;
	dataBase64: string;
	sha256: string;
	mimeType: string;
	width: number;
	height: number;
	fileSize: number;
	validationVersion: number;
	originalMimeType: string;
	originalFileSize: number;
}
export interface NormalizedInvitationRelease {
	schemaVersion: string;
	slug: string;
	definitionCreatedAt: string;
	sourceHash: string;
	metadataHash: string;
	projectionHash: string;
	assetManifestHash: string;
	metadata: {
		managedIdentityId: string;
		previousSlugs: string[];
		title: string;
		eventType: string;
		baseDemoId: string;
		themeId: string;
		visualProfileId: string;
		clientName: string;
		hostLoginAlias: string;
		clientEmail: string;
		clientWhatsapp: string;
		photosReceived: boolean;
		snapshot: Record<string, unknown>;
	};
	draftContent: Record<string, unknown>;
	publishedProjection: Record<string, unknown>;
	assets: NormalizedInvitationAsset[];
}
export function canonicalize(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
		.join(',')}}`;
}
function hash(value: unknown): string {
	if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
		return createHash('sha256').update(value).digest('hex');
	}
	return createHash('sha256')
		.update(typeof value === 'string' ? value : canonicalize(value))
		.digest('hex');
}

/** SHA-256 of the package MD5 projection hash. Provenance rows require 64-char hex. */
export function provenanceProjectionHash(md5ProjectionHash: string): string {
	return hash(md5ProjectionHash);
}
export function semanticAssetRef(key: string): UploadedAssetRef {
	return {
		type: 'uploaded',
		assetId: `${ASSET_KEY_PREFIX}${key}`,
		src: `${STORAGE_URL_PLACEHOLDER}/${ASSET_KEY_PREFIX}${key}`,
	};
}
export function buildSemanticAssetMap<K extends string>(
	definition: InvitationDefinition<K>,
): UploadedAssetMap<K> {
	return Object.fromEntries(
		definition.assets.map((asset) => [asset.key, semanticAssetRef(asset.key)]),
	) as UploadedAssetMap<K>;
}

export function materializeAssetReferences(
	value: unknown,
	assets: Record<string, UploadedAssetRef>,
	parentKey?: string,
): unknown {
	if (Array.isArray(value))
		return value.map((item) => materializeAssetReferences(item, assets, parentKey));
	if (value !== null && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		if (
			record.type === 'uploaded' &&
			typeof record.assetId === 'string' &&
			record.assetId.startsWith(ASSET_KEY_PREFIX)
		) {
			const key = record.assetId.slice(ASSET_KEY_PREFIX.length);
			const ref = assets[key];
			if (!ref)
				throw new Error(
					`No target asset mapping exists for semantic key "${record.assetId}".`,
				);
			if (parentKey === 'ogImage' && ref.src.includes('cloudinary.com')) {
				return { ...ref, src: buildCloudinaryOgImageUrl(ref.src) };
			}
			return ref;
		}
		return Object.fromEntries(
			Object.entries(record).map(([k, item]) => [
				k,
				materializeAssetReferences(item, assets, k),
			]),
		);
	}
	return value;
}

export function assertEncodedAssetsMeetPathRoleBudgets(
	content: Record<string, unknown>,
	assets: Array<Pick<NormalizedInvitationAsset, 'key' | 'fileSize' | 'validationVersion'>>,
): void {
	const byKey = new Map(assets.map((asset) => [asset.key, asset]));
	for (const ref of collectUploadedContentRefs(content)) {
		if (!ref.assetId.startsWith(ASSET_KEY_PREFIX)) continue;
		const key = ref.assetId.slice(ASSET_KEY_PREFIX.length);
		const asset = byKey.get(key);
		if (!asset) {
			throw new Error(
				`Published path "${ref.path}" references unknown encoded asset "${key}".`,
			);
		}
		if (asset.validationVersion < ROLE_AWARE_ASSET_POLICY_VERSION) continue;
		const role = getImageOptimizationRoleForPath(ref.path);
		const maxBytes = getWeightTargetBytes(role);
		if (asset.fileSize > maxBytes) {
			throw new Error(
				`Encoded asset "${key}" at "${ref.path}" exceeds its ${role} delivery budget (${asset.fileSize} > ${maxBytes}).`,
			);
		}
	}
}

/** Load assets from the persistent-local Supabase DB and Storage (no sourceDir provided). */
async function loadPersistedAssets(
	slug: string,
	specs: InvitationDefinition['assets'],
): Promise<NormalizedInvitationAsset[]> {
	const env = resolveLocalEnv();
	const supabase = createClient(env.apiUrl, env.serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	const { data: inv } = await supabase
		.from('invitations')
		.select('id')
		.eq('slug', slug)
		.is('archived_at', null)
		.maybeSingle();
	if (!inv?.id)
		throw new Error(
			`No persistent-local invitation found for slug "${slug}" and no sourceDir provided.`,
		);

	const { data: dbAssets } = await supabase
		.from('invitation_assets')
		.select('*')
		.eq('invitation_id', inv.id)
		.is('deleted_at', null);
	if (!dbAssets || dbAssets.length === 0)
		throw new Error(`No persisted invitation assets found for slug "${slug}".`);

	const dbAssetMap = new Map(
		(dbAssets as Array<Record<string, unknown>>).map((r) => [r.display_name as string, r]),
	);
	const assets: NormalizedInvitationAsset[] = [];

	for (const spec of specs) {
		const match = dbAssetMap.get(spec.displayName);
		if (!match)
			throw new Error(
				`Missing persisted asset matching displayName "${spec.displayName}" for key "${spec.key}".`,
			);

		const storagePath = match.storage_path as string;
		const { data: fileData, error } = await supabase.storage
			.from('invitation-assets')
			.download(storagePath);
		if (error || !fileData)
			throw new Error(
				`Failed to download persisted storage object "${storagePath}" for asset "${spec.key}": ${error?.message}`,
			);

		const bytes = new Uint8Array(await fileData.arrayBuffer());
		const validationVersion = Number(match.validation_version ?? 1);
		const fileSize = Number(match.file_size);
		if (
			spec.optimizationRole &&
			validationVersion >= ROLE_AWARE_ASSET_POLICY_VERSION &&
			fileSize > getWeightTargetBytes(spec.optimizationRole)
		) {
			throw new Error(
				`Persisted asset "${spec.key}" exceeds its ${spec.optimizationRole} delivery budget.`,
			);
		}
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
			fileSize,
			validationVersion,
			originalMimeType: (match.original_mime_type as string) || (match.mime_type as string),
			originalFileSize: Number(match.original_file_size ?? match.file_size),
		});
	}
	return assets;
}

export interface SourceAssetDigest {
	key: string;
	sha256: string;
}

/**
 * Local source-dir asset digests for promotional status. Never downloads Storage
 * and never retains normalized bytes after hashing.
 */
export async function loadSourceAssetDigests(
	definition: InvitationDefinition,
	sourceDir?: string,
): Promise<SourceAssetDigest[]> {
	const effectiveSourceDir = sourceDir || getInvitationAssetSourceDir(definition);
	const root = resolve(effectiveSourceDir);
	if (!existsSync(root) || !statSync(root).isDirectory()) {
		throw new Error(`Invitation asset root does not exist: ${effectiveSourceDir}`);
	}
	const digests: SourceAssetDigest[] = [];
	for (const asset of definition.assets) {
		const source = resolve(root, asset.relativePath);
		if (
			!source.startsWith(`${root}${sep}`) ||
			!existsSync(source) ||
			!statSync(source).isFile()
		) {
			throw new Error(`Declared asset "${asset.key}" is missing or escapes the asset root.`);
		}
		const sourceBytes = readFileSync(source);
		const declaredMime = detectFileMimeType(asset.relativePath, sourceBytes);
		const normalized = await normalizeInvitationImage(
			new Blob([sourceBytes], { type: declaredMime }),
			declaredMime,
			asset.optimizationRole,
		);
		const raw = await extractBlobRawBytes(normalized.blob);
		if (!raw) throw new Error('Could not extract bytes from Blob.');
		digests.push({ key: asset.key, sha256: hash(raw) });
	}
	digests.sort((left, right) => left.key.localeCompare(right.key));
	return digests;
}

export async function buildNormalizedInvitationRelease(options: {
	slug: string;
	sourceDir?: string;
}): Promise<NormalizedInvitationRelease> {
	const definition = getInvitationDefinition(options.slug);
	if (definition.managedIdentityProvenance === 'authoring-placeholder') {
		throw new Error(
			`Invitation "${definition.slug}" is authoring-only: replace its placeholder managed identity with the owner-verified persisted identity before building a release.`,
		);
	}
	let assets: NormalizedInvitationAsset[];

	const effectiveSourceDir = options.sourceDir || getInvitationAssetSourceDir(definition);
	const resolvedRoot = resolve(effectiveSourceDir);

	if (existsSync(resolvedRoot) && statSync(resolvedRoot).isDirectory()) {
		const root = resolvedRoot;
		assets = [];
		for (const asset of definition.assets) {
			const source = resolve(root, asset.relativePath);
			if (
				!source.startsWith(`${root}${sep}`) ||
				!existsSync(source) ||
				!statSync(source).isFile()
			)
				throw new Error(
					`Declared asset "${asset.key}" is missing or escapes the asset root.`,
				);
			const sourceBytes = readFileSync(source);
			const declaredMime = detectFileMimeType(asset.relativePath, sourceBytes);
			const normalized = await normalizeInvitationImage(
				new Blob([sourceBytes], { type: declaredMime }),
				declaredMime,
				asset.optimizationRole,
			);
			const raw = await extractBlobRawBytes(normalized.blob);
			if (!raw) throw new Error('Could not extract bytes from Blob.');
			const bytes = raw;
			assets.push({
				key: asset.key,
				displayName: asset.displayName,
				alt: asset.alt,
				focalPoint: asset.focalPoint,
				bytes,
				dataBase64: Buffer.from(bytes).toString('base64'),
				sha256: hash(bytes),
				mimeType: normalized.mimeType,
				width: normalized.width,
				height: normalized.height,
				fileSize: normalized.fileSize,
				validationVersion: normalized.validationVersion,
				originalMimeType: normalized.originalMimeType,
				originalFileSize: normalized.originalFileSize,
			});
		}
	} else if (options.sourceDir) {
		throw new Error(`Invitation asset root does not exist: ${resolvedRoot}`);
	} else {
		assets = await loadPersistedAssets(options.slug, definition.assets);
	}

	assets.sort((a, b) => a.key.localeCompare(b.key));
	const snapshot = findDemoPreset(definition.baseDemoId);
	if (!snapshot || snapshot.themeId !== definition.themeId)
		throw new Error(`Definition has invalid preset/theme pairing: ${definition.baseDemoId}.`);
	const metadata = {
		managedIdentityId: definition.managedIdentityId,
		previousSlugs: [...(definition.previousSlugs ?? [])].sort(),
		title: definition.title,
		eventType: definition.eventType,
		baseDemoId: definition.baseDemoId,
		themeId: definition.themeId,
		visualProfileId: definition.visualProfileId,
		clientName: definition.clientName,
		hostLoginAlias: definition.hostLoginAlias,
		clientEmail: definition.clientEmail ?? '',
		clientWhatsapp: definition.clientWhatsapp ?? '',
		photosReceived: definition.photosReceived ?? true,
		snapshot: snapshot as unknown as Record<string, unknown>,
	};
	const draftContent = definition.buildPublishedContent(buildSemanticAssetMap(definition));

	const canonicalValidation = eventContentSchema.safeParse(draftContent);
	if (!canonicalValidation.success) {
		const issues = canonicalValidation.error.issues
			.map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`)
			.join('; ');
		throw new Error(
			`Managed invitation "${definition.slug}" failed canonical publication validation: ${issues}`,
		);
	}

	assertEncodedAssetsMeetPathRoleBudgets(draftContent, assets);

	const assetManifestHash = hash(
		assets.map(({ bytes: _bytes, dataBase64: _data, ...asset }) => asset),
	);
	const metadataHash = hash(metadata);
	const projectionHash = hashPublicationProjection(draftContent);
	const sourceHash = hash({
		schemaVersion: RELEASE_SCHEMA_VERSION,
		slug: definition.slug,
		createdAt: definition.createdAt,
		metadata,
		draftContent,
		assetManifestHash,
	});
	return {
		schemaVersion: RELEASE_SCHEMA_VERSION,
		slug: definition.slug,
		definitionCreatedAt: definition.createdAt,
		sourceHash,
		metadataHash,
		projectionHash,
		assetManifestHash,
		metadata,
		draftContent,
		publishedProjection: draftContent,
		assets,
	};
}
