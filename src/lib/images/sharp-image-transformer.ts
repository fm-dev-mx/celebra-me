/**
 * `sharp` implementation of the image transformer (Node, Vercel, local development).
 * Native and Node-only: it is loaded lazily so importers that never transform pixels do not
 * require the native module at evaluation time.
 */
import { buildPreviewMarkSvg } from '@/lib/invitation/preview/preview-mark-svg';
import type {
	DecodeLimits,
	EncodedImage,
	EncodeWebpOptions,
	ImageInspection,
	ImageTransformer,
	MarkedImage,
	MarkedImageRequest,
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

	async renderMarked(request: MarkedImageRequest): Promise<MarkedImage> {
		const sharp = await loadSharp();
		const options = { failOn: 'error', limitInputPixels: request.limitInputPixels } as const;
		const metadata = await sharp(request.bytes, options).metadata();
		const width = request.crop?.width ?? metadata.autoOrient?.width ?? metadata.width;
		const height = request.crop?.height ?? metadata.autoOrient?.height ?? metadata.height;
		if (!width || !height) throw new Error('Preview source has no readable dimensions.');

		let pipeline = sharp(request.bytes, options).rotate();
		if (request.crop) {
			pipeline = pipeline.resize(request.crop.width, request.crop.height, {
				fit: 'cover',
				position: 'attention',
			});
		}
		pipeline = pipeline
			.composite([
				{ input: Buffer.from(buildPreviewMarkSvg({ width, height })), top: 0, left: 0 },
			])
			.withExif({
				IFD0: {
					Artist: request.provenance.exif.artist,
					Copyright: request.provenance.exif.copyright,
					ImageDescription: request.provenance.exif.description,
				},
			})
			.withXmp(request.provenance.xmp);
		const data =
			request.format === 'jpeg'
				? await pipeline.jpeg({ quality: request.quality, mozjpeg: true }).toBuffer()
				: await pipeline.webp({ quality: request.quality, effort: 4 }).toBuffer();
		return { data, width, height };
	},
};
