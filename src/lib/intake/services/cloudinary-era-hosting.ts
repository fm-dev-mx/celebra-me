/**
 * Cloudinary-era invitation image hosting.
 * Client invitations in hosted/remote environments (Preview and Production)
 * must deliver referenced images from Cloudinary.
 */

export interface CloudinaryEraInvitationInput {
	kind?: string | null;
	createdAt?: string | Date | null;
	publishedAt?: string | Date | null;
}

export interface CloudinaryHostedAssetInput {
	id?: string | null;
	key?: string | null;
	provider?: string | null;
	secureUrl?: string | null;
}

function isHttpUrl(value: string): boolean {
	return /^https?:\/\//i.test(value.trim());
}

export function isCloudinaryEraInvitation(input: CloudinaryEraInvitationInput): boolean {
	if (input.kind && input.kind !== 'client') return false;
	return true;
}

export function isCloudinaryHostedAsset(asset: CloudinaryHostedAssetInput): boolean {
	const provider = (asset.provider ?? '').toLowerCase();
	const url = asset.secureUrl?.trim() ?? '';
	return provider === 'cloudinary' && isHttpUrl(url);
}

export function isSupabaseStorageUrl(value: string): boolean {
	return (
		/\.supabase\.co\/storage\//i.test(value) ||
		/(?:127\.0\.0\.1|localhost):\d+\/storage\//i.test(value)
	);
}

export function findCloudinaryEraHostingViolations(
	assets?: readonly CloudinaryHostedAssetInput[] | null,
): string[] {
	return (assets ?? [])
		.filter((asset) => !isCloudinaryHostedAsset(asset))
		.map((asset) => asset.key?.trim() || asset.id?.trim() || 'imagen');
}

export function findSupabaseStorageUrls(value: unknown, found: string[] = []): string[] {
	if (typeof value === 'string') {
		if (isSupabaseStorageUrl(value)) found.push(value);
		return found;
	}
	if (!value || typeof value !== 'object') return found;
	if (Array.isArray(value)) {
		for (const child of value) findSupabaseStorageUrls(child, found);
		return found;
	}
	for (const child of Object.values(value)) findSupabaseStorageUrls(child, found);
	return found;
}

export function cloudinaryEraHostingMessage(labels: readonly string[]): string {
	const shown = labels.slice(0, 6).join(', ');
	const extra = labels.length > 6 ? ` (+${labels.length - 6})` : '';
	return `Las imágenes de esta invitación deben alojarse en Cloudinary (${shown}${extra}).`;
}
