/**
 * In-memory stand-in for the Cloudflare `IMAGES` binding, built on sharp so the pixels are
 * real. It mirrors the documented behavior the implementation depends on: oriented `info`,
 * metadata stripped on output, `fit` modes, and the ten-transform limit per call.
 */
import sharp from 'sharp';
import type {
	ImagesBinding,
	ImagesBindingHandle,
	ImagesBindingInfo,
	ImagesBindingOutput,
} from '@/lib/images/cloudflare-image-transformer';

const MAX_TRANSFORMS = 10;

async function readAll(stream: ReadableStream): Promise<Uint8Array> {
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

type Step = { kind: 'transform'; options: Record<string, unknown> };

export interface FakeImagesBinding extends ImagesBinding {
	/** One entry per `output()` call: the number of transforms it carried. */
	calls: Array<{ transforms: number; format: string; quality: number | undefined }>;
}

const MIME_BY_FORMAT: Record<string, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

export function createFakeImagesBinding(): FakeImagesBinding {
	const calls: FakeImagesBinding['calls'] = [];

	function handle(source: Promise<Uint8Array>, steps: Step[]): ImagesBindingHandle {
		return {
			transform(options) {
				return handle(source, [...steps, { kind: 'transform', options }]);
			},
			async output(options): Promise<ImagesBindingOutput> {
				if (steps.length > MAX_TRANSFORMS) {
					throw new Error(
						`IMAGES_TRANSFORM_ERROR 9432: Bad request: ${MAX_TRANSFORMS} "transforms" maximum`,
					);
				}
				calls.push({
					transforms: steps.length,
					format: options.format,
					quality: options.quality,
				});
				let image = sharp(await source, { failOn: 'error' }).rotate();
				for (const step of steps) {
					const { width, height, fit } = step.options as {
						width?: number;
						height?: number;
						fit?: string;
					};
					if (width || height) {
						image = image.resize({
							width,
							height,
							fit: fit === 'cover' ? 'cover' : fit === 'squeeze' ? 'fill' : 'inside',
							withoutEnlargement: fit === 'scale-down',
						});
					}
				}
				const format = options.format.replace('image/', '') as 'jpeg' | 'png' | 'webp';
				const bytes = await image.toFormat(format, { quality: options.quality }).toBuffer();
				return {
					response: () =>
						new Response(new Uint8Array(bytes), {
							headers: { 'Content-Type': options.format },
						}),
				};
			},
		};
	}

	return {
		calls,
		async info(stream): Promise<ImagesBindingInfo> {
			const bytes = await readAll(stream);
			const meta = await sharp(bytes, { failOn: 'error' }).metadata();
			const oriented = meta.autoOrient ?? { width: meta.width!, height: meta.height! };
			return {
				format: MIME_BY_FORMAT[meta.format ?? ''] ?? `image/${meta.format}`,
				fileSize: bytes.byteLength,
				width: oriented.width,
				height: oriented.height,
			};
		},
		input(stream) {
			return handle(readAll(stream), []);
		},
	};
}
