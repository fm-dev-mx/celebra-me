/**
 * Cloudflare Images binding implementation of the image transformer (Workers).
 *
 * The binding resizes, rotates and encodes, but it cannot report orientation and frame count;
 * those are read from the container headers (`image-bytes.ts`).
 */
import { readImageContainerFacts } from './image-bytes';
import type {
	DecodeLimits,
	EncodedImage,
	EncodeWebpOptions,
	ImageInspection,
	ImageTransformer,
} from './image-transformer';

/** Minimal shape of the `IMAGES` binding; the repository does not load the workers-types globals. */
export interface ImagesBindingInfo {
	format: string;
	fileSize: number;
	width: number;
	height: number;
}

export interface ImagesBindingOutput {
	response(): Response;
}

export interface ImagesBindingHandle {
	transform(options: Record<string, unknown>): ImagesBindingHandle;
	output(options: { format: string; quality?: number }): Promise<ImagesBindingOutput>;
}

export interface ImagesBinding {
	info(stream: ReadableStream): Promise<ImagesBindingInfo>;
	input(stream: ReadableStream): ImagesBindingHandle;
}

const SUPPORTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function toStream(bytes: Uint8Array): ReadableStream {
	return new Response(bytes as BodyInit).body as ReadableStream;
}

async function toBytes(output: ImagesBindingOutput): Promise<Uint8Array> {
	return new Uint8Array(await output.response().arrayBuffer());
}

function assertWithinPixelLimit(info: ImagesBindingInfo, limits: DecodeLimits): void {
	if (info.width * info.height > limits.limitInputPixels) {
		throw new Error('Image exceeds the input pixel limit.');
	}
}

export function createCloudflareImageTransformer(binding: ImagesBinding): ImageTransformer {
	return {
		id: 'cloudflare-images',

		async inspect(bytes: Uint8Array, limits: DecodeLimits): Promise<ImageInspection> {
			const info = await binding.info(toStream(bytes));
			assertWithinPixelLimit(info, limits);
			const facts = readImageContainerFacts(bytes);
			return {
				mimeType: SUPPORTED_MIME.has(info.format)
					? (info.format as ImageInspection['mimeType'])
					: undefined,
				width: info.width,
				height: info.height,
				orientation: facts.orientation,
				pages: facts.pages,
			};
		},

		async assertDecodable(bytes: Uint8Array, limits: DecodeLimits): Promise<void> {
			const info = await binding.info(toStream(bytes));
			assertWithinPixelLimit(info, limits);
			// Encoding forces a full decode; the tiny output keeps the call cheap.
			const probe = await binding
				.input(toStream(bytes))
				.transform({ width: 32, height: 32, fit: 'scale-down' })
				.output({ format: 'image/webp', quality: 50 });
			await toBytes(probe);
		},

		async encodeWebp(bytes: Uint8Array, options: EncodeWebpOptions): Promise<EncodedImage> {
			const info = await binding.info(toStream(bytes));
			assertWithinPixelLimit(info, options);
			const output = await binding
				.input(toStream(bytes))
				.transform({
					width: options.maxDimension,
					height: options.maxDimension,
					fit: 'scale-down',
				})
				.output({ format: 'image/webp', quality: options.quality });
			const data = await toBytes(output);
			// The binding reports oriented dimensions, so the encoded size is read back.
			const encoded = await binding.info(toStream(data));
			return { data, width: encoded.width, height: encoded.height, size: data.byteLength };
		},
	};
}
