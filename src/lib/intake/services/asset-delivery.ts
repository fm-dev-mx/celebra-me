/**
 * Provider-aware invitation asset delivery URL resolution.
 * Identity is asset UUID / semantic key; delivery URL is derived from provider metadata.
 */

import { getPublicUrl } from '@/lib/intake/storage';

export type AssetDeliveryProvider = 'supabase' | 'cloudinary';

export interface AssetDeliverySource {
	id?: string;
	provider?: AssetDeliveryProvider | string | null;
	bucket: string;
	storagePath: string;
	providerPublicId?: string | null;
	secureUrl?: string | null;
}

export class AssetDeliveryResolutionError extends Error {
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

/**
 * Resolve a public delivery URL for an invitation asset.
 * Cloudinary must never be overridden by a generated Supabase Storage URL.
 */
export function resolveAssetDeliveryUrl(asset: AssetDeliverySource): string {
	const provider = (asset.provider ?? 'supabase').toLowerCase();

	if (provider === 'cloudinary') {
		const secure = asset.secureUrl?.trim();
		if (secure && isHttpUrl(secure)) return secure;

		const publicId = (asset.providerPublicId ?? asset.storagePath)?.trim();
		if (!publicId) {
			throw new AssetDeliveryResolutionError(
				'Cloudinary asset is missing secure_url and provider_public_id.',
				{ assetId: asset.id, provider },
			);
		}

		const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
		if (!cloudName) {
			throw new AssetDeliveryResolutionError(
				'Cloudinary asset cannot be resolved without CLOUDINARY_CLOUD_NAME or secure_url.',
				{ assetId: asset.id, provider, publicId },
			);
		}

		const normalizedId = publicId.replace(/^\/+/, '').replace(/\.webp$/i, '');
		return `https://res.cloudinary.com/${cloudName}/image/upload/v1/${normalizedId}.webp`;
	}

	if (provider === 'supabase') {
		if (!asset.bucket?.trim() || !asset.storagePath?.trim()) {
			throw new AssetDeliveryResolutionError(
				'Supabase asset is missing bucket or storage_path.',
				{ assetId: asset.id, provider },
			);
		}
		return getPublicUrl(asset.bucket, asset.storagePath);
	}

	throw new AssetDeliveryResolutionError(`Unsupported asset provider "${provider}".`, {
		assetId: asset.id,
		provider,
	});
}

/**
 * Prefer a valid frozen Cloudinary (or any https) src on an uploaded ref over a
 * newly derived URL only when the derived URL would be a Supabase override of Cloudinary.
 * Identity remains assetId; this helper chooses delivery.
 */
export function preferUploadedDeliverySrc(input: {
	asset: AssetDeliverySource;
	frozenSrc?: string | null;
}): string {
	const derived = resolveAssetDeliveryUrl(input.asset);
	const frozen = input.frozenSrc?.trim();
	if (!frozen || !isHttpUrl(frozen)) return derived;

	const provider = (input.asset.provider ?? 'supabase').toLowerCase();
	if (provider === 'cloudinary') {
		// Never let a Supabase-generated URL win over a valid Cloudinary frozen src.
		if (frozen.includes('res.cloudinary.com')) return frozen;
		if (derived.includes('res.cloudinary.com')) return derived;
		return frozen;
	}

	return derived;
}
