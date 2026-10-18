/**
 * Guest upload queue: several files run through `uploadMemoriesFile` without
 * tripping the server limits. At most `concurrency` uploads run at once (the
 * session's in-flight cap) and no more than `reservationsPerMinute` start in any
 * 60 s window (the Sign Worker limiter), so extra files wait instead of failing.
 * The queue pauses while the browser is offline and resumes when it reconnects;
 * uploads that failed for lack of signal go back in line with the same attempt.
 * Browsers do not always announce the reconnection, so the queue also checks
 * the connection itself every few seconds while it waits.
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

type MemoriesQueueStatus =
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

/** Automatic retries per file after a dropped signal; later ones need the guest. */
const MAX_AUTO_RESUMES = 3;

const DEFAULT_RECHECK_MS = 5_000;

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
	/** How often to recheck the connection while offline or holding a dropped upload. */
	recheckMs?: number;
}

let nextEntryId = 0;

export class MemoriesUploadQueue {
	private entries: MemoriesQueueEntry[] = [];
	private readonly attempts = new Map<string, MemoriesUploadAttempt>();
	/** Failed entries the next reconnection retries on its own. */
	private readonly resumeOnline = new Set<string>();
	private readonly autoResumes = new Map<string, number>();
	private recheckTimer: unknown = null;
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
	private readonly isOnline: () => boolean;
	private readonly recheckMs: number;

	constructor(private readonly options: MemoriesUploadQueueOptions) {
		this.concurrency = options.concurrency ?? MEMORIES_SESSION_MAX_IN_FLIGHT;
		this.perMinute = options.reservationsPerMinute ?? MEMORIES_SIGN_RATE_LIMIT.limit;
		this.now = options.now ?? (() => Date.now());
		this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
		this.clearTimer =
			options.clearTimer ??
			((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
		this.isOnline = options.isOnline ?? (() => true);
		this.recheckMs = options.recheckMs ?? DEFAULT_RECHECK_MS;
		this.offline = !this.isOnline();
		this.snapshot = { entries: [], offline: this.offline };
		if (this.offline) this.scheduleRecheck();
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
		this.resumeOnline.delete(id);
		this.autoResumes.delete(id);
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
		this.resumeOnline.delete(id);
		this.autoResumes.delete(id);
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
		for (const id of [...this.attempts.keys(), ...this.resumeOnline]) {
			if (!this.entries.some((entry) => entry.id === id)) {
				this.attempts.delete(id);
				this.resumeOnline.delete(id);
				this.autoResumes.delete(id);
			}
		}
		this.emit();
	}

	setOnline(online: boolean): void {
		if (this.offline === !online && !(online && this.resumeOnline.size > 0)) return;
		this.offline = !online;
		if (online) {
			// The attempt keeps its client request id, so the server recognizes the same upload.
			for (const id of this.resumeOnline) {
				const entry = this.entries.find((candidate) => candidate.id === id);
				if (entry?.status !== 'failed') continue;
				this.autoResumes.set(id, (this.autoResumes.get(id) ?? 0) + 1);
				this.patch(id, { status: 'waiting', issue: null, progress: 0 });
			}
			this.resumeOnline.clear();
		} else {
			this.scheduleRecheck();
		}
		this.emit();
		if (online) this.pump();
	}

	dispose(): void {
		if (this.timer !== null) this.clearTimer(this.timer);
		if (this.recheckTimer !== null) this.clearTimer(this.recheckTimer);
		this.timer = null;
		this.recheckTimer = null;
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

	/** Reads the connection again later, in case the browser never fires `online`. */
	private scheduleRecheck(): void {
		if (this.recheckTimer !== null) return;
		this.recheckTimer = this.setTimer(() => {
			this.recheckTimer = null;
			if (this.isOnline()) this.setOnline(true);
			if (this.offline || this.resumeOnline.size > 0) this.scheduleRecheck();
		}, this.recheckMs);
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
			const dropped =
				issue === 'network_failed' ||
				this.offline ||
				(error instanceof MemoriesUploadError && error.transport);
			if (dropped && (this.autoResumes.get(id) ?? 0) < MAX_AUTO_RESUMES) {
				this.resumeOnline.add(id);
				this.scheduleRecheck();
			}
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
