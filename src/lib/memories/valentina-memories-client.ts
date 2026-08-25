import {
	VALENTINA_MEMORIES_MAX_VIDEO_DURATION_SECONDS,
	VALENTINA_MEMORIES_SIGN_PATH,
	getValentinaMemoriesMimePolicy,
} from '@/data/valentina-memories-upload.contract';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';

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
