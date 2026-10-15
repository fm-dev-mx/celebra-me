/**
 * Image processing contract shared by the intake pipeline and the watermarked preview media.
 *
 * Two implementations exist because the two hosting targets cannot run the same engine:
 * native `sharp` (Node, Vercel and local development) and the Cloudflare Images binding
 * (Workers). Callers ask for an operation and never see the engine.
 */
import type { ProvenanceMetadata } from './image-metadata';

export interface ImageInspection {
	/** MIME type of the decoded container, or undefined for a format the pipeline does not accept. */
	mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | undefined;
	width: number | undefined;
	height: number | undefined;
	/** EXIF orientation 1-8 when the file declares one. */
	orientation: number | undefined;
	/** Frame count; 1 for a still image. */
	pages: number;
}

export interface DecodeLimits {
	/** Inputs with more pixels than this are refused before any pixel work. */
	limitInputPixels: number;
}

export interface EncodeWebpOptions extends DecodeLimits {
	/** Longest side of the output, in pixels; smaller inputs are never enlarged. */
	maxDimension: number;
	quality: number;
}

export interface EncodedImage {
	data: Uint8Array;
	width: number;
	height: number;
	size: number;
}

export interface MarkedImageRequest extends DecodeLimits {
	bytes: Uint8Array;
	/** Cover-crops to this size (saliency-guided) before marking; omitted keeps the pixel size. */
	crop?: { width: number; height: number };
	format: 'webp' | 'jpeg';
	quality: number;
	provenance: ProvenanceMetadata;
}

export interface MarkedImage {
	data: Uint8Array;
	width: number;
	height: number;
}

export interface ImageTransformer {
	readonly id: 'sharp' | 'cloudflare-images';
	/** Reads format, size, orientation and frame count. Throws when the bytes are not an image. */
	inspect(bytes: Uint8Array, limits: DecodeLimits): Promise<ImageInspection>;
	/** Decodes every pixel; throws on a truncated or corrupt payload. */
	assertDecodable(bytes: Uint8Array, limits: DecodeLimits): Promise<void>;
	/** Auto-orients, fits inside `maxDimension` and encodes WebP. */
	encodeWebp(bytes: Uint8Array, options: EncodeWebpOptions): Promise<EncodedImage>;
	/** Draws the preview watermark and provenance metadata on the (optionally cropped) image. */
	renderMarked(request: MarkedImageRequest): Promise<MarkedImage>;
}
