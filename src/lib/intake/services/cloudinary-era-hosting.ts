/**
 * Cloudinary-era invitation image hosting.
 * Client invitations created or published on/after 2026-07-26, and all later ones,
 * must deliver referenced images from Cloudinary.
 */

export const CLOUDINARY_ERA_CUTOFF = '2026-07-26T00:00:00.000Z';
export const CLOUDINARY_ERA_CUTOFF_MS = Date.parse(CLOUDINARY_ERA_CUTOFF);

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

function toMs(value: string | Date | null | undefined): number | null {
	if (value == null) return null;
	const ms = value instanceof Date ? value.getTime() : Date.parse(value);
	return Number.isFinite(ms) ? ms : null;
}

function isHttpUrl(value: string): boolean {
	return /^https?:\/\//i.test(value.trim());
}

export function isCloudinaryEraInvitation(input: CloudinaryEraInvitationInput): boolean {
	if (input.kind && input.kind !== 'client') return false;
	const created = toMs(input.createdAt);
	const published = toMs(input.publishedAt);
	if (created != null && created >= CLOUDINARY_ERA_CUTOFF_MS) return true;
	if (published != null && published >= CLOUDINARY_ERA_CUTOFF_MS) return true;
	return false;
}

export function isCloudinaryHostedAsset(asset: CloudinaryHostedAssetInput): boolean {
	const provider = (asset.provider ?? '').toLowerCase();
	const url = asset.secureUrl?.trim() ?? '';
	return provider === 'cloudinary' && isHttpUrl(url);
}

export function isSupabaseStorageUrl(value: string): boolean {
	return /\.supabase\.co\/storage\//i.test(value);
}

export function findCloudinaryEraHostingViolations(
	assets: readonly CloudinaryHostedAssetInput[],
): string[] {
	return assets
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
