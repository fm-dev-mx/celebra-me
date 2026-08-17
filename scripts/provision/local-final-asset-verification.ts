/**
 * Pure Local final-asset verification helpers.
 *
 * Persistent-local SSOT hosts managed assets on Supabase Storage
 * (`provider: 'supabase'`). Cloudinary rows remain acceptable leftovers
 * after Prod→Local restore / content-only preserve.
 */

const LOCAL_STORAGE_HOSTS = new Set(['127.0.0.1', 'localhost']);

export function isLocalSupabaseDeliveryUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (!LOCAL_STORAGE_HOSTS.has(parsed.hostname)) return false;
		return parsed.pathname.includes('/storage/v1/object/public/');
	} catch {
		return false;
	}
}

export function isCloudinaryDeliveryUrl(url: string): boolean {
	return url.startsWith('https://res.cloudinary.com');
}

export function localManagedStoragePath(slug: string, key: string): string {
	return `managed/${slug}/${key}.webp`;
}

/** True when secure_url points at the expected managed object for this slug/key. */
export function isLocalManagedDeliveryUrl(
	url: string,
	input: { slug: string; key: string; bucket?: string },
): boolean {
	if (!isLocalSupabaseDeliveryUrl(url)) return false;
	const bucket = input.bucket ?? 'invitation-assets';
	const expectedPath = `/storage/v1/object/public/${bucket}/${localManagedStoragePath(input.slug, input.key)}`;
	try {
		return new URL(url).pathname === expectedPath;
	} catch {
		return false;
	}
}

export interface LocalFinalAssetRowAcceptanceInput {
	provider: string | null | undefined;
	secureUrl: string | null | undefined;
	sha256: string | null | undefined;
	expectedSha256: string;
	slug: string;
	key: string;
}

/**
 * Pure acceptance gate for Local final verification (before reachability fetch).
 * Accepts Local Supabase SSOT rows or Cloudinary leftovers.
 */
export function isAcceptableLocalFinalAssetRow(
	input: LocalFinalAssetRowAcceptanceInput,
): boolean {
	const secureUrl = typeof input.secureUrl === 'string' ? input.secureUrl : '';
	if (!secureUrl) return false;
	if (input.sha256 && input.sha256 !== input.expectedSha256) return false;

	const provider = input.provider ?? null;

	if (provider === 'cloudinary') {
		return isCloudinaryDeliveryUrl(secureUrl);
	}

	// Local SSOT + legacy absent provider with a local managed Storage URL.
	if (provider === 'supabase' || provider === null) {
		if (isLocalManagedDeliveryUrl(secureUrl, { slug: input.slug, key: input.key })) {
			return true;
		}
		// Legacy restore: absent/supabase-mislabelled Cloudinary leftover URL.
		if (provider === null && isCloudinaryDeliveryUrl(secureUrl)) {
			return true;
		}
		return false;
	}

	return false;
}

/** Content-only reuse: Cloudinary leftover or identical local Supabase asset. */
export function canReuseExistingLocalAsset(input: {
	provider: string | null | undefined;
	secureUrl: string;
	sha256: unknown;
	expectedSha256: string;
	alt: unknown;
	expectedAlt: string;
	mimeType: unknown;
	expectedMimeType: string;
	validationVersion: unknown;
	expectedValidationVersion: number;
	slug: string;
	key: string;
}): boolean {
	if (input.sha256 !== input.expectedSha256) return false;
	if (input.alt !== input.expectedAlt) return false;
	if (input.mimeType !== input.expectedMimeType) return false;
	if (Number(input.validationVersion) !== input.expectedValidationVersion) return false;

	const provider = input.provider ?? null;
	if (provider === 'cloudinary') {
		return isCloudinaryDeliveryUrl(input.secureUrl);
	}
	if (provider === 'supabase' || provider === null) {
		if (
			isLocalManagedDeliveryUrl(input.secureUrl, {
				slug: input.slug,
				key: input.key,
			})
		) {
			return true;
		}
		if (provider === null && isCloudinaryDeliveryUrl(input.secureUrl)) {
			return true;
		}
		return false;
	}
	return false;
}
