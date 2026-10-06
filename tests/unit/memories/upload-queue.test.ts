import { webcrypto } from 'node:crypto';
import { MemoriesRequestError, type MemoriesGuestApi } from '@/lib/memories/client/api';
import { MEMORIES_MAX_VIDEO_BYTES } from '@/lib/memories/contract/media-policy';
import {
	MemoriesUploadQueue,
	precheckMemoriesFile,
	type MemoriesQueueSnapshot,
} from '@/lib/memories/client/upload-queue';
import { xhrPutTransport, type MemoriesPutTransport } from '@/lib/memories/client/upload-pipeline';
import { buildMemoriesCalendarFile } from '@/lib/memories/client/calendar';

jest.mock('@/lib/memories/client/media-prep', () => {
	const actual = jest.requireActual<typeof import('@/lib/memories/client/media-prep')>(
		'@/lib/memories/client/media-prep',
	);
	return { ...actual, calculateFileSha256Hex: jest.fn(async () => 'ab'.repeat(32)) };
});

Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });

const png = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function fakeApi() {
	return {
		reserve: jest.fn(),
		complete: jest.fn(async () => ({ item: { status: 'accepted' } })),
		updateCaption: jest.fn(async () => ({})),
		reserveThumbnail: jest.fn(),
		confirmThumbnail: jest.fn(),
	} as unknown as jest.Mocked<MemoriesGuestApi>;
}

async function flush(): Promise<void> {
	for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

function statuses(snapshot: MemoriesQueueSnapshot): string[] {
	return snapshot.entries.map((entry) => entry.status);
}

describe('MemoriesUploadQueue', () => {
	const passThrough = { optimizeImage: async (file: File) => file };

	it('runs at most two uploads at once and starts the next when one finishes', async () => {
		const api = fakeApi();
		const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
		let put = 0;
		api.reserve.mockImplementation(
			async () =>
				({
					item: { id: `item-${put}` },
					upload: { uploadUrl: 'https://upload.invalid', requiredHeaders: {} },
				}) as never,
		);
		const queue = new MemoriesUploadQueue({
			deps: { api, ...passThrough, putFile: () => gates[put++].promise },
		});
		queue.add([png('a.png'), png('b.png'), png('c.png')]);
		queue.start();
		await flush();

		expect(statuses(queue.getSnapshot())).toEqual(['uploading', 'uploading', 'waiting']);
		gates[0].resolve(201);
		await flush();
		expect(statuses(queue.getSnapshot())).toEqual(['done', 'uploading', 'uploading']);
		gates[1].resolve(201);
		gates[2].resolve(201);
		await flush();
		expect(statuses(queue.getSnapshot())).toEqual(['done', 'done', 'done']);
	});

	it('keeps files waiting once the per-minute reservation budget is spent', async () => {
		const api = fakeApi();
		api.reserve.mockResolvedValue({ item: { id: 'item' }, upload: null } as never);
		let now = 0;
		const timers: Array<{ at: number; run: () => void }> = [];
		const queue = new MemoriesUploadQueue({
			deps: { api, ...passThrough },
			concurrency: 5,
			reservationsPerMinute: 2,
			now: () => now,
			setTimer: (run, ms) => timers.push({ at: now + ms, run }),
			clearTimer: () => undefined,
		});
		queue.add([png('a.png'), png('b.png'), png('c.png')]);
		queue.start();
		await flush();

		expect(api.reserve).toHaveBeenCalledTimes(2);
		expect(statuses(queue.getSnapshot())).toEqual(['done', 'done', 'waiting']);
		expect(timers).toHaveLength(1);
		expect(timers[0].at).toBe(60_000);

		now = 60_000;
		timers[0].run();
		await flush();
		expect(api.reserve).toHaveBeenCalledTimes(3);
		expect(statuses(queue.getSnapshot())).toEqual(['done', 'done', 'done']);
	});

	it('pauses while offline and resumes when the connection returns', async () => {
		const api = fakeApi();
		api.reserve.mockResolvedValue({ item: { id: 'item' }, upload: null } as never);
		const queue = new MemoriesUploadQueue({
			deps: { api, ...passThrough },
			isOnline: () => false,
		});
		queue.add([png('a.png')]);
		queue.start();
		await flush();
		expect(queue.getSnapshot().offline).toBe(true);
		expect(statuses(queue.getSnapshot())).toEqual(['waiting']);

		queue.setOnline(true);
		await flush();
		expect(statuses(queue.getSnapshot())).toEqual(['done']);
	});

	it('fails the waiting files at once when the session cannot take more', async () => {
		const api = fakeApi();
		api.reserve.mockRejectedValue(
			new MemoriesRequestError(409, 'limit_reached', 'session_files'),
		);
		const queue = new MemoriesUploadQueue({ deps: { api, ...passThrough }, concurrency: 1 });
		queue.add([png('a.png'), png('b.png'), png('c.png')]);
		queue.start();
		await flush();

		expect(api.reserve).toHaveBeenCalledTimes(1);
		expect(queue.getSnapshot().entries.map((entry) => entry.issue)).toEqual([
			'session_files_reached',
			'session_files_reached',
			'session_files_reached',
		]);
	});

	it('marks files it can judge before preparing them as invalid', () => {
		const video = new File([new Uint8Array(4)], 'largo.mp4', { type: 'video/mp4' });
		Object.defineProperty(video, 'size', { value: MEMORIES_MAX_VIDEO_BYTES + 1 });
		expect(precheckMemoriesFile(video)).toBe('video_too_large');
		expect(precheckMemoriesFile(new File(['x'], 'nota.txt', { type: 'text/plain' }))).toBe(
			'unsupported_type',
		);
		expect(precheckMemoriesFile(png('ok.png'))).toBeNull();
	});
});

describe('thumbnail step', () => {
	const upload = { uploadUrl: 'https://upload.invalid', requiredHeaders: {}, expiresAt: '' };

	it('sends the preview after an accepted upload and confirms it', async () => {
		const api = fakeApi();
		api.reserve.mockResolvedValue({ item: { id: 'item-1' }, upload } as never);
		api.reserveThumbnail.mockResolvedValue({ upload });
		api.confirmThumbnail.mockResolvedValue({ hasThumbnail: true });
		const putFile = jest.fn<Promise<number>, Parameters<MemoriesPutTransport>>(async () => 201);
		const thumbnail = new File([new Uint8Array(10)], 'thumbnail.webp', { type: 'image/webp' });
		const queue = new MemoriesUploadQueue({
			deps: {
				api,
				optimizeImage: async (file: File) => file,
				putFile,
				createThumbnail: async () => thumbnail,
			},
		});
		queue.add([png('a.png')]);
		queue.start();
		await flush();

		expect(statuses(queue.getSnapshot())).toEqual(['done']);
		expect(putFile).toHaveBeenCalledTimes(2);
		expect(putFile.mock.calls[1][1]).toBe(thumbnail);
		expect(api.reserveThumbnail).toHaveBeenCalledWith('item-1', {
			sizeBytes: 10,
			checksumSha256: 'ab'.repeat(32),
		});
		expect(api.confirmThumbnail).toHaveBeenCalledWith('item-1');
	});

	it('still counts the upload as saved when the preview fails', async () => {
		const api = fakeApi();
		api.reserve.mockResolvedValue({ item: { id: 'item-1' }, upload: null } as never);
		api.reserveThumbnail.mockRejectedValue(new Error('signer down'));
		const queue = new MemoriesUploadQueue({
			deps: {
				api,
				optimizeImage: async (file: File) => file,
				createThumbnail: async () => png('t.webp'),
			},
		});
		queue.add([png('a.png')]);
		queue.start();
		await flush();

		expect(statuses(queue.getSnapshot())).toEqual(['done']);
		expect(api.confirmThumbnail).not.toHaveBeenCalled();
	});
});

describe('xhrPutTransport', () => {
	it('sends the signed headers and reports upload progress', async () => {
		const sent: Record<string, string> = {};
		const instances: FakeXhr[] = [];
		class FakeXhr {
			status = 0;
			upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			onabort: (() => void) | null = null;
			method = '';
			url = '';
			constructor() {
				instances.push(this);
			}
			open(method: string, url: string) {
				this.method = method;
				this.url = url;
			}
			setRequestHeader(name: string, value: string) {
				sent[name] = value;
			}
			send() {
				this.upload.onprogress?.({
					lengthComputable: true,
					loaded: 1,
					total: 4,
				} as ProgressEvent);
				this.status = 201;
				this.onload?.();
			}
		}
		const original = globalThis.XMLHttpRequest;
		globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
		const progress: number[] = [];
		try {
			const status = await xhrPutTransport(
				{
					uploadUrl: 'https://upload.invalid/put',
					requiredHeaders: { Authorization: 'Bearer token' },
					expiresAt: '2026-10-31T02:05:00.000Z',
				},
				png('a.png'),
				(fraction) => progress.push(fraction),
			);
			expect(status).toBe(201);
			expect(instances[0].method).toBe('PUT');
			expect(sent).toEqual({ Authorization: 'Bearer token' });
			expect(progress).toEqual([0.25, 1]);
		} finally {
			globalThis.XMLHttpRequest = original;
		}
	});
});

describe('buildMemoriesCalendarFile', () => {
	it('writes one UTC event with escaped text', () => {
		const file = buildMemoriesCalendarFile({
			uid: 'ana-y-luis',
			title: 'Compartir recuerdos · Ana, Luis',
			startsAt: '2026-11-14T18:00:00.000Z',
			endsAt: '2026-11-16T06:00:00.000Z',
			url: 'https://example.invalid/r/ana-y-luis',
			now: new Date('2026-10-05T00:00:00.000Z'),
		});
		expect(file).toContain('DTSTART:20261114T180000Z');
		expect(file).toContain('DTEND:20261116T060000Z');
		expect(file).toContain('SUMMARY:Compartir recuerdos · Ana\\, Luis');
		expect(file.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
	});
});
