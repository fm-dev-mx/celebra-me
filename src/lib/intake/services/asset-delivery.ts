/**
 * Provider-aware invitation asset delivery URL resolution.
 * Identity is asset UUID / semantic key; delivery URL is derived from provider metadata.
 */

import { getPublicUrl } from '@/lib/intake/storage';

type AssetDeliveryProvider = 'supabase' | 'r2';

export interface AssetDeliverySource {
	id?: string;
	provider?: AssetDeliveryProvider | string | null;
	bucket: string;
	storagePath: string;
	providerPublicId?: string | null;
	secureUrl?: string | null;
}

class AssetDeliveryResolutionError extends Error {
	readonly code = 'asset_delivery_unresolved';

	constructor(
		message: string,
		readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'AssetDeliveryResolutionError';
	}
}

function isHttpUrl(value: string): boolean {
	return /^https?:\/\//i.test(value.trim());
}

function resolveR2AssetUrl(asset: AssetDeliverySource, provider: string): string {
	const secure = asset.secureUrl?.trim();
	if (secure && isHttpUrl(secure)) return secure;
	throw new AssetDeliveryResolutionError('R2 asset is missing secure_url.', {
		assetId: asset.id,
		provider,
	});
}

function resolveSupabaseAssetUrl(asset: AssetDeliverySource, provider: string): string {
	const secure = asset.secureUrl?.trim();
	if (secure && isHttpUrl(secure)) return secure;

	if (!asset.bucket?.trim() || !asset.storagePath?.trim()) {
		throw new AssetDeliveryResolutionError(
			'Supabase asset is missing bucket or storage_path.',
			{ assetId: asset.id, provider },
		);
	}
	return getPublicUrl(asset.bucket, asset.storagePath);
}

/**
 * Resolve a public delivery URL for an invitation asset.
 * R2 must never be overridden by a generated Supabase Storage URL.
 */
export function resolveAssetDeliveryUrl(asset: AssetDeliverySource): string {
	const provider = (asset.provider ?? 'supabase').toLowerCase();

	if (provider === 'r2') {
		return resolveR2AssetUrl(asset, provider);
	}

	if (provider === 'supabase') {
		return resolveSupabaseAssetUrl(asset, provider);
	}

	throw new AssetDeliveryResolutionError(`Unsupported asset provider "${provider}".`, {
		assetId: asset.id,
		provider,
	});
}

/**
 * Delivery src for an uploaded ref: always the URL derived from the asset row, never a
 * frozen src copied into content. Identity remains assetId; this helper chooses delivery.
 */
export function preferUploadedDeliverySrc(input: {
	asset: AssetDeliverySource;
	frozenSrc?: string | null;
}): string {
	// R2 rows always carry their content-addressed secure_url.
	return resolveAssetDeliveryUrl(input.asset);
}
