import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { ImageDelivery } from './image-delivery';
import { plainImgSrc, shouldOptimizeThroughVercelImage } from './vercel-image-policy';

/** Resolve picture sources using the same explicit contract as the shared img component. */
export async function resolveExplicitImageDelivery(
	src: string | ImageMetadata,
	delivery: ImageDelivery,
	defaults: { width: number; height?: number; quality?: number; format?: 'webp' },
): Promise<string> {
	if (!shouldOptimizeThroughVercelImage(src, delivery)) return plainImgSrc(src);
	const height = delivery.height ?? defaults.height;
	const result = await getImage({
		src,
		width: delivery.width ?? defaults.width,
		...(height ? { height } : typeof src === 'string' ? { inferSize: true } : {}),
		quality: delivery.quality ?? defaults.quality,
		format: delivery.format ?? defaults.format,
	});
	return result.src;
}
