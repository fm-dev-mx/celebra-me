import type { ImageMetadata } from 'astro';

/**
 * Published media that keeps a stable path when bytes are replaced.
 * Confirmed stale path: these URLs through `/_vercel/image` inherit a 1h
 * transform TTL while Storage itself is `no-cache` + ETag.
 */
export function isMutableInPlaceMediaUrl(src: string): boolean {
	return /\.supabase\.co\/storage\//i.test(src.trim());
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
	return !isMutableInPlaceMediaUrl(url);
}

export function plainImgSrc(src: string | ImageMetadata): string {
	return typeof src === 'string' ? src : src.src;
}
