/*
  Footer held at the end of an invitation (`--invitation-footer-reveal: held` on the footer).
  The page stops at its last section. Once the guest has rested at the bottom, a small lantern
  peeks from the bottom edge; pulling on (a swipe up, or more wheel down) lifts it on its thread,
  and past a short pull the footer opens and glides into view. Let go before that and the
  lantern settles back. ArrowDown, PageDown, End or Space open it at once, tabbing into its links
  opens it too, and a page too short to scroll shows it at once. With reduced motion there is no
  lantern: the next gesture opens the footer without movement. Without this script the footer is
  simply shown.

  The opening is not a one-time event. Once the guest scrolls back up and leaves the open footer
  well behind (half a screen below the fold, so nothing on screen moves when it folds away), the
  footer is held again; the next rest at the bottom brings the lantern back and the whole opening
  plays again. It stays open while focus is inside it, so a keyboard reader is never clipped away.
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
// The open footer is held again once it sits this far below the viewport (an IntersectionObserver
// root margin, relative to the viewport height): folding it away then moves nothing on screen,
// and a wiggle at the edge never flickers it.
export const REARM_ROOT_MARGIN = '0px 0px 50% 0px';
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

	let cue: HTMLElement | null = null;
	let restingSince: number | null = null;
	let touchStartY: number | null = null;
	let wheelPulled = 0;
	let wheelIdle = 0;
	let peekTimer = 0;
	let opened = false;
	let leaveWatch: IntersectionObserver | null = null;
	// The cue let go on the last opening, until its exit has run or a new arming clears it.
	let leaving: HTMLElement | null = null;
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
			releasePull();
		} else if (restingSince === null) {
			restingSince = performance.now();
			schedulePeek();
			armPull();
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

	// Wheel and touch moves may cancel scrolling only while the reader rests at the bottom; the
	// rest of the reading keeps passive listeners, so the browser never waits on them to scroll.
	let pullArmed = false;
	function armPull() {
		if (pullArmed || opened) return;
		pullArmed = true;
		window.addEventListener('wheel', onWheel, { passive: false });
		window.addEventListener('touchmove', onTouchMove, { passive: false });
	}
	function releasePull() {
		if (!pullArmed) return;
		pullArmed = false;
		window.removeEventListener('wheel', onWheel);
		window.removeEventListener('touchmove', onTouchMove);
	}

	// Hold the footer and wait for the gesture; the lantern returns with it on every arming.
	function arm() {
		if (!(footer instanceof HTMLElement)) return;
		opened = false;
		wheelPulled = 0;
		touchStartY = null;
		leaving?.remove();
		leaving = null;
		cue = reduced ? null : createPullCue(footer);
		restingSince = atBottom() ? performance.now() : null;
		if (restingSince !== null) {
			schedulePeek();
			armPull();
		}
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('touchstart', onTouchStart, { passive: true });
		window.addEventListener('touchend', onTouchEnd, { passive: true });
		window.addEventListener('touchcancel', onTouchEnd, { passive: true });
		window.addEventListener('keydown', onKeyDown);
		footer.addEventListener('focusin', open);
	}

	function disarm() {
		if (!(footer instanceof HTMLElement)) return;
		window.removeEventListener('scroll', onScroll);
		releasePull();
		window.removeEventListener('touchstart', onTouchStart);
		window.removeEventListener('touchend', onTouchEnd);
		window.removeEventListener('touchcancel', onTouchEnd);
		window.removeEventListener('keydown', onKeyDown);
		footer.removeEventListener('focusin', open);
		window.clearTimeout(wheelIdle);
		window.clearTimeout(peekTimer);
	}

	function open() {
		if (!(footer instanceof HTMLElement) || opened) return;
		opened = true;
		disarm();
		footer.dataset.footerReveal = 'open';
		const away = cue;
		cue = null;
		leaving = away;
		if (away) {
			// The lantern lets go of its thread and rises out of view as the footer arrives.
			away.dataset.state = 'away';
			away.addEventListener('animationend', () => away.remove(), { once: true });
			window.setTimeout(() => away.remove(), Math.max(CUE_REMOVE_FALLBACK_MS, glideMs + 400));
		}
		requestAnimationFrame(() => {
			if (reduced) {
				window.scrollTo({ top: root.scrollHeight, behavior: 'auto' });
				watchForLeave();
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
					watchForLeave();
				};
				glideToBottom(root, glideMs, finishGlide);
			}
		});
	}

	// Once the open footer has settled, wait for the guest to leave it well behind, then hold it
	// again so the next visit to the end plays the opening once more. The observer reports the
	// current state on attach, so a footer still in view simply keeps waiting.
	function watchForLeave() {
		if (!(footer instanceof HTMLElement) || typeof IntersectionObserver === 'undefined') return;
		leaveWatch?.disconnect();
		let inView = true;
		const holdAgain = () => {
			if (inView || !leaveWatch) return;
			// A reader tabbing through the footer keeps it; folding it away would clip their focus.
			if (footer.contains(document.activeElement)) return;
			leaveWatch.disconnect();
			leaveWatch = null;
			footer.removeEventListener('focusout', onFocusOut);
			footer.dataset.footerReveal = 'held';
			arm();
		};
		// Focus leaving a footer already out of view re-arms it; the observer will not report
		// again until the footer moves. The check waits a task so `activeElement` has settled
		// (a window blur keeps focus inside the footer).
		const onFocusOut = () => window.setTimeout(holdAgain, 0);
		leaveWatch = new IntersectionObserver(
			(entries) => {
				inView = entries.some((entry) => entry.isIntersecting);
				holdAgain();
			},
			{ rootMargin: REARM_ROOT_MARGIN },
		);
		leaveWatch.observe(footer);
		footer.addEventListener('focusout', onFocusOut);
	}

	arm();
}
