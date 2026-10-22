/*
  Footer held at the end of an invitation (`--invitation-footer-reveal: held` on the footer).
  The page stops at its last section. Once the guest has rested at the bottom, a small lantern
  peeks from the bottom edge; pulling on (a swipe up, or more wheel down) lifts it on its thread,
  and past a short pull the footer opens and glides into view. Let go before that and the
  lantern settles back. ArrowDown, PageDown, End or Space open it at once, tabbing into its links
  opens it too, and a page too short to scroll shows it at once. With reduced motion there is no
  lantern: the next gesture opens the footer without movement. Without this script the footer is
  simply shown.
*/

// A gesture only counts once the guest has been at the bottom this long, so the momentum of
// the scroll that reached the end does not open the footer by itself.
const REST_MS = 350;
const BOTTOM_SLACK_PX = 4;
// How far a finger, or how much wheel, it takes to open; a mouse wheel does it in two notches.
const TOUCH_PULL_PX = 72;
const WHEEL_PULL = 200;
// A wheel pull that pauses this long counts as let go.
const WHEEL_IDLE_MS = 180;
// The lantern's resting peek, as a share of a full pull.
const PEEK = 0.18;
// Without the lantern a third of a pull opens, so a tap's jitter does not.
const REDUCED_OPEN = 0.34;
const OPEN_GLIDE_MS = 320;
// The cue is removed by this time even if its exit animation never reports its end.
const CUE_REMOVE_FALLBACK_MS = 1000;
const REVEAL_KEYS = new Set(['ArrowDown', 'PageDown', 'End', ' ']);

export function shouldHoldFooter(value: string): boolean {
	return value.trim() === 'held';
}

export function isAtBottom(scrollY: number, viewportHeight: number, scrollHeight: number): boolean {
	return scrollY + viewportHeight >= scrollHeight - BOTTOM_SLACK_PX;
}

/** Share of a full pull (0–1) for a pulled distance against the distance that opens. */
export function pullProgress(distance: number, threshold: number): number {
	if (!(distance > 0) || !(threshold > 0)) return 0;
	return Math.min(1, distance / threshold);
}

/** Wheel delta in pixels, whatever unit the device reports. */
/** Glide length in ms from `--footer-open-glide` (e.g. `720ms`); the default when unset or invalid. */
export function openGlideMs(value: string): number {
	const ms = Number.parseFloat(value);
	return Number.isFinite(ms) && ms > 0 ? ms : OPEN_GLIDE_MS;
}

export function wheelPixels(event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
	if (event.deltaMode === 1) return event.deltaY * 16;
	if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
	return event.deltaY;
}

function createPullCue(footer: HTMLElement): HTMLElement {
	const cue = document.createElement('div');
	cue.className = 'footer-pull';
	cue.setAttribute('aria-hidden', 'true');
	// A pool of light at the edge and an optional label (its words come from the profile).
	for (const part of ['light', 'label']) {
		const span = document.createElement('span');
		span.className = `footer-pull__${part}`;
		cue.append(span);
	}
	footer.before(cue);
	return cue;
}

function glideToBottom(root: HTMLElement, duration: number, onComplete?: () => void): void {
	const start = window.scrollY;
	const startedAt = performance.now();
	const step = (now: number) => {
		const t = Math.min(1, (now - startedAt) / duration);
		// Zero velocity and acceleration at both ends keeps the handoff from the pull continuous.
		const eased = t * t * t * (t * (t * 6 - 15) + 10);
		const end = root.scrollHeight - window.innerHeight;
		// This loop owns interpolation; native CSS smooth scrolling must not restart each frame.
		window.scrollTo({ top: start + (end - start) * eased, behavior: 'instant' });
		if (t < 1) {
			requestAnimationFrame(step);
		} else {
			onComplete?.();
		}
	};
	requestAnimationFrame(step);
}

export function holdFooterUntilSecondScroll(footer: Element | null): void {
	if (!(footer instanceof HTMLElement)) return;
	const token = getComputedStyle(footer).getPropertyValue('--invitation-footer-reveal');
	if (!shouldHoldFooter(token)) return;

	const root = document.documentElement;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const glideMs = openGlideMs(getComputedStyle(footer).getPropertyValue('--footer-open-glide'));
	const atBottom = () => isAtBottom(window.scrollY, window.innerHeight, root.scrollHeight);
	footer.dataset.footerReveal = 'held';
	if (root.scrollHeight <= window.innerHeight + BOTTOM_SLACK_PX) {
		footer.dataset.footerReveal = 'open';
		return;
	}

	const cue = reduced ? null : createPullCue(footer);
	let restingSince: number | null = atBottom() ? performance.now() : null;
	let touchStartY: number | null = null;
	let wheelPulled = 0;
	let wheelIdle = 0;
	let peekTimer = 0;
	let opened = false;
	const rested = () => restingSince !== null && performance.now() - restingSince >= REST_MS;

	const show = (progress: number, state: 'idle' | 'pulling' | 'settling') => {
		if (!cue || opened) return;
		cue.dataset.state = state;
		cue.style.setProperty('--footer-pull', progress.toFixed(3));
		// Only a lantern waiting in view breathes; one settled out of sight stays still.
		cue.toggleAttribute('data-resting', state === 'settling' && progress > 0);
	};
	// Pulled far enough opens; anything less follows the pull and settles back on release.
	const pull = (progress: number) => {
		if (progress >= 1 || (!cue && progress >= REDUCED_OPEN)) open();
		else show(Math.max(PEEK, progress), 'pulling');
	};
	const settle = () => show(rested() ? PEEK : 0, 'settling');
	const schedulePeek = () => {
		window.clearTimeout(peekTimer);
		peekTimer = window.setTimeout(() => {
			if (atBottom()) show(PEEK, 'settling');
		}, REST_MS);
	};

	const onScroll = () => {
		if (!atBottom()) {
			restingSince = null;
			window.clearTimeout(peekTimer);
			show(0, 'settling');
		} else if (restingSince === null) {
			restingSince = performance.now();
			schedulePeek();
		}
	};
	const onWheel = (event: WheelEvent) => {
		if (event.deltaY <= 0 || !rested()) return;
		// The pull is consumed here, otherwise the browser also scrolls the newly opened space.
		event.preventDefault();
		wheelPulled += wheelPixels(event);
		pull(pullProgress(wheelPulled, WHEEL_PULL));
		if (opened) return;
		window.clearTimeout(wheelIdle);
		wheelIdle = window.setTimeout(() => {
			wheelPulled = 0;
			settle();
		}, WHEEL_IDLE_MS);
	};
	const onTouchStart = (event: TouchEvent) => {
		touchStartY = rested() ? (event.touches[0]?.clientY ?? null) : null;
	};
	const onTouchMove = (event: TouchEvent) => {
		const y = event.touches[0]?.clientY;
		if (touchStartY === null || y === undefined) return;
		if (touchStartY > y) event.preventDefault();
		pull(pullProgress(touchStartY - y, TOUCH_PULL_PX));
		// A short tick where the phone supports it, as the lantern lets go.
		if (opened && cue) navigator.vibrate?.(12);
	};
	const onTouchEnd = () => {
		if (touchStartY === null) return;
		touchStartY = null;
		settle();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (!REVEAL_KEYS.has(event.key) || !rested()) return;
		const target = event.target as HTMLElement | null;
		if (
			event.key === ' ' &&
			target?.closest('input, textarea, select, button, a, [contenteditable]')
		)
			return;
		event.preventDefault();
		open();
	};

	function open() {
		if (!(footer instanceof HTMLElement) || opened) return;
		opened = true;
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('wheel', onWheel);
		window.removeEventListener('touchstart', onTouchStart);
		window.removeEventListener('touchmove', onTouchMove);
		window.removeEventListener('touchend', onTouchEnd);
		window.removeEventListener('touchcancel', onTouchEnd);
		window.removeEventListener('keydown', onKeyDown);
		footer.removeEventListener('focusin', open);
		window.clearTimeout(wheelIdle);
		window.clearTimeout(peekTimer);
		footer.dataset.footerReveal = 'open';
		if (cue) {
			// The lantern lets go of its thread and rises out of view as the footer arrives.
			cue.dataset.state = 'away';
			cue.addEventListener('animationend', () => cue.remove(), { once: true });
			window.setTimeout(() => cue.remove(), Math.max(CUE_REMOVE_FALLBACK_MS, glideMs + 400));
		}
		requestAnimationFrame(() => {
			if (reduced) {
				window.scrollTo({ top: root.scrollHeight, behavior: 'auto' });
			} else {
				// While gliding, absorb wheel and touch drags so native inertial scroll does not fight the glide.
				const absorbInput = (event: Event) => {
					if (event.cancelable) event.preventDefault();
				};
				window.addEventListener('wheel', absorbInput, { passive: false });
				window.addEventListener('touchmove', absorbInput, { passive: false });
				const finishGlide = () => {
					window.removeEventListener('wheel', absorbInput);
					window.removeEventListener('touchmove', absorbInput);
				};
				glideToBottom(root, glideMs, finishGlide);
			}
		});
	}

	if (restingSince !== null) schedulePeek();
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('wheel', onWheel, { passive: false });
	window.addEventListener('touchstart', onTouchStart, { passive: true });
	window.addEventListener('touchmove', onTouchMove, { passive: false });
	window.addEventListener('touchend', onTouchEnd, { passive: true });
	window.addEventListener('touchcancel', onTouchEnd, { passive: true });
	window.addEventListener('keydown', onKeyDown);
	footer.addEventListener('focusin', open);
}
