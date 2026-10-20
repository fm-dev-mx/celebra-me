/**
 * `sharp` implementation of the image transformer (Node, local development).
 * Native and Node-only: it is loaded lazily so importers that never transform pixels do not
 * require the native module at evaluation time.
 */
import type {
	DecodeLimits,
	EncodedImage,
	EncodeWebpOptions,
	ImageInspection,
	ImageTransformer,
} from './image-transformer';

async function loadSharp() {
	const mod = await import('sharp');
	return mod.default;
}

const FORMAT_MIME: Record<string, ImageInspection['mimeType']> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

export const sharpImageTransformer: ImageTransformer = {
	id: 'sharp',

	async inspect(bytes: Uint8Array, { limitInputPixels }: DecodeLimits): Promise<ImageInspection> {
		const sharp = await loadSharp();
		const metadata = await sharp(bytes, { failOn: 'error', limitInputPixels }).metadata();
		return {
			mimeType: metadata.format ? FORMAT_MIME[metadata.format] : undefined,
			width: metadata.width,
			height: metadata.height,
			orientation: metadata.orientation,
			pages: metadata.pages ?? 1,
		};
	},

	async assertDecodable(bytes: Uint8Array, { limitInputPixels }: DecodeLimits): Promise<void> {
		const sharp = await loadSharp();
		await sharp(bytes, { failOn: 'error', limitInputPixels }).raw().toBuffer();
	},

	async encodeWebp(bytes: Uint8Array, options: EncodeWebpOptions): Promise<EncodedImage> {
		const sharp = await loadSharp();
		const result = await sharp(bytes, {
			failOn: 'error',
			limitInputPixels: options.limitInputPixels,
		})
			.rotate()
			.resize({
				width: options.maxDimension,
				height: options.maxDimension,
				fit: 'inside',
				withoutEnlargement: true,
			})
			.webp({ quality: options.quality, effort: 4 })
			.toBuffer({ resolveWithObject: true });
		return {
			data: result.data,
			width: result.info.width,
			height: result.info.height,
			size: result.info.size,
		};
	},
};
