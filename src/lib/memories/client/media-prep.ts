/**
 * Browser-only media preparation: image optimization, validation, video
 * duration probing and file hashing.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { MEMORIES_HASH_CHUNK_BYTES } from '@/lib/memories/contract/limits';
import {
	MEMORIES_IMAGE_OPTIMIZATION_MAX_DIMENSION_PX,
	MEMORIES_IMAGE_OPTIMIZATION_QUALITY,
	MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	getMemoriesMimePolicy,
	resolveMemoriesFileMimeType,
} from '@/lib/memories/contract/media-policy';
import { memoriesCaptureCopy } from '@/lib/memories/copy';
import { MemoriesRequestError } from './api';

export type MemoriesCaptureIssue =
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

const ISSUE_COPY: Record<MemoriesCaptureIssue, keyof typeof memoriesCaptureCopy> = {
	unsupported_type: 'unsupportedType',
	file_too_large: 'fileTooLarge',
	video_too_long: 'videoTooLong',
	video_unreadable: 'videoUnreadable',
	window_closed: 'windowClosed',
	rate_limited: 'rateLimited',
	quota_reached: 'quotaReached',
	sign_failed: 'signFailed',
	put_failed: 'putFailed',
	network_failed: 'networkFailed',
	unavailable: 'unavailable',
};

export function memoriesIssueCopy(issue: MemoriesCaptureIssue): string {
	return memoriesCaptureCopy[ISSUE_COPY[issue]];
}

export function classifyTransportIssue(
	fallback: MemoriesCaptureIssue,
	isOnline = typeof navigator === 'undefined' || navigator.onLine,
): MemoriesCaptureIssue {
	return isOnline ? fallback : 'network_failed';
}

/** Maps API failures (status + error code) to a guest-facing issue. */
export function mapRequestIssue(
	error: unknown,
	fallback: MemoriesCaptureIssue,
): MemoriesCaptureIssue {
	if (!(error instanceof MemoriesRequestError)) return classifyTransportIssue(fallback);
	if (error.status === null) return classifyTransportIssue(fallback);
	if (error.status === 429 || error.code === 'rate_limited') return 'rate_limited';
	if (error.code === 'limit_reached') return 'quota_reached';
	if (error.status === 403) return 'window_closed';
	if (error.status === 404 || error.status === 503) return 'unavailable';
	return fallback;
}

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
export async function optimizeMemoriesImage(file: File, signal?: AbortSignal): Promise<File> {
	const mimeType = resolveMemoriesFileMimeType(file);
	const policy = mimeType ? getMemoriesMimePolicy(mimeType) : null;
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
			MEMORIES_IMAGE_OPTIMIZATION_MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height),
		);
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const context = canvas.getContext('2d', { alpha: mimeType !== 'image/jpeg' });
		if (!context) return file;
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const optimized = await canvasToBlob(
			canvas,
			mimeType,
			MEMORIES_IMAGE_OPTIMIZATION_QUALITY,
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

export function validateMemoriesFile(file: File): MemoriesCaptureIssue | null {
	const mimeType = resolveMemoriesFileMimeType(file);
	const policy = mimeType ? getMemoriesMimePolicy(mimeType) : null;
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

export async function validateMemoriesVideoDuration(
	file: File,
	readDurationSeconds: (candidate: File) => Promise<number> = measureVideoDurationSeconds,
): Promise<MemoriesCaptureIssue | null> {
	const mimeType = resolveMemoriesFileMimeType(file);
	const policy = mimeType ? getMemoriesMimePolicy(mimeType) : null;
	if (policy?.category !== 'video') return null;
	try {
		const durationSeconds = await readDurationSeconds(file);
		if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 'video_unreadable';
		if (durationSeconds > MEMORIES_MAX_VIDEO_DURATION_SECONDS) return 'video_too_long';
		return null;
	} catch {
		return 'video_unreadable';
	}
}

export async function calculateFileSha256Hex(file: File | Blob): Promise<string> {
	const digest = sha256.create();
	for (let offset = 0; offset < file.size; offset += MEMORIES_HASH_CHUNK_BYTES) {
		const chunk = file.slice(offset, offset + MEMORIES_HASH_CHUNK_BYTES);
		digest.update(new Uint8Array(await chunk.arrayBuffer()));
	}
	return Array.from(digest.digest() as Uint8Array, (byte) =>
		byte.toString(16).padStart(2, '0'),
	).join('');
}

export function createSecureClientRequestId(): string {
	if (!globalThis.crypto?.getRandomValues) throw new Error('Web Crypto is not available.');
	if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
	const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
