import type { ImageMetadata } from 'astro';
import type { ImageDelivery } from './image-delivery';

function parseHttpUrl(src: string): URL | null {
	const value = src.trim();
	if (!value) return null;
	try {
		return new URL(value, 'https://www.celebra-me.com');
	} catch {
		return null;
	}
}

/** Match managed Storage delivery by host and path, not path lookalikes. */
function isStorageMediaUrl(src: string | URL): boolean {
	const parsed = typeof src === 'string' ? parseHttpUrl(src) : src;
	if (!parsed) return false;
	const isSupabaseHost =
		/\.supabase\.co$/i.test(parsed.hostname) ||
		parsed.hostname === '127.0.0.1' ||
		parsed.hostname === 'localhost';
	return isSupabaseHost && parsed.pathname.includes('/storage/');
}

/**
 * Published media that keeps a stable path when bytes are replaced.
 * Confirmed stale path: these URLs through `/_vercel/image` inherit a 1h
 * transform TTL while Storage itself is `no-cache` + ETag.
 *
 * Classification is hostname-based so path-only lookalikes do not match.
 */
export function isMutableInPlaceMediaUrl(src: string): boolean {
	const parsed = parseHttpUrl(src);
	return (
		!!parsed &&
		isStorageMediaUrl(parsed) &&
		!/-[a-f0-9]{64}\.(?:webp|jpg|png)$/.test(parsed.pathname)
	);
}

/** Prepared managed media bypasses a second encoder. Explicit legacy transforms remain supported. */
export function shouldOptimizeThroughVercelImage(
	src: string | ImageMetadata,
	delivery?: ImageDelivery,
): boolean {
	if (delivery?.mode === 'original') return false;
	const url = plainImgSrc(src);
	if (typeof url !== 'string') {
		return true;
	}
	if (delivery?.mode === 'optimized' && isMutableInPlaceMediaUrl(url))
		throw new Error('Optimized delivery requires a versioned image URL.');
	// Data URLs are already repository-owned bytes; routing them through the image endpoint
	// creates an unnecessary same-origin request that cannot be used in deterministic captures.
	if (/^data:/i.test(url.trim())) return false;
	if (delivery?.mode === 'optimized') return true;
	return !isStorageMediaUrl(url) && !isCloudinaryDeliveryHostname(url);
}

export function plainImgSrc(src: string | ImageMetadata): string {
	return typeof src === 'string' ? src : src.src;
}

export function isCloudinaryDeliveryHostname(src: string): boolean {
	const parsed = parseHttpUrl(src);
	if (!parsed) return false;
	const hostname = parsed.hostname.toLowerCase();
	return hostname === 'res.cloudinary.com' || hostname.endsWith('.res.cloudinary.com');
}
