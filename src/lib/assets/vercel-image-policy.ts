import type { ImageMetadata } from 'astro';

function parseHttpUrl(src: string): URL | null {
	const value = src.trim();
	if (!value) return null;
	try {
		return new URL(value, 'https://www.celebra-me.com');
	} catch {
		return null;
	}
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
	if (!parsed) return false;
	const isSupabaseHost =
		/\.supabase\.co$/i.test(parsed.hostname) ||
		parsed.hostname === '127.0.0.1' ||
		parsed.hostname === 'localhost';
	return isSupabaseHost && parsed.pathname.includes('/storage/');
}

/**
 * Local ImageMetadata and versioned remotes (Cloudinary, hashed `/_astro`)
 * stay on Astro Image / Vercel optimization. Mutable in-place URLs must not.
 */
export function shouldOptimizeThroughVercelImage(src: string | ImageMetadata): boolean {
	const url = typeof src === 'string' ? src : src.src;
	if (typeof url !== 'string') {
		return true;
	}
	// Data URLs are already repository-owned bytes; routing them through the image endpoint
	// creates an unnecessary same-origin request that cannot be used in deterministic captures.
	if (/^data:/i.test(url.trim())) return false;
	return !isMutableInPlaceMediaUrl(url);
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
