import {
	VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	VALENTINA_MEMORIES_PRODUCTION_SIGN_URL,
	VALENTINA_MEMORIES_SIGN_PATH,
	getValentinaMemoriesMimePolicy,
} from '@/data/valentina-memories-upload.contract';
import {
	VALENTINA_MEMORIES_ARCHIVE_MAX_BYTES,
	VALENTINA_MEMORIES_ARCHIVE_MAX_FILES,
} from '@/data/valentina-memories-media.contract';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';

const PRODUCTION_SIGN_ORIGIN = new URL(VALENTINA_MEMORIES_PRODUCTION_SIGN_URL).origin;
const LOCAL_SIGN_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export type ValentinaMemoriesCaptureIssue =
	| 'unsupported_type'
	| 'file_too_large'
	| 'video_too_long'
	| 'video_unreadable'
	| 'window_closed'
	| 'rate_limited'
	| 'sign_failed'
	| 'put_failed'
	| 'network_failed'
	| 'unavailable';

export function resolveValentinaMemoriesSignUrl(raw: string | undefined): string | null {
	const value = raw?.trim();
	if (!value) return null;

	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		if (url.pathname !== VALENTINA_MEMORIES_SIGN_PATH) return null;
		if (url.username || url.password) return null;
		if (url.search || url.hash) return null;
		const isProductionSigner = url.origin === PRODUCTION_SIGN_ORIGIN;
		const isLocalSigner = url.protocol === 'http:' && LOCAL_SIGN_HOSTS.has(url.hostname);
		if (!isProductionSigner && !isLocalSigner) return null;
		return url.toString();
	} catch {
		return null;
	}
}

export function validateValentinaMemoriesFile(file: File): ValentinaMemoriesCaptureIssue | null {
	const policy = getValentinaMemoriesMimePolicy(file.type);
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
	const policy = getValentinaMemoriesMimePolicy(file.type);
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
	let buffer: ArrayBuffer;
	if (typeof file.arrayBuffer === 'function') {
		buffer = await file.arrayBuffer();
	} else if (typeof FileReader !== 'undefined') {
		buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as ArrayBuffer);
			reader.onerror = () => reject(reader.error);
			reader.readAsArrayBuffer(file);
		});
	} else {
		buffer = await new Response(file).arrayBuffer();
	}
	const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
		'',
	);
}

export function generateBulkZipPassphrase(): string {
	const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = new Uint8Array(16);
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i += 1) {
			bytes[i] = Math.floor(Math.random() * 256);
		}
	}
	const raw = Array.from(bytes, (b) => charset[b % charset.length]).join('');
	return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
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
