/**
 * Width variants of hosted invitation images, so a phone downloads a file sized for its screen
 * instead of the full-resolution original.
 *
 * Every variant is a WebP stored beside its original under the same digest
 * (`<...>-<sha256>.w<width>.webp`). A source narrower than a variant width is never enlarged: the
 * variant then holds the source at its own size, so every listed width always exists. An upright
 * WebP source at or below the width is stored as-is, so that variant never loses quality.
 */
import type { ImageTransformer } from './image-transformer';

export const RESPONSIVE_IMAGE_WIDTHS = [480, 800, 1280, 1920] as const;
export type ResponsiveImageWidth = (typeof RESPONSIVE_IMAGE_WIDTHS)[number];

/**
 * Measured on published photos against a lossless downscale: quality 88 keeps about 38-39 dB
 * PSNR, where 80 dropped to about 35 dB on detailed portraits.
 */
export const RESPONSIVE_VARIANT_QUALITY = 88;

/**
 * Preserved originals keep their source size up to 24 MP (e.g. 4000x6000), so the decode bound
 * matches that preservation cap rather than the 2560 px normalized output.
 */
const MAX_VARIANT_INPUT_PIXELS = 24_000_000;

export interface ResponsiveImageVariant {
	width: ResponsiveImageWidth;
	data: Uint8Array;
}

/** Long-side limit that makes the output `targetWidth` wide without enlarging the source. */
export function variantMaxDimension(
	source: { width: number; height: number },
	targetWidth: number,
): number {
	const longSide = Math.max(source.width, source.height);
	if (source.width <= targetWidth) return longSide;
	return Math.max(1, Math.round((targetWidth * longSide) / source.width));
}

export async function encodeResponsiveVariants(
	transformer: ImageTransformer,
	bytes: Uint8Array,
): Promise<ResponsiveImageVariant[]> {
	const limits = { limitInputPixels: MAX_VARIANT_INPUT_PIXELS };
	const inspection = await transformer.inspect(bytes, limits);
	if (!inspection.width || !inspection.height)
		throw new Error('Responsive variants require an image with known dimensions.');
	// Orientations 5-8 rotate a quarter turn: the encoder auto-orients, so measure the turned image.
	const turned = (inspection.orientation ?? 1) >= 5;
	const source = turned
		? { width: inspection.height, height: inspection.width }
		: { width: inspection.width, height: inspection.height };
	const upright = (inspection.orientation ?? 1) === 1;
	const reusable = inspection.mimeType === 'image/webp' && upright;
	const variants: ResponsiveImageVariant[] = [];
	for (const width of RESPONSIVE_IMAGE_WIDTHS) {
		if (reusable && source.width <= width) {
			variants.push({ width, data: bytes });
			continue;
		}
		const encoded = await transformer.encodeWebp(bytes, {
			...limits,
			maxDimension: variantMaxDimension(source, width),
			quality: RESPONSIVE_VARIANT_QUALITY,
		});
		variants.push({ width, data: encoded.data });
	}
	return variants;
}
