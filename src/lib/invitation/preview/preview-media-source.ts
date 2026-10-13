/**
 * Which original images the preview endpoint may fetch. Tokens are sealed by this
 * server, so this is defense in depth: same-origin assets, managed Supabase Storage
 * public objects and Cloudinary deliveries only.
 */
const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/';

function configuredSupabaseOrigins(): string[] {
	return [process.env.SUPABASE_URL, process.env.PUBLIC_SUPABASE_URL]
		.map((value) => {
			try {
				return value ? new URL(value).origin : null;
			} catch {
				return null;
			}
		})
		.filter((origin): origin is string => Boolean(origin));
}

export function resolvePreviewMediaSource(source: string, requestOrigin: string): URL | null {
	let parsed: URL;
	try {
		parsed = new URL(source, requestOrigin);
	} catch {
		return null;
	}
	if (parsed.username || parsed.password) return null;
	if (parsed.origin === requestOrigin) return parsed;
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

	const isStorageObject = parsed.pathname.startsWith(STORAGE_PUBLIC_PATH);
	if (isStorageObject && configuredSupabaseOrigins().includes(parsed.origin)) return parsed;
	if (parsed.protocol !== 'https:') return null;

	const host = parsed.hostname.toLowerCase();
	if (isStorageObject && host.endsWith('.supabase.co')) return parsed;
	if (host === 'res.cloudinary.com' || host.endsWith('.res.cloudinary.com')) return parsed;
	return null;
}
