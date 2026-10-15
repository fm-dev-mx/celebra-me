import { resolveImageTransformer } from '@/lib/images/image-transformer-provider';
import type { ImageInspection, ImageTransformer } from '@/lib/images/image-transformer';
import { ApiError } from '@/lib/rsvp/core/errors';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/intake/constants';
import {
	IMAGE_ENCODING_QUALITIES,
	getImageDimensionCandidates,
	getWeightTargetBytes,
	type ImageOptimizationRole,
} from '@/lib/invitation-preparation/image-optimization';

interface EncodedInvitationImage {
	data: Uint8Array;
	info: { width: number; height: number; size: number };
	maxBytes: number;
}

async function encodeInvitationImage(
	transformer: ImageTransformer,
	input: Uint8Array,
	optimizationRole?: ImageOptimizationRole,
): Promise<EncodedInvitationImage> {
	const maxBytes = optimizationRole ? getWeightTargetBytes(optimizationRole) : MAX_OUTPUT_BYTES;
	const dimensionCandidates = optimizationRole
		? getImageDimensionCandidates(optimizationRole)
		: [MAX_OUTPUT_DIMENSION];
	const qualityCandidates = optimizationRole ? IMAGE_ENCODING_QUALITIES : [84, 76, 68];
	let output: EncodedInvitationImage | undefined;

	for (const quality of qualityCandidates) {
		for (const dimension of dimensionCandidates) {
			const result = await transformer.encodeWebp(input, {
				maxDimension: dimension,
				quality,
				limitInputPixels: MAX_INPUT_PIXELS,
			});
			output = {
				data: result.data,
				info: { width: result.width, height: result.height, size: result.size },
				maxBytes,
			};
			if (result.size <= maxBytes) return output;
		}
	}

	if (!output) throw new Error('No image encoding candidate was produced.');
	return output;
}

export const ASSET_POLICY_VERSION = 1;
export const ROLE_AWARE_ASSET_POLICY_VERSION = 2;
const ORIGINAL_ASSET_POLICY_VERSION = 3;
const ROLE_AWARE_ORIGINAL_ASSET_POLICY_VERSION = 4;

export function isRoleAwareAssetPolicy(version: number): boolean {
	return (
		version === ROLE_AWARE_ASSET_POLICY_VERSION ||
		version >= ROLE_AWARE_ORIGINAL_ASSET_POLICY_VERSION
	);
}

export function isOriginalAssetPolicy(version: number): boolean {
	return (
		version === ORIGINAL_ASSET_POLICY_VERSION ||
		version === ROLE_AWARE_ORIGINAL_ASSET_POLICY_VERSION
	);
}

export function imageExtension(mimeType: string): 'webp' | 'jpg' | 'png' {
	if (mimeType === 'image/webp') return 'webp';
	if (mimeType === 'image/jpeg') return 'jpg';
	if (mimeType === 'image/png') return 'png';
	throw new Error('Unsupported published image MIME type.');
}

export const OUTPUT_MIME_TYPE = 'image/webp';
export const MAX_OUTPUT_BYTES = 2_500_000;
export const MAX_OUTPUT_DIMENSION = 2560;
// Explicit original preservation is bounded separately from normalized output sizing.
const MAX_PRESERVED_DIMENSION = 6000;
const MAX_PRESERVED_PIXELS = 24_000_000;
const MAX_INPUT_PIXELS = 40_000_000;
const MIN_INPUT_DIMENSION = 480;

export function detectFileMimeType(filePath: string, sourceBytes?: Uint8Array): string {
	const ext = filePath.split('.').pop()?.toLowerCase();
	if (ext === 'png') return 'image/png';
	if (ext === 'webp') return 'image/webp';
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
	if (sourceBytes && sourceBytes.length >= 4) {
		if (
			sourceBytes[0] === 0x89 &&
			sourceBytes[1] === 0x50 &&
			sourceBytes[2] === 0x4e &&
			sourceBytes[3] === 0x47
		) {
			return 'image/png';
		}
		if (
			sourceBytes[0] === 0x52 &&
			sourceBytes[1] === 0x49 &&
			sourceBytes[2] === 0x46 &&
			sourceBytes[3] === 0x46
		) {
			return 'image/webp';
		}
	}
	return 'image/jpeg';
}

export interface NormalizedInvitationImage {
	blob: Blob;
	width: number;
	height: number;
	fileSize: number;
	mimeType: string;
	originalMimeType: string;
	originalFileSize: number;
	validationVersion: number;
}

/**
 * Extracts raw bytes from a Blob-like value across different runtime environments.
 * Handles standard web Blob (arrayBuffer), jsdom's internal symbol representation,
 * Node Buffer/Uint8Array, and objects with a .buffer property.
 */
export async function extractBlobRawBytes(file: Blob): Promise<Uint8Array | undefined> {
	if (Buffer.isBuffer(file) || file instanceof Uint8Array) return new Uint8Array(file);
	if (typeof (file as { arrayBuffer?: unknown }).arrayBuffer === 'function') {
		return new Uint8Array(
			await (file as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer(),
		);
	}
	if (typeof (file as { bytes?: () => Promise<Uint8Array> }).bytes === 'function') {
		return await (file as { bytes: () => Promise<Uint8Array> }).bytes();
	}
	const symbols = Object.getOwnPropertySymbols(file);
	const impl =
		symbols.length > 0
			? ((file as unknown as Record<symbol, unknown>)[symbols[0]] as
					Record<string, unknown> | undefined)
			: undefined;
	if (impl?._buffer && (Buffer.isBuffer(impl._buffer) || impl._buffer instanceof Uint8Array)) {
		return new Uint8Array(impl._buffer as Uint8Array);
	}
	if (file && typeof file === 'object' && 'buffer' in file && file.buffer) {
		return new Uint8Array(file.buffer as ArrayBuffer);
	}
	return undefined;
}

async function preserveValidatedImage(
	transformer: ImageTransformer,
	input: Uint8Array,
	metadata: ImageInspection & { width: number; height: number },
	detectedMime: string,
	originalFileSize: number,
	optimizationRole?: ImageOptimizationRole,
): Promise<NormalizedInvitationImage> {
	const maxBytes = optimizationRole ? getWeightTargetBytes(optimizationRole) : MAX_OUTPUT_BYTES;
	if (
		input.byteLength > maxBytes ||
		Math.max(metadata.width, metadata.height) > MAX_PRESERVED_DIMENSION ||
		metadata.width * metadata.height > MAX_PRESERVED_PIXELS ||
		(metadata.orientation !== undefined && metadata.orientation !== 1) ||
		metadata.pages !== 1
	) {
		throw new ApiError(
			422,
			'validation_error',
			'La imagen original no cumple el contrato de publicación. Requiere revisión.',
		);
	}
	// Decode fully so preservation cannot admit a truncated or corrupt payload.
	await transformer.assertDecodable(input, { limitInputPixels: MAX_INPUT_PIXELS });
	return {
		blob: new Blob([Uint8Array.from(input)], { type: detectedMime }),
		width: metadata.width,
		height: metadata.height,
		fileSize: input.byteLength,
		mimeType: detectedMime,
		originalMimeType: detectedMime,
		originalFileSize: originalFileSize,
		validationVersion: optimizationRole
			? ROLE_AWARE_ORIGINAL_ASSET_POLICY_VERSION
			: ORIGINAL_ASSET_POLICY_VERSION,
	};
}

export async function normalizeInvitationImage(
	file: Blob,
	declaredMimeType: string,
	optimizationRole?: ImageOptimizationRole,
	sourcePolicy: 'normalize' | 'preserve' = 'normalize',
): Promise<NormalizedInvitationImage> {
	const normalizedDeclaredMime = declaredMimeType.split(';', 1)[0].trim().toLowerCase();
	if (!ALLOWED_MIME_TYPES.includes(normalizedDeclaredMime)) {
		throw new ApiError(
			422,
			'validation_error',
			'Formato no compatible. Usa una imagen JPG, PNG o WebP.',
		);
	}
	if (file.size === 0) {
		throw new ApiError(422, 'validation_error', 'La imagen está vacía o dañada.');
	}
	if (file.size > MAX_FILE_SIZE) {
		throw new ApiError(
			422,
			'validation_error',
			`La imagen supera el límite de ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.`,
		);
	}

	try {
		const rawBytes = await extractBlobRawBytes(file);
		if (!rawBytes) {
			throw new ApiError(422, 'validation_error', 'La imagen está vacía o dañada.');
		}
		const input = rawBytes;
		const transformer = await resolveImageTransformer();
		const metadata = await transformer.inspect(input, { limitInputPixels: MAX_INPUT_PIXELS });
		const detectedMime = metadata.mimeType;

		if (!detectedMime) {
			throw new ApiError(
				422,
				'validation_error',
				'No se pudo reconocer la imagen. Usa un archivo JPG, PNG o WebP válido.',
			);
		}
		if (detectedMime !== normalizedDeclaredMime) {
			throw new ApiError(
				422,
				'validation_error',
				'El contenido del archivo no coincide con su formato declarado.',
				{ declaredMimeType: normalizedDeclaredMime, detectedMimeType: detectedMime },
			);
		}
		if (!metadata.width || !metadata.height) {
			throw new ApiError(
				422,
				'validation_error',
				'La imagen no contiene dimensiones válidas.',
			);
		}
		if (Math.min(metadata.width, metadata.height) < MIN_INPUT_DIMENSION) {
			throw new ApiError(
				422,
				'validation_error',
				'La imagen es demasiado pequeña. Cada lado debe medir al menos 480 px.',
				{ width: metadata.width, height: metadata.height },
			);
		}

		if (sourcePolicy === 'preserve') {
			return await preserveValidatedImage(
				transformer,
				input,
				{ ...metadata, width: metadata.width, height: metadata.height },
				detectedMime,
				file.size,
				optimizationRole,
			);
		}
		const output = await encodeInvitationImage(transformer, input, optimizationRole);

		if (output.info.size > MAX_OUTPUT_BYTES) {
			throw new ApiError(
				422,
				'validation_error',
				'La imagen sigue siendo demasiado pesada después de optimizarla. Usa una imagen más simple.',
			);
		}
		if (optimizationRole && output.info.size > output.maxBytes) {
			throw new ApiError(
				422,
				'validation_error',
				'La imagen no puede alcanzar el peso recomendado para su sección sin perder demasiada calidad. Usa una imagen más simple o solicita una revisión.',
				{
					reason: 'asset_role_weight_exceeded',
					role: optimizationRole,
					maxBytes: output.maxBytes,
					fileSize: output.info.size,
				},
			);
		}

		return {
			blob: new Blob([Uint8Array.from(output.data)], { type: OUTPUT_MIME_TYPE }),
			width: output.info.width,
			height: output.info.height,
			fileSize: output.info.size,
			mimeType: OUTPUT_MIME_TYPE,
			originalMimeType: detectedMime,
			originalFileSize: file.size,
			validationVersion: optimizationRole
				? ROLE_AWARE_ASSET_POLICY_VERSION
				: ASSET_POLICY_VERSION,
		};
	} catch (error) {
		if (error instanceof ApiError) throw error;
		throw new ApiError(
			422,
			'validation_error',
			'No se pudo procesar la imagen. El archivo puede estar dañado o ser demasiado grande.',
		);
	}
}
