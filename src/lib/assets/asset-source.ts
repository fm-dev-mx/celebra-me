import type { AssetRegistryKey } from '@/lib/assets/asset-keys';

export interface InternalAssetSource {
	type: 'internal';
	key: AssetRegistryKey;
}

export interface ExternalAssetSource {
	type: 'external';
	src: string;
}

/**
 * Draft/editable uploaded asset reference.
 * `assetId` references invitation_assets.id.
 * `src` is NOT present — must be resolved at preview/publish time.
 */
export interface DraftUploadedAssetSource {
	type: 'uploaded';
	assetId: string;
}

/**
 * Published frozen uploaded asset reference.
 * `assetId` preserved for audit/re-resolution.
 * `src` is the resolved public Storage URL at publish time.
 */
export interface PublishedUploadedAssetSource {
	type: 'uploaded';
	assetId: string;
	src: string;
}

/**
 * Union of all asset source types that may appear in editable/draft content.
 * Published content uses the resolved `PublishedAssetSource` union.
 */
export type EditableAssetSource =
	| InternalAssetSource
	| ExternalAssetSource
	| DraftUploadedAssetSource;

/**
 * Union of all asset source types that may appear in published content.
 * Uploaded refs always carry a frozen `src`.
 */
export type PublishedAssetSource =
	| InternalAssetSource
	| ExternalAssetSource
	| PublishedUploadedAssetSource;

/**
 * General-purpose asset source union (covers both editable and published forms).
 * Use `EditableAssetSource` or `PublishedAssetSource` for narrower contracts.
 */
export type AssetSource =
	| InternalAssetSource
	| ExternalAssetSource
	| DraftUploadedAssetSource
	| PublishedUploadedAssetSource;

export type AssetField = string | EditableAssetSource | undefined;
