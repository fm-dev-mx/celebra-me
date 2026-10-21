import fs from 'node:fs';
import path from 'node:path';
import {
	MUSIC_BUFFER_FALLBACK_MS,
	MUSIC_BUFFER_IDLE_TIMEOUT_MS,
	scheduleMusicBufferAfterPaint,
	shouldBufferMusicAfterPaint,
} from '@/lib/invitation/music-preload';

const envelopeMusic = {
	hasAudio: true,
	autoPlay: true,
	revealMode: 'envelope' as const,
	isVisualCapture: false,
};

const createAudio = () => {
	const audio = document.createElement('audio');
	audio.preload = 'none';
	audio.dataset.bufferAfterPaint = 'true';
	return audio;
};

describe('music preload', () => {
	it('ships the <audio> with preload="none" so the song never loads with the page', () => {
		const source = fs.readFileSync(
			path.resolve(__dirname, '../../src/components/invitation/MusicPlayer.astro'),
			'utf8',
		);
		expect(source).toMatch(/<audio[^>]*\spreload="none"/);
		expect(source).not.toMatch(/preload=\{/);
	});

	it('buffers after paint only music that starts with the envelope tap', () => {
		expect(shouldBufferMusicAfterPaint(envelopeMusic)).toBe(true);
		expect(shouldBufferMusicAfterPaint({ ...envelopeMusic, autoPlay: false })).toBe(false);
		expect(shouldBufferMusicAfterPaint({ ...envelopeMusic, hasAudio: false })).toBe(false);
		expect(shouldBufferMusicAfterPaint({ ...envelopeMusic, revealMode: 'immediate' })).toBe(
			false,
		);
		expect(shouldBufferMusicAfterPaint({ ...envelopeMusic, isVisualCapture: true })).toBe(
			false,
		);
	});

	describe('scheduleMusicBufferAfterPaint', () => {
		let readyState: DocumentReadyState;

		beforeEach(() => {
			jest.useFakeTimers();
			readyState = 'loading';
			jest.spyOn(document, 'readyState', 'get').mockImplementation(() => readyState);
		});

		afterEach(() => {
			jest.useRealTimers();
			jest.restoreAllMocks();
			delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
		});

		it('keeps preload="none" until load, then switches to "auto" on idle', () => {
			const idle = jest.fn();
			Object.assign(window, { requestIdleCallback: idle });
			const audio = createAudio();

			scheduleMusicBufferAfterPaint(audio);
			expect(audio.preload).toBe('none');
			expect(idle).not.toHaveBeenCalled();

			window.dispatchEvent(new Event('load'));
			expect(idle).toHaveBeenCalledWith(expect.any(Function), {
				timeout: MUSIC_BUFFER_IDLE_TIMEOUT_MS,
			});
			expect(audio.preload).toBe('none');

			idle.mock.calls[0][0]();
			expect(audio.preload).toBe('auto');
		});

		it('falls back to a timer without requestIdleCallback and when the page already loaded', () => {
			readyState = 'complete';
			const audio = createAudio();

			scheduleMusicBufferAfterPaint(audio);
			jest.advanceTimersByTime(MUSIC_BUFFER_FALLBACK_MS - 1);
			expect(audio.preload).toBe('none');

			jest.advanceTimersByTime(1);
			expect(audio.preload).toBe('auto');
		});

		it('leaves audio without the after-paint marker on demand', () => {
			const audio = createAudio();
			delete audio.dataset.bufferAfterPaint;

			scheduleMusicBufferAfterPaint(audio)();
			jest.runAllTimers();
			expect(audio.preload).toBe('none');
		});

		it('buffers right away when the guest taps before the page settles', () => {
			const audio = createAudio();

			const bufferNow = scheduleMusicBufferAfterPaint(audio);
			bufferNow();
			expect(audio.preload).toBe('auto');
		});
	});
});
