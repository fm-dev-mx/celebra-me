/**
 * Guest upload queue: several files run through `uploadMemoriesFile` without
 * tripping the server limits. At most `concurrency` uploads run at once (the
 * session's in-flight cap) and no more than `reservationsPerMinute` start in any
 * 60 s window (the Sign Worker limiter), so extra files wait instead of failing.
 * The queue pauses while the browser is offline and resumes when it reconnects.
 */

import {
	MEMORIES_SESSION_MAX_IN_FLIGHT,
	MEMORIES_SIGN_RATE_LIMIT,
} from '@/lib/memories/contract/limits';
import {
	isMemoriesVideoMime,
	resolveMemoriesFileMimeType,
	getMemoriesMimePolicy,
} from '@/lib/memories/contract/media-policy';
import type { MemoriesMediaStatus } from '@/lib/memories/contract/catalog';
import type { MemoriesCaptureIssue } from '@/lib/memories/client/media-prep';
import {
	MemoriesUploadError,
	createMemoriesUploadAttempt,
	readMemoriesUploadIssue,
	uploadMemoriesFile,
	type MemoriesUploadAttempt,
	type MemoriesUploadDeps,
	type MemoriesUploadPhase,
} from '@/lib/memories/client/upload-pipeline';

export type MemoriesQueueStatus =
	'ready' | 'invalid' | 'waiting' | MemoriesUploadPhase | 'done' | 'failed';

export interface MemoriesQueueEntry {
	id: string;
	file: File;
	status: MemoriesQueueStatus;
	/** 0–1 byte progress while uploading. */
	progress: number;
	issue: MemoriesCaptureIssue | null;
	result: MemoriesMediaStatus | null;
	captionSaved: boolean;
	itemId: string | null;
}

export interface MemoriesQueueSnapshot {
	entries: readonly MemoriesQueueEntry[];
	offline: boolean;
}

/** Issues that make every other pending file fail the same way: stop asking. */
const BLOCKING_ISSUES: ReadonlySet<MemoriesCaptureIssue> = new Set([
	'session_lost',
	'window_closed',
	'event_full',
	'quota_reached',
	'session_files_reached',
]);

const ACTIVE_STATUSES: ReadonlySet<MemoriesQueueStatus> = new Set([
	'optimizing',
	'preparing',
	'uploading',
	'confirming',
]);

export function isMemoriesQueueActive(entry: MemoriesQueueEntry): boolean {
	return ACTIVE_STATUSES.has(entry.status);
}

/** Checks what can be known before preparing the file: type and video size. */
export function precheckMemoriesFile(file: File): MemoriesCaptureIssue | null {
	const mimeType = resolveMemoriesFileMimeType(file);
	const policy = mimeType ? getMemoriesMimePolicy(mimeType) : null;
	if (!mimeType || !policy) return 'unsupported_type';
	// Images shrink when optimized, so only videos can be judged by their size now.
	if (isMemoriesVideoMime(mimeType) && file.size > policy.maxBytes) return 'video_too_large';
	if (file.size <= 0) return 'file_too_large';
	return null;
}

export interface MemoriesUploadQueueOptions {
	deps: MemoriesUploadDeps;
	concurrency?: number;
	reservationsPerMinute?: number;
	now?: () => number;
	setTimer?: (callback: () => void, ms: number) => unknown;
	clearTimer?: (handle: unknown) => void;
	isOnline?: () => boolean;
}

let nextEntryId = 0;

export class MemoriesUploadQueue {
	private entries: MemoriesQueueEntry[] = [];
	private readonly attempts = new Map<string, MemoriesUploadAttempt>();
	private readonly listeners = new Set<() => void>();
	private readonly reservationTimes: number[] = [];
	private snapshot: MemoriesQueueSnapshot;
	private offline: boolean;
	private timer: unknown = null;
	private caption = '';
	private readonly concurrency: number;
	private readonly perMinute: number;
	private readonly now: () => number;
	private readonly setTimer: (callback: () => void, ms: number) => unknown;
	private readonly clearTimer: (handle: unknown) => void;

	constructor(private readonly options: MemoriesUploadQueueOptions) {
		this.concurrency = options.concurrency ?? MEMORIES_SESSION_MAX_IN_FLIGHT;
		this.perMinute = options.reservationsPerMinute ?? MEMORIES_SIGN_RATE_LIMIT.limit;
		this.now = options.now ?? (() => Date.now());
		this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
		this.clearTimer =
			options.clearTimer ??
			((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
		this.offline = !(options.isOnline ?? (() => true))();
		this.snapshot = { entries: [], offline: this.offline };
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = (): MemoriesQueueSnapshot => this.snapshot;

	/** Adds files in the `ready` state, or `invalid` with the reason when they cannot be sent. */
	add(files: Iterable<File>): void {
		for (const file of files) {
			nextEntryId += 1;
			const issue = precheckMemoriesFile(file);
			this.entries.push({
				id: `upload-${nextEntryId}`,
				file,
				status: issue ? 'invalid' : 'ready',
				progress: 0,
				issue,
				result: null,
				captionSaved: true,
				itemId: null,
			});
		}
		this.emit();
	}

	remove(id: string): void {
		const entry = this.entries.find((candidate) => candidate.id === id);
		if (!entry || isMemoriesQueueActive(entry)) return;
		this.entries = this.entries.filter((candidate) => candidate.id !== id);
		this.attempts.delete(id);
		this.emit();
	}

	/** Queues every ready file with one shared caption. */
	start(caption = ''): void {
		this.caption = caption;
		for (const entry of this.entries) {
			if (entry.status === 'ready') this.patch(entry.id, { status: 'waiting' });
		}
		this.pump();
	}

	retry(id: string): void {
		const entry = this.entries.find((candidate) => candidate.id === id);
		if (!entry || entry.status !== 'failed') return;
		this.patch(id, { status: 'waiting', issue: null, progress: 0 });
		this.pump();
	}

	/** Drops files that have not started; running uploads finish. */
	cancelPending(): void {
		this.entries = this.entries.filter(
			(entry) => entry.status !== 'waiting' && entry.status !== 'ready',
		);
		this.emit();
	}

	/** Forgets every file that is not running or waiting, so a new batch can start. */
	clearFinished(): void {
		this.entries = this.entries.filter(
			(entry) => isMemoriesQueueActive(entry) || entry.status === 'waiting',
		);
		for (const id of [...this.attempts.keys()]) {
			if (!this.entries.some((entry) => entry.id === id)) this.attempts.delete(id);
		}
		this.emit();
	}

	setOnline(online: boolean): void {
		if (this.offline === !online) return;
		this.offline = !online;
		this.emit();
		if (online) this.pump();
	}

	dispose(): void {
		if (this.timer !== null) this.clearTimer(this.timer);
		this.timer = null;
		this.listeners.clear();
	}

	private patch(id: string, changes: Partial<MemoriesQueueEntry>): void {
		this.entries = this.entries.map((entry) =>
			entry.id === id ? { ...entry, ...changes } : entry,
		);
		this.emit();
	}

	private emit(): void {
		this.snapshot = { entries: this.entries, offline: this.offline };
		for (const listener of this.listeners) listener();
	}

	/** Milliseconds until another reservation fits the per-minute budget; 0 when it fits now. */
	private budgetDelay(): number {
		const windowStart = this.now() - 60_000;
		while (this.reservationTimes.length > 0 && this.reservationTimes[0] <= windowStart)
			this.reservationTimes.shift();
		if (this.reservationTimes.length < this.perMinute) return 0;
		return this.reservationTimes[0] - windowStart;
	}

	private pump(): void {
		if (this.offline) return;
		let active = this.entries.filter(isMemoriesQueueActive).length;
		for (const entry of this.entries) {
			if (active >= this.concurrency) return;
			if (entry.status !== 'waiting') continue;
			const delay = this.budgetDelay();
			if (delay > 0) {
				if (this.timer === null) {
					this.timer = this.setTimer(() => {
						this.timer = null;
						this.pump();
					}, delay);
				}
				return;
			}
			this.reservationTimes.push(this.now());
			active += 1;
			void this.run(entry.id);
		}
	}

	private async run(id: string): Promise<void> {
		const entry = this.entries.find((candidate) => candidate.id === id);
		if (!entry) return;
		let attempt = this.attempts.get(id);
		if (!attempt) {
			attempt = createMemoriesUploadAttempt(entry.file, this.caption);
			this.attempts.set(id, attempt);
		}
		this.patch(id, { status: 'preparing', progress: 0 });
		try {
			const result = await uploadMemoriesFile(attempt, this.options.deps, {
				onPhase: (phase) => this.patch(id, { status: phase }),
				onProgress: (progress) => this.patch(id, { progress }),
			});
			this.patch(id, {
				status: 'done',
				progress: 1,
				result: result.status,
				captionSaved: result.captionSaved,
				itemId: result.itemId,
			});
		} catch (error) {
			const issue =
				error instanceof MemoriesUploadError ? error.issue : readMemoriesUploadIssue(error);
			this.patch(id, { status: 'failed', issue });
			if (BLOCKING_ISSUES.has(issue)) {
				for (const other of this.entries) {
					if (other.status === 'waiting')
						this.patch(other.id, { status: 'failed', issue });
				}
			}
		} finally {
			this.pump();
		}
	}
}
