/**
 * Scroll-driven state for the shared fixed header (HeaderBase).
 *
 * The header hides while the reader scrolls down and returns when they scroll up.
 * A raw "current > last" comparison flips on every 1-2px jitter (momentum tail,
 * iOS rubber-band, URL-bar resize), which makes the bar flicker in and out.
 * This module adds hysteresis: the header only changes after a sustained travel
 * in one direction, scroll positions are clamped to the real scroll range, and
 * tiny deltas are ignored. While the visual viewport is resizing (URL bar) and
 * briefly after, positions are only resynced, and touch screens need longer travel.
 */

export interface HeaderScrollThresholds {
	/** Past this scrollY the header leaves its transparent "on hero" look. */
	shrinkAt: number;
	/** At or above this scrollY the header is always visible. */
	hideAt: number;
	/** Continuous downward travel (px) needed to hide. */
	hideDistance: number;
	/** Continuous upward travel (px) needed to show again. */
	showDistance: number;
	/** Deltas smaller than this (px) are treated as jitter. */
	minDelta: number;
}

export interface HeaderScrollState {
	/** Last accepted (clamped) scroll position. */
	y: number;
	/** Signed travel in the current direction; positive is down. */
	travel: number;
	hidden: boolean;
	scrolled: boolean;
}

export const DEFAULT_HEADER_SCROLL_THRESHOLDS: HeaderScrollThresholds = {
	shrinkAt: 50,
	hideAt: 100,
	hideDistance: 24,
	showDistance: 48,
	minDelta: 4,
};

/** A finger flick and the phone URL bar (about 50-90px) both exceed the mouse-wheel distances. */
export const COARSE_POINTER_TRAVEL: Pick<HeaderScrollThresholds, 'hideDistance' | 'showDistance'> =
	{
		hideDistance: 64,
		showDistance: 120,
	};

/** The URL bar animates for about 200-300ms and the content settles after the last resize. */
export const VIEWPORT_RESIZE_SETTLE_MS = 300;

/** True while a viewport resize is in progress or settled less than `settleMs` ago. */
export function isViewportSettling(
	now: number,
	lastResizeAt: number,
	settleMs: number = VIEWPORT_RESIZE_SETTLE_MS,
): boolean {
	return now - lastResizeAt < settleMs;
}

export function clampScrollY(rawY: number, maxY: number): number {
	return Math.min(Math.max(rawY, 0), Math.max(maxY, 0));
}

export function createHeaderScrollState(
	rawY: number,
	maxY: number,
	thresholds: HeaderScrollThresholds = DEFAULT_HEADER_SCROLL_THRESHOLDS,
): HeaderScrollState {
	const y = clampScrollY(rawY, maxY);
	return { y, travel: 0, hidden: false, scrolled: y > thresholds.shrinkAt };
}

/** Accept the current position without changing visibility (viewport resize, anchor jumps). */
export function resyncHeaderScrollState(
	prev: HeaderScrollState,
	rawY: number,
	maxY: number,
	thresholds: HeaderScrollThresholds = DEFAULT_HEADER_SCROLL_THRESHOLDS,
): HeaderScrollState {
	const y = clampScrollY(rawY, maxY);
	return {
		y,
		travel: 0,
		hidden: y > thresholds.hideAt ? prev.hidden : false,
		scrolled: y > thresholds.shrinkAt,
	};
}

export function nextHeaderScrollState(
	prev: HeaderScrollState,
	rawY: number,
	maxY: number,
	thresholds: HeaderScrollThresholds = DEFAULT_HEADER_SCROLL_THRESHOLDS,
): HeaderScrollState {
	const y = clampScrollY(rawY, maxY);
	const scrolled = y > thresholds.shrinkAt;

	if (y <= thresholds.hideAt) {
		return { y, travel: 0, hidden: false, scrolled };
	}

	const delta = y - prev.y;
	if (Math.abs(delta) < thresholds.minDelta) {
		// Keep the anchor so slow, real movement still accumulates.
		return prev.scrolled === scrolled ? prev : { ...prev, scrolled };
	}

	const travel = Math.sign(delta) === Math.sign(prev.travel) ? prev.travel + delta : delta;
	let hidden = prev.hidden;
	if (travel >= thresholds.hideDistance) hidden = true;
	else if (travel <= -thresholds.showDistance) hidden = false;

	return { y, travel, hidden, scrolled };
}

function readThreshold(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

export function readHeaderScrollThresholds(
	header: HTMLElement,
	coarsePointer = false,
): HeaderScrollThresholds {
	const defaults = coarsePointer
		? { ...DEFAULT_HEADER_SCROLL_THRESHOLDS, ...COARSE_POINTER_TRAVEL }
		: DEFAULT_HEADER_SCROLL_THRESHOLDS;
	const direction = readThreshold(header.dataset.thresholdDirection, Number.NaN);
	return {
		shrinkAt: readThreshold(header.dataset.thresholdShrink, defaults.shrinkAt),
		hideAt: readThreshold(header.dataset.thresholdHide, defaults.hideAt),
		hideDistance: Number.isFinite(direction) ? direction : defaults.hideDistance,
		showDistance: Number.isFinite(direction) ? direction * 2 : defaults.showDistance,
		minDelta: defaults.minDelta,
	};
}

const ANCHOR_SCROLL_GUARD_MS = 1200;

/**
 * Wires one header to window scroll. Work runs at most once per frame and the
 * classes are only written when they change. --nav-current-height on :root is
 * the header's fixed height, written once: hiding is a transform, and rewriting
 * a root variable on every show/hide restyles the whole page mid-scroll.
 */
export function bindHeaderScroll(header: HTMLElement): () => void {
	const root = document.documentElement;
	const thresholds = readHeaderScrollThresholds(
		header,
		window.matchMedia?.('(pointer: coarse)').matches ?? false,
	);
	const isTransparentConfigured = header.dataset.transparent === 'true';
	const visibleHeight =
		getComputedStyle(header).getPropertyValue('--header-height').trim() || '70px';
	const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight;
	const maxScrollY = () => root.scrollHeight - viewportHeight();

	let state = createHeaderScrollState(window.scrollY, maxScrollY(), thresholds);
	let frame = 0;
	let resyncNext = false;
	let anchorGuardUntil = 0;
	let lastViewportHeight = viewportHeight();
	let lastViewportResizeAt = Number.NEGATIVE_INFINITY;

	const apply = () => {
		const isMenuOpen = header.classList.contains('header-base--menu-open');
		if (isMenuOpen && state.hidden) state = { ...state, hidden: false, travel: 0 };

		const hidden = state.hidden && !isMenuOpen;
		const scrolled = state.scrolled || !isTransparentConfigured;
		const transparent = isTransparentConfigured && !isMenuOpen && !state.scrolled;

		if (header.classList.contains('header-base--scrolled') !== scrolled) {
			header.classList.toggle('header-base--scrolled', scrolled);
		}
		if (header.classList.contains('header-base--transparent') !== transparent) {
			header.classList.toggle('header-base--transparent', transparent);
		}
		if (header.classList.contains('header-base--hidden') !== hidden) {
			header.classList.toggle('header-base--hidden', hidden);
		}
	};

	const update = () => {
		frame = 0;
		const now = performance.now();
		const height = viewportHeight();
		if (height !== lastViewportHeight) lastViewportResizeAt = now;
		lastViewportHeight = height;

		const guarded =
			resyncNext || isViewportSettling(now, lastViewportResizeAt) || now < anchorGuardUntil;
		resyncNext = false;
		state = guarded
			? resyncHeaderScrollState(state, window.scrollY, maxScrollY(), thresholds)
			: nextHeaderScrollState(state, window.scrollY, maxScrollY(), thresholds);
		apply();
	};

	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(update);
	};

	const onViewportResize = () => {
		lastViewportResizeAt = performance.now();
		schedule();
	};

	const onClick = (event: MouseEvent) => {
		const link = event.target instanceof Element ? event.target.closest('a[href*="#"]') : null;
		if (!(link instanceof HTMLAnchorElement)) return;
		if (link.pathname !== window.location.pathname || !link.hash) return;
		anchorGuardUntil = performance.now() + ANCHOR_SCROLL_GUARD_MS;
	};

	const onScrollEnd = () => {
		if (!anchorGuardUntil) return;
		anchorGuardUntil = 0;
		resyncNext = true;
		schedule();
	};

	if (root.style.getPropertyValue('--nav-current-height') !== visibleHeight) {
		root.style.setProperty('--nav-current-height', visibleHeight);
	}
	apply();
	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('scrollend', onScrollEnd);
	window.visualViewport?.addEventListener('resize', onViewportResize);
	document.addEventListener('click', onClick, { capture: true });

	return () => {
		if (frame) cancelAnimationFrame(frame);
		window.removeEventListener('scroll', schedule);
		window.removeEventListener('scrollend', onScrollEnd);
		window.visualViewport?.removeEventListener('resize', onViewportResize);
		document.removeEventListener('click', onClick, { capture: true });
	};
}
