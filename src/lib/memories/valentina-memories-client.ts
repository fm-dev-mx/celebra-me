import { sha256 } from '@noble/hashes/sha2';
import {
	VALENTINA_MEMORIES_HASH_CHUNK_BYTES,
	VALENTINA_MEMORIES_IMAGE_OPTIMIZATION_MAX_DIMENSION_PX,
	VALENTINA_MEMORIES_IMAGE_OPTIMIZATION_QUALITY,
	VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	getValentinaMemoriesMimePolicy,
	resolveValentinaMemoriesFileMimeType,
} from '@/data/valentina-memories-upload.contract';
import {
	VALENTINA_MEMORIES_ARCHIVE_MAX_BYTES,
	VALENTINA_MEMORIES_ARCHIVE_MAX_FILES,
} from '@/data/valentina-memories-media.contract';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';

export type ValentinaMemoriesCaptureIssue =
	| 'unsupported_type'
	| 'file_too_large'
	| 'video_too_long'
	| 'video_unreadable'
	| 'window_closed'
	| 'rate_limited'
	| 'quota_reached'
	| 'sign_failed'
	| 'put_failed'
	| 'network_failed'
	| 'unavailable';

const OPTIMIZABLE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new DOMException('Image optimization aborted.', 'AbortError');
}

async function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType: string,
	quality: number,
	signal?: AbortSignal,
): Promise<Blob> {
	throwIfAborted(signal);
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (signal?.aborted)
					return reject(new DOMException('Image optimization aborted.', 'AbortError'));
				if (!blob) return reject(new Error('image_encode_failed'));
				resolve(blob);
			},
			mimeType,
			quality,
		);
	});
}

/**
 * Re-encodes compatible images one at a time. Canvas output omits EXIF/GPS;
 * unsupported formats and larger encoded results retain the original file.
 */
export async function optimizeValentinaMemoriesImage(
	file: File,
	signal?: AbortSignal,
): Promise<File> {
	const mimeType = resolveValentinaMemoriesFileMimeType(file);
	const policy = mimeType ? getValentinaMemoriesMimePolicy(mimeType) : null;
	if (!mimeType || policy?.category !== 'image' || !OPTIMIZABLE_IMAGE_MIME_TYPES.has(mimeType))
		return file;
	if (typeof document === 'undefined' || typeof globalThis.createImageBitmap !== 'function') {
		return file;
	}

	throwIfAborted(signal);
	let bitmap: ImageBitmap | null = null;
	const canvas = document.createElement('canvas');
	try {
		bitmap = await globalThis.createImageBitmap(file, { imageOrientation: 'from-image' });
		throwIfAborted(signal);
		const scale = Math.min(
			1,
			VALENTINA_MEMORIES_IMAGE_OPTIMIZATION_MAX_DIMENSION_PX /
				Math.max(bitmap.width, bitmap.height),
		);
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const context = canvas.getContext('2d', { alpha: mimeType !== 'image/jpeg' });
		if (!context) return file;
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const optimized = await canvasToBlob(
			canvas,
			mimeType,
			VALENTINA_MEMORIES_IMAGE_OPTIMIZATION_QUALITY,
			signal,
		);
		if (optimized.size >= file.size) return file;
		return new File([optimized], file.name, {
			type: mimeType,
			lastModified: file.lastModified,
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw error;
		return file;
	} finally {
		bitmap?.close();
		canvas.width = 0;
		canvas.height = 0;
	}
}

export function validateValentinaMemoriesFile(file: File): ValentinaMemoriesCaptureIssue | null {
	const mimeType = resolveValentinaMemoriesFileMimeType(file);
	const policy = mimeType ? getValentinaMemoriesMimePolicy(mimeType) : null;
	if (!policy) return 'unsupported_type';
	if (file.size <= 0 || file.size > policy.maxBytes) return 'file_too_large';
	return null;
}

export async function measureVideoDurationSeconds(file: File): Promise<number> {
	const objectUrl = URL.createObjectURL(file);
	try {
		return await new Promise((resolve, reject) => {
			const video = document.createElement('video');
			video.preload = 'metadata';
			video.onloadedmetadata = () => resolve(video.duration);
			video.onerror = () => reject(new Error('video_metadata'));
			video.src = objectUrl;
		});
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

export async function validateValentinaMemoriesVideoDuration(
	file: File,
	readDurationSeconds: (candidate: File) => Promise<number> = measureVideoDurationSeconds,
): Promise<ValentinaMemoriesCaptureIssue | null> {
	const mimeType = resolveValentinaMemoriesFileMimeType(file);
	const policy = mimeType ? getValentinaMemoriesMimePolicy(mimeType) : null;
	if (policy?.category !== 'video') return null;

	try {
		const durationSeconds = await readDurationSeconds(file);
		if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 'video_unreadable';
		if (durationSeconds > VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS)
			return 'video_too_long';
		return null;
	} catch {
		return 'video_unreadable';
	}
}

export function mapValentinaMemoriesSignError(
	status: number,
	code: string | undefined,
): ValentinaMemoriesCaptureIssue {
	if (code === 'upload_window_closed') return 'window_closed';
	if (code === 'rate_limited' || status === 429) return 'rate_limited';
	if (code === 'limit_reached') return 'quota_reached';
	if (code === 'unsupported_mime') return 'unsupported_type';
	if (code === 'file_too_large') return 'file_too_large';
	return 'sign_failed';
}

export function valentinaMemoriesIssueCopy(
	issue: ValentinaMemoriesCaptureIssue,
): (typeof valentinaMemoriesCaptureCopy)[keyof typeof valentinaMemoriesCaptureCopy] {
	const copy = valentinaMemoriesCaptureCopy;
	if (issue === 'unsupported_type') return copy.unsupportedType;
	if (issue === 'file_too_large') return copy.fileTooLarge;
	if (issue === 'video_too_long') return copy.videoTooLong;
	if (issue === 'video_unreadable') return copy.videoUnreadable;
	if (issue === 'window_closed') return copy.windowClosed;
	if (issue === 'rate_limited') return copy.rateLimited;
	if (issue === 'quota_reached') return copy.quotaReached;
	if (issue === 'put_failed') return copy.putFailed;
	if (issue === 'network_failed') return copy.networkFailed;
	if (issue === 'unavailable') return copy.unavailable;
	return copy.signFailed;
}

export function readValentinaMemoriesSignErrorCode(payload: unknown): string | undefined {
	if (typeof payload !== 'object' || payload === null) return undefined;
	const error = (payload as { error?: { code?: unknown } }).error;
	return typeof error?.code === 'string' ? error.code : undefined;
}

export async function calculateFileSha256Hex(file: File | Blob): Promise<string> {
	const digest = sha256.create();
	for (let offset = 0; offset < file.size; offset += VALENTINA_MEMORIES_HASH_CHUNK_BYTES) {
		const chunk = file.slice(offset, offset + VALENTINA_MEMORIES_HASH_CHUNK_BYTES);
		digest.update(new Uint8Array(await chunk.arrayBuffer()));
	}
	return Array.from(digest.digest(), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateBulkZipPassphrase(): string {
	const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = new Uint8Array(16);
	if (!globalThis.crypto?.getRandomValues) throw new Error('Web Crypto no está disponible.');
	globalThis.crypto.getRandomValues(bytes);
	const raw = Array.from(bytes, (b) => charset[b % charset.length]).join('');
	return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export function createSecureClientRequestId(): string {
	if (!globalThis.crypto?.getRandomValues) throw new Error('Web Crypto no está disponible.');
	if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
	const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function partitionMemoriesExport(items: ExportableMediaItem[]): ExportableMediaItem[][] {
	const batches: ExportableMediaItem[][] = [];
	let current: ExportableMediaItem[] = [];
	let currentBytes = 0;
	for (const item of items) {
		if (
			current.length >= VALENTINA_MEMORIES_ARCHIVE_MAX_FILES ||
			currentBytes + item.sizeBytes > VALENTINA_MEMORIES_ARCHIVE_MAX_BYTES
		) {
			if (current.length > 0) batches.push(current);
			current = [];
			currentBytes = 0;
		}
		if (item.sizeBytes > VALENTINA_MEMORIES_ARCHIVE_MAX_BYTES)
			throw new Error('Un archivo individual supera el límite del lote cifrado.');
		current.push(item);
		currentBytes += item.sizeBytes;
	}
	if (current.length > 0) batches.push(current);
	return batches;
}

export type ExportableMediaItem = {
	id: string;
	mimeType: string;
	sizeBytes: number;
	caption?: string;
	createdAt: string;
};

export type BulkExportProgress = {
	completed: number;
	total: number;
	currentFileName: string;
};

export async function createEncryptedMemoriesZip(input: {
	items: ExportableMediaItem[];
	passphrase: string;
	fetchItemBlob: (item: ExportableMediaItem) => Promise<Blob>;
	onProgress?: (progress: BulkExportProgress) => void;
}): Promise<Blob> {
	const { BlobReader, BlobWriter, ZipWriter } = await import('@zip.js/zip.js');

	if (input.items.length === 0) {
		throw new Error('No hay archivos para exportar.');
	}
	if (input.items.length > VALENTINA_MEMORIES_ARCHIVE_MAX_FILES) {
		throw new Error(
			`El archivo supera el límite de ${VALENTINA_MEMORIES_ARCHIVE_MAX_FILES} archivos por descarga masiva.`,
		);
	}
	const totalBytes = input.items.reduce((acc, item) => acc + item.sizeBytes, 0);
	if (totalBytes > VALENTINA_MEMORIES_ARCHIVE_MAX_BYTES) {
		throw new Error('El archivo supera el límite de 128 MiB por descarga masiva.');
	}

	const zipWriter = new ZipWriter(new BlobWriter('application/zip'), {
		password: input.passphrase,
		encryptionStrength: 3, // WinZip AES-256
		zip64: false,
	});

	try {
		for (let index = 0; index < input.items.length; index += 1) {
			const item = input.items[index];
			const policy = getValentinaMemoriesMimePolicy(item.mimeType);
			const ext = policy?.extension ?? 'bin';
			const dateStr = item.createdAt.slice(0, 10);
			const filename = `recuerdos-valentina/${dateStr}-${item.id.slice(0, 8)}.${ext}`;

			input.onProgress?.({
				completed: index,
				total: input.items.length,
				currentFileName: filename,
			});

			const blob = await input.fetchItemBlob(item);
			await zipWriter.add(filename, new BlobReader(blob), {
				password: input.passphrase,
				encryptionStrength: 3, // WinZip AES-256
			});
		}

		input.onProgress?.({
			completed: input.items.length,
			total: input.items.length,
			currentFileName: 'Completado',
		});

		return await zipWriter.close();
	} catch (error) {
		await zipWriter.close().catch(() => undefined);
		throw error;
	}
}
