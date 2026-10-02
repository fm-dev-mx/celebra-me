import {
	measureVideoDurationSeconds,
	validateMemoriesFile,
	validateMemoriesVideoDuration,
} from '@/lib/memories/client/media-prep';
import { MEMORIES_VIDEO_METADATA_TIMEOUT_MS } from '@/lib/memories/contract/limits';
import {
	MEMORIES_MAX_IMAGE_BYTES,
	MEMORIES_MAX_VIDEO_BYTES,
	MEMORIES_MAX_VIDEO_DURATION_SECONDS,
} from '@/lib/memories/contract/media-policy';

/** A file that reports `size` without allocating it. */
function fileOfSize(name: string, type: string, size: number): File {
	const file = new File([new Uint8Array(1)], name, { type });
	Object.defineProperty(file, 'size', { value: size });
	return file;
}

describe('validateMemoriesFile', () => {
	it.each([
		['a photo exactly at the limit', 'foto.jpg', 'image/jpeg', MEMORIES_MAX_IMAGE_BYTES, null],
		[
			'a photo one byte above the limit',
			'foto.jpg',
			'image/jpeg',
			MEMORIES_MAX_IMAGE_BYTES + 1,
			'file_too_large',
		],
		['an iPhone HEIC photo declared without a type', 'IMG_0001.HEIC', '', 3_000_000, null],
		['a video exactly at the limit', 'baile.mp4', 'video/mp4', MEMORIES_MAX_VIDEO_BYTES, null],
		[
			'a video one byte above the limit',
			'baile.mp4',
			'video/mp4',
			MEMORIES_MAX_VIDEO_BYTES + 1,
			'video_too_large',
		],
		[
			'an iPhone .mov declared without a type',
			'IMG_0002.MOV',
			'',
			MEMORIES_MAX_VIDEO_BYTES + 1,
			'video_too_large',
		],
		['an empty file', 'vacio.png', 'image/png', 0, 'file_too_large'],
		['an animated GIF', 'baile.gif', 'image/gif', 1_000, 'unsupported_type'],
	] as const)('judges %s', (_label, name, type, size, expected) => {
		expect(validateMemoriesFile(fileOfSize(name, type, size))).toBe(expected);
	});
});

describe('validateMemoriesVideoDuration', () => {
	const video = fileOfSize('baile.mp4', 'video/mp4', 5_000_000);

	it.each([
		['exactly the limit', MEMORIES_MAX_VIDEO_DURATION_SECONDS, null],
		['a hair above the limit', MEMORIES_MAX_VIDEO_DURATION_SECONDS + 0.03, 'video_too_long'],
		['a fractional duration', 12.345678, null],
		['an unknown duration', Number.NaN, 'video_unreadable'],
		['a streaming container without a duration', Number.POSITIVE_INFINITY, 'video_unreadable'],
		['a zero duration', 0, 'video_unreadable'],
	] as const)('judges %s', async (_label, seconds, expected) => {
		await expect(validateMemoriesVideoDuration(video, async () => seconds)).resolves.toBe(
			expected,
		);
	});

	it('reports a video the browser cannot read instead of failing the upload flow', async () => {
		await expect(
			validateMemoriesVideoDuration(video, async () => {
				throw new Error('video_metadata');
			}),
		).resolves.toBe('video_unreadable');
	});

	it('skips the probe for photos', async () => {
		const probe = jest.fn(async () => 5);
		await expect(
			validateMemoriesVideoDuration(fileOfSize('foto.jpg', 'image/jpeg', 10), probe),
		).resolves.toBeNull();
		expect(probe).not.toHaveBeenCalled();
	});
});

describe('measureVideoDurationSeconds', () => {
	const createObjectURL = jest.fn(() => 'blob:video');
	const revokeObjectURL = jest.fn();
	const originalCreate = URL.createObjectURL;
	const originalRevoke = URL.revokeObjectURL;

	beforeEach(() => {
		jest.useFakeTimers();
		createObjectURL.mockClear();
		revokeObjectURL.mockClear();
		URL.createObjectURL = createObjectURL;
		URL.revokeObjectURL = revokeObjectURL;
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
		URL.createObjectURL = originalCreate;
		URL.revokeObjectURL = originalRevoke;
	});

	function captureVideoElement(): { element: () => HTMLVideoElement } {
		let created: HTMLVideoElement | null = null;
		const createElement = document.createElement.bind(document);
		jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
			const element = createElement(tagName);
			if (tagName === 'video') created = element as HTMLVideoElement;
			return element;
		});
		return {
			element: () => {
				if (!created) throw new Error('No video element was created.');
				return created;
			},
		};
	}

	it('resolves with the duration the browser read from the metadata', async () => {
		const probe = captureVideoElement();
		const pending = measureVideoDurationSeconds(fileOfSize('baile.mp4', 'video/mp4', 10));
		const element = probe.element();
		Object.defineProperty(element, 'duration', { value: 42.5 });
		element.onloadedmetadata?.(new Event('loadedmetadata'));

		await expect(pending).resolves.toBe(42.5);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:video');
		expect(jest.getTimerCount()).toBe(0);
	});

	it('gives up when the browser fires neither metadata nor an error', async () => {
		captureVideoElement();
		const pending = measureVideoDurationSeconds(fileOfSize('baile.mov', 'video/quicktime', 10));
		const outcome = expect(pending).rejects.toThrow('video_metadata_timeout');

		jest.advanceTimersByTime(MEMORIES_VIDEO_METADATA_TIMEOUT_MS);

		await outcome;
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:video');
	});
});
