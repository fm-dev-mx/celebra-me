import type { ImageDelivery } from '@/lib/assets/image-delivery';
import type { AssetRegistryKey } from '@/lib/assets/asset-keys';

export interface InternalAssetSource {
	delivery?: ImageDelivery;
	type: 'internal';
	key: AssetRegistryKey;
}

export interface ExternalAssetSource {
	delivery?: ImageDelivery;
	type: 'external';
	src: string;
}

/**
 * Draft/editable uploaded asset reference.
 * `assetId` references invitation_assets.id.
 * `src` is NOT present — must be resolved at preview/publish time.
 */
export interface DraftUploadedAssetSource {
	delivery?: ImageDelivery;
	type: 'uploaded';
	assetId: string;
}

/**
 * Published frozen uploaded asset reference.
 * `assetId` preserved for audit/re-resolution.
 * `src` is the resolved public Storage URL at publish time.
 */
export interface PublishedUploadedAssetSource {
	delivery?: ImageDelivery;
	type: 'uploaded';
	assetId: string;
	src: string;
}

/**
 * Union of all asset source types that may appear in editable/draft content.
 * Published content resolves uploaded refs to `PublishedUploadedAssetSource`.
 */
export type EditableAssetSource =
	InternalAssetSource | ExternalAssetSource | DraftUploadedAssetSource;

/**
 * General-purpose asset source union (covers both editable and published forms).
 * Use `EditableAssetSource` for the narrower draft contract.
 */
export type AssetSource =
	| InternalAssetSource
	| ExternalAssetSource
	| DraftUploadedAssetSource
	| PublishedUploadedAssetSource;

export type AssetField = string | EditableAssetSource | undefined;
