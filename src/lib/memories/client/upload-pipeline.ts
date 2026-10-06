/**
 * One guest upload, end to end: optimize, validate, hash, reserve, PUT the
 * original to the signed URL, confirm and save the caption. Browser-only.
 *
 * The attempt object carries what must survive a retry: the prepared file, the
 * measured video duration and the client request id. A retry reuses the request
 * id so the server recognizes the same upload; an expired reservation gets a new
 * one because the server closed the old id for good.
 */

import {
	isMemoriesTerminalStatus,
	type MemoriesMediaStatus,
} from '@/lib/memories/contract/catalog';
import {
	isMemoriesVideoMime,
	resolveMemoriesFileMimeType,
} from '@/lib/memories/contract/media-policy';
import {
	MemoriesRequestError,
	type MemoriesGuestApi,
	type MemoriesReservation,
} from '@/lib/memories/client/api';
import {
	calculateFileSha256Hex,
	classifyTransportIssue,
	createMemoriesThumbnail,
	createSecureClientRequestId,
	mapRequestIssue,
	measureVideoDurationSeconds,
	optimizeMemoriesImage,
	validateMemoriesFile,
	validateMemoriesVideoDuration,
	type MemoriesCaptureIssue,
} from '@/lib/memories/client/media-prep';

const COMPLETION_ATTEMPTS = 3;

export class MemoriesUploadError extends Error {
	constructor(readonly issue: MemoriesCaptureIssue) {
		super(issue);
		this.name = 'MemoriesUploadError';
	}
}

export function readMemoriesUploadIssue(error: unknown): MemoriesCaptureIssue {
	if (error instanceof MemoriesUploadError) return error.issue;
	return mapRequestIssue(error, 'sign_failed');
}

export type MemoriesSignedUpload = NonNullable<MemoriesReservation['upload']>;

/** Sends the original bytes; resolves with the HTTP status. Rejects on a transport failure. */
export type MemoriesPutTransport = (
	upload: MemoriesSignedUpload,
	file: File,
	onProgress: (fraction: number) => void,
) => Promise<number>;

/** `fetch` transport: no byte progress, used where XHR is unavailable. */
export const fetchPutTransport: MemoriesPutTransport = async (upload, file, onProgress) => {
	const response = await fetch(upload.uploadUrl, {
		method: 'PUT',
		headers: upload.requiredHeaders,
		body: file,
	});
	onProgress(1);
	return response.status;
};

/** XHR transport: reports upload progress, which `fetch` cannot. */
export const xhrPutTransport: MemoriesPutTransport = (upload, file, onProgress) =>
	new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open('PUT', upload.uploadUrl);
		for (const [name, value] of Object.entries(upload.requiredHeaders)) {
			request.setRequestHeader(name, value);
		}
		request.upload.onprogress = (event) => {
			if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
		};
		request.onload = () => {
			onProgress(1);
			resolve(request.status);
		};
		request.onerror = () => reject(new TypeError('upload_network_error'));
		request.onabort = () => reject(new DOMException('Upload aborted.', 'AbortError'));
		request.send(file);
	});

export const defaultPutTransport: MemoriesPutTransport =
	typeof XMLHttpRequest === 'undefined' ? fetchPutTransport : xhrPutTransport;

export type MemoriesUploadPhase = 'optimizing' | 'preparing' | 'uploading' | 'confirming';

export interface MemoriesUploadAttempt {
	readonly file: File;
	caption: string;
	requestId: string;
	prepared: File | null;
	durationSeconds?: number;
}

export interface MemoriesUploadDeps {
	api: MemoriesGuestApi;
	putFile?: MemoriesPutTransport;
	optimizeImage?: (file: File, signal?: AbortSignal) => Promise<File>;
	readVideoDurationSeconds?: (file: File) => Promise<number>;
	/** Renders the WebP preview; null skips it. Defaults to the canvas renderer. */
	createThumbnail?: (file: File) => Promise<File | null>;
	signal?: AbortSignal;
}

export interface MemoriesUploadHooks {
	onPhase?: (phase: MemoriesUploadPhase) => void;
	onProgress?: (fraction: number) => void;
}

export interface MemoriesUploadResult {
	itemId: string;
	status: MemoriesMediaStatus;
	/** False when the file was saved but its caption was not. */
	captionSaved: boolean;
}

export function createMemoriesUploadAttempt(file: File, caption = ''): MemoriesUploadAttempt {
	return { file, caption, requestId: createSecureClientRequestId(), prepared: null };
}

async function putOriginal(
	transport: MemoriesPutTransport,
	upload: MemoriesSignedUpload,
	file: File,
	onProgress: (fraction: number) => void,
): Promise<void> {
	let status: number;
	try {
		status = await transport(upload, file, onProgress);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw error;
		throw new MemoriesUploadError(classifyTransportIssue('put_failed'));
	}
	// 412: an earlier PUT of this reservation already stored the object.
	if ((status < 200 || status >= 300) && status !== 412)
		throw new MemoriesUploadError('put_failed');
}

async function completeReserved(
	api: MemoriesGuestApi,
	itemId: string,
): Promise<MemoriesMediaStatus> {
	let lastError: unknown;
	for (let attempt = 0; attempt < COMPLETION_ATTEMPTS; attempt += 1) {
		try {
			const payload = await api.complete(itemId);
			if (isMemoriesTerminalStatus(payload.item.status)) return payload.item.status;
		} catch (error) {
			lastError = error;
			// The reservation was released after being abandoned; retrying cannot revive it.
			if (error instanceof MemoriesRequestError && error.status === 404)
				throw new MemoriesUploadError('upload_expired');
			if (error instanceof MemoriesRequestError && error.status === 401)
				throw new MemoriesUploadError('session_lost');
			// A bounded idempotent retry handles transient completion failures.
		}
		if (attempt < COMPLETION_ATTEMPTS - 1)
			await new Promise((resolve) => setTimeout(resolve, 300 * 3 ** attempt));
	}
	throw new MemoriesUploadError(mapRequestIssue(lastError, 'put_failed'));
}

async function prepare(
	attempt: MemoriesUploadAttempt,
	mimeType: string,
	deps: MemoriesUploadDeps,
	hooks: MemoriesUploadHooks,
): Promise<File> {
	if (attempt.prepared) return attempt.prepared;
	if (!isMemoriesVideoMime(mimeType)) hooks.onPhase?.('optimizing');
	let prepared: File;
	try {
		prepared = await (deps.optimizeImage ?? optimizeMemoriesImage)(attempt.file, deps.signal);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw error;
		throw new MemoriesUploadError('unavailable');
	}
	attempt.prepared = prepared;
	return prepared;
}

/**
 * Sends the preview after the original is accepted. Any failure is ignored: the
 * gallery falls back to the original, so a missing thumbnail is never an error.
 */
async function attachThumbnail(
	deps: MemoriesUploadDeps,
	itemId: string,
	source: File,
): Promise<void> {
	if (!deps.api.reserveThumbnail || !deps.api.confirmThumbnail) return;
	try {
		const thumbnail = await (deps.createThumbnail ?? createMemoriesThumbnail)(source);
		if (!thumbnail) return;
		const { upload } = await deps.api.reserveThumbnail(itemId, {
			sizeBytes: thumbnail.size,
			checksumSha256: await calculateFileSha256Hex(thumbnail),
		});
		if (upload) {
			const status = await (deps.putFile ?? defaultPutTransport)(upload, thumbnail, () => {
				// A 96 KiB preview needs no progress bar.
			});
			if ((status < 200 || status >= 300) && status !== 412) return;
		}
		await deps.api.confirmThumbnail(itemId);
	} catch {
		// Best effort by design.
	}
}

/** Runs one attempt; throws `MemoriesUploadError` with the guest-facing issue on failure. */
export async function uploadMemoriesFile(
	attempt: MemoriesUploadAttempt,
	deps: MemoriesUploadDeps,
	hooks: MemoriesUploadHooks = {},
): Promise<MemoriesUploadResult> {
	const mimeType = resolveMemoriesFileMimeType(attempt.file);
	if (!mimeType) throw new MemoriesUploadError('unsupported_type');
	hooks.onPhase?.('preparing');
	const file = await prepare(attempt, mimeType, deps, hooks);
	hooks.onPhase?.('preparing');
	const fileIssue = validateMemoriesFile(file);
	if (fileIssue) throw new MemoriesUploadError(fileIssue);
	const durationIssue = await validateMemoriesVideoDuration(file, async (candidate) => {
		attempt.durationSeconds = await (
			deps.readVideoDurationSeconds ?? measureVideoDurationSeconds
		)(candidate);
		return attempt.durationSeconds;
	});
	if (durationIssue) throw new MemoriesUploadError(durationIssue);
	try {
		const checksumSha256 = await calculateFileSha256Hex(file);
		const reservation = await deps.api.reserve({
			mimeType,
			sizeBytes: file.size,
			checksumSha256,
			durationSeconds: attempt.durationSeconds,
			clientRequestId: attempt.requestId,
		});
		if (reservation.upload) {
			hooks.onPhase?.('uploading');
			await putOriginal(
				deps.putFile ?? defaultPutTransport,
				reservation.upload,
				file,
				(fraction) => hooks.onProgress?.(fraction),
			);
		}
		hooks.onPhase?.('confirming');
		const status = await completeReserved(deps.api, reservation.item.id);
		const caption = attempt.caption.trim();
		let captionSaved = true;
		if (caption) {
			try {
				await deps.api.updateCaption(reservation.item.id, caption);
			} catch {
				captionSaved = false;
			}
		}
		if (status === 'accepted')
			await attachThumbnail(deps, reservation.item.id, attempt.prepared ?? attempt.file);
		return { itemId: reservation.item.id, status, captionSaved };
	} catch (error) {
		const issue = readMemoriesUploadIssue(error);
		// A closed request id can never be reused: the next attempt starts over.
		if (issue === 'upload_expired') attempt.requestId = createSecureClientRequestId();
		if (error instanceof MemoriesUploadError) throw error;
		throw new MemoriesUploadError(issue);
	}
}
