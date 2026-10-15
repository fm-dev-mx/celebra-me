/**
 * Cloudflare Images binding implementation of the image transformer (Workers).
 *
 * The binding resizes, rotates, crops and encodes, but it cannot rasterize SVG, write
 * EXIF/XMP, or report orientation and frame count. Those gaps are covered here:
 * - the watermark is one prerendered mark bitmap, scaled by the binding and drawn at every
 *   lattice position of the pattern (see `preview-mark-instances.ts`);
 * - provenance metadata is patched into the encoded container (`image-metadata.ts`);
 * - orientation and animation are read from the container headers (`image-bytes.ts`).
 */
import { layoutPreviewMarkInstances } from '@/lib/invitation/preview/preview-mark-instances';
import {
	PREVIEW_MARK_MASTER_PNG_BASE64,
	TRANSPARENT_PIXEL_PNG_BASE64,
} from '@/lib/invitation/preview/preview-mark-master.generated';
import { readImageContainerFacts } from './image-bytes';
import { embedProvenanceMetadata } from './image-metadata';
import type {
	DecodeLimits,
	EncodedImage,
	EncodeWebpOptions,
	ImageInspection,
	ImageTransformer,
	MarkedImage,
	MarkedImageRequest,
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
	draw(
		overlay: ReadableStream | ImagesBindingHandle,
		options?: Record<string, unknown>,
	): ImagesBindingHandle;
	output(options: { format: string; quality?: number }): Promise<ImagesBindingOutput>;
}

export interface ImagesBinding {
	info(stream: ReadableStream): Promise<ImagesBindingInfo>;
	input(stream: ReadableStream): ImagesBindingHandle;
}

/** A single binding call accepts at most this many transforms (each draw counts as one). */
const MAX_TRANSFORMS_PER_CALL = 10;
const SUPPORTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function decodeBase64(text: string): Uint8Array {
	const binary = atob(text);
	const out = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
	return out;
}

const masterMark = decodeBase64(PREVIEW_MARK_MASTER_PNG_BASE64);
const transparentPixel = decodeBase64(TRANSPARENT_PIXEL_PNG_BASE64);

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
	/** Scaled mark bitmaps by width; at most one entry per cap height. */
	const scaledMarks = new Map<number, Promise<Uint8Array>>();

	function scaledMark(width: number): Promise<Uint8Array> {
		let cached = scaledMarks.get(width);
		if (!cached) {
			cached = binding
				.input(toStream(masterMark))
				.transform({ width })
				.output({ format: 'image/png' })
				.then(toBytes);
			// A failed scale must not poison later requests.
			cached.catch(() => scaledMarks.delete(width));
			scaledMarks.set(width, cached);
		}
		return cached;
	}

	/** Mark overlay of the full image size holding the given instances (one call, one canvas). */
	async function buildOverlay(
		size: { width: number; height: number },
		mark: Uint8Array,
		instances: Array<{ left: number; top: number }>,
	): Promise<Uint8Array> {
		let canvas = binding
			.input(toStream(transparentPixel))
			.transform({ width: size.width, height: size.height, fit: 'squeeze' });
		for (const { left, top } of instances) canvas = canvas.draw(toStream(mark), { left, top });
		return toBytes(await canvas.output({ format: 'image/png' }));
	}

	/** Stacks overlays of the same size (the first is the canvas, so at most nine draws on it). */
	async function mergeOverlays(group: Uint8Array[]): Promise<Uint8Array> {
		const [first, ...rest] = group;
		if (rest.length === 0) return first;
		let canvas = binding.input(toStream(first));
		for (const overlay of rest) canvas = canvas.draw(toStream(overlay), { left: 0, top: 0 });
		return toBytes(await canvas.output({ format: 'image/png' }));
	}

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

		async renderMarked(request: MarkedImageRequest): Promise<MarkedImage> {
			const info = await binding.info(toStream(request.bytes));
			assertWithinPixelLimit(info, request);
			const width = request.crop?.width ?? info.width;
			const height = request.crop?.height ?? info.height;
			if (!width || !height) throw new Error('Preview source has no readable dimensions.');

			const layout = layoutPreviewMarkInstances({ width, height });
			const mark = await scaledMark(layout.instanceWidth);
			const baseTransforms = request.crop ? 1 : 0;
			let base = binding.input(toStream(request.bytes));
			if (request.crop) {
				base = base.transform({
					width: request.crop.width,
					height: request.crop.height,
					fit: 'cover',
					gravity: 'auto',
				});
			}

			if (baseTransforms + layout.instances.length <= MAX_TRANSFORMS_PER_CALL) {
				for (const { left, top } of layout.instances) {
					base = base.draw(toStream(mark), { left, top });
				}
			} else {
				// More marks than one call accepts: build overlays of the full size in parallel
				// (a canvas stretch plus nine draws each), then draw each overlay once.
				const perOverlay = MAX_TRANSFORMS_PER_CALL - 1;
				const chunks: Array<typeof layout.instances> = [];
				for (let start = 0; start < layout.instances.length; start += perOverlay) {
					chunks.push(layout.instances.slice(start, start + perOverlay));
				}
				let overlays = await Promise.all(
					chunks.map((chunk) => buildOverlay({ width, height }, mark, chunk)),
				);
				// Very large images: merge overlays ten at a time until the base call can take them.
				while (overlays.length + baseTransforms > MAX_TRANSFORMS_PER_CALL) {
					const groups: Uint8Array[][] = [];
					for (let start = 0; start < overlays.length; start += MAX_TRANSFORMS_PER_CALL) {
						groups.push(overlays.slice(start, start + MAX_TRANSFORMS_PER_CALL));
					}
					overlays = await Promise.all(groups.map((group) => mergeOverlays(group)));
				}
				for (const overlay of overlays) {
					base = base.draw(toStream(overlay), { left: 0, top: 0 });
				}
			}

			const output = await base.output(
				request.format === 'jpeg'
					? { format: 'image/jpeg', quality: request.quality }
					: { format: 'image/webp', quality: request.quality },
			);
			const encoded = await toBytes(output);
			return {
				data: embedProvenanceMetadata(encoded, request.format, request.provenance),
				width,
				height,
			};
		},
	};
}
