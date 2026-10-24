/**
 * Background music never downloads while the page loads: the `<audio>` ships `preload="none"` so
 * the song (1–2 MB) does not compete with the stylesheets, fonts and hero photo. Music that starts
 * with the envelope tap is buffered once the page has painted (window `load`, then an idle
 * callback), or right away when the guest taps first. Inside a frame (the landing showroom, the
 * dashboard preview) the song waits for the tap: a framed preview rarely plays it.
 */

export type MusicPreload = 'none' | 'auto';

interface MusicPreloadInput {
	hasAudio: boolean;
	autoPlay: boolean;
	revealMode: 'envelope' | 'immediate';
	isVisualCapture: boolean;
}

/** Buffering after paint only pays off for music that starts with the envelope tap. */
export const shouldBufferMusicAfterPaint = ({
	hasAudio,
	autoPlay,
	revealMode,
	isVisualCapture,
}: MusicPreloadInput): boolean =>
	!isVisualCapture && hasAudio && autoPlay && revealMode === 'envelope';

/** Fallback delay after `load` where `requestIdleCallback` is missing (Safari). */
export const MUSIC_BUFFER_FALLBACK_MS = 1500;
/** Upper bound for the idle callback so a busy main thread still buffers the song. */
export const MUSIC_BUFFER_IDLE_TIMEOUT_MS = 3000;

type IdleWindow = Window & {
	requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

/**
 * Raises `preload` to "auto" after the page has painted, for an `<audio>` marked
 * `data-buffer-after-paint`. Returns `bufferNow`, which the envelope tap calls so the song starts
 * loading even if the idle callback has not fired yet (a no-op for any other element).
 */
export const scheduleMusicBufferAfterPaint = (
	audio: Element | null,
	win: IdleWindow = window,
): (() => void) => {
	if (!(audio instanceof HTMLAudioElement) || audio.dataset.bufferAfterPaint !== 'true') {
		return () => undefined;
	}
	let buffered = false;
	const bufferNow = () => {
		if (buffered) return;
		buffered = true;
		audio.preload = 'auto';
	};

	const scheduleIdle = () => {
		if (typeof win.requestIdleCallback === 'function') {
			win.requestIdleCallback(bufferNow, { timeout: MUSIC_BUFFER_IDLE_TIMEOUT_MS });
		} else {
			win.setTimeout(bufferNow, MUSIC_BUFFER_FALLBACK_MS);
		}
	};

	if (win.self !== win.top) return bufferNow;

	if (win.document.readyState === 'complete') {
		scheduleIdle();
	} else {
		win.addEventListener('load', scheduleIdle, { once: true });
	}

	return bufferNow;
};
