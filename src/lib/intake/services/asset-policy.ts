import sharp from 'sharp';
import { ApiError } from '@/lib/rsvp/core/errors';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/intake/constants';

export const ASSET_POLICY_VERSION = 1;
export const OUTPUT_MIME_TYPE = 'image/webp';
export const MAX_OUTPUT_BYTES = 2_500_000;
export const MAX_OUTPUT_DIMENSION = 2560;
const MAX_INPUT_PIXELS = 40_000_000;
const MIN_INPUT_DIMENSION = 480;

const FORMAT_MIME: Record<string, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

export interface NormalizedInvitationImage {
	blob: Blob;
	width: number;
	height: number;
	fileSize: number;
	mimeType: typeof OUTPUT_MIME_TYPE;
	originalMimeType: string;
	originalFileSize: number;
	validationVersion: number;
}

export async function normalizeInvitationImage(
	file: Blob,
	declaredMimeType: string,
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
		const input = Buffer.from(await file.arrayBuffer());
		const metadata = await sharp(input, {
			failOn: 'error',
			limitInputPixels: MAX_INPUT_PIXELS,
		}).metadata();
		const detectedMime = metadata.format ? FORMAT_MIME[metadata.format] : undefined;

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

		let output:
			| { data: Buffer; info: { width: number; height: number; size: number } }
			| undefined;
		for (const quality of [84, 76, 68]) {
			const result = await sharp(input, {
				failOn: 'error',
				limitInputPixels: MAX_INPUT_PIXELS,
			})
				.rotate()
				.resize({
					width: MAX_OUTPUT_DIMENSION,
					height: MAX_OUTPUT_DIMENSION,
					fit: 'inside',
					withoutEnlargement: true,
				})
				.webp({ quality, effort: 4 })
				.toBuffer({ resolveWithObject: true });
			output = result;
			if (result.info.size <= MAX_OUTPUT_BYTES) break;
		}

		if (!output || output.info.size > MAX_OUTPUT_BYTES) {
			throw new ApiError(
				422,
				'validation_error',
				'La imagen sigue siendo demasiado pesada después de optimizarla. Usa una imagen más simple.',
			);
		}

		return {
			blob: new Blob([Uint8Array.from(output.data).buffer], { type: OUTPUT_MIME_TYPE }),
			width: output.info.width,
			height: output.info.height,
			fileSize: output.info.size,
			mimeType: OUTPUT_MIME_TYPE,
			originalMimeType: detectedMime,
			originalFileSize: file.size,
			validationVersion: ASSET_POLICY_VERSION,
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
