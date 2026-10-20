/*
  Footer held at the end of an invitation (`--invitation-footer-reveal: held` on the footer).
  The page stops at its last section; once the guest has rested at the bottom, the next gesture
  that asks for more (a wheel or swipe down, or ArrowDown, PageDown, End or Space) opens the
  footer and brings it into view. Tabbing into its links opens it too, and a page too short to
  scroll shows it at once. Without this script the footer is simply shown.
*/

// A gesture only counts once the guest has been at the bottom this long, so the momentum of
// the scroll that reached the end does not open the footer by itself.
const REST_MS = 350;
const SWIPE_PX = 24;
const BOTTOM_SLACK_PX = 4;
const REVEAL_KEYS = new Set(['ArrowDown', 'PageDown', 'End', ' ']);

export function shouldHoldFooter(value: string): boolean {
	return value.trim() === 'held';
}

export function isAtBottom(scrollY: number, viewportHeight: number, scrollHeight: number): boolean {
	return scrollY + viewportHeight >= scrollHeight - BOTTOM_SLACK_PX;
}

export function holdFooterUntilSecondScroll(footer: Element | null): void {
	if (!(footer instanceof HTMLElement)) return;
	const token = getComputedStyle(footer).getPropertyValue('--invitation-footer-reveal');
	if (!shouldHoldFooter(token)) return;

	const root = document.documentElement;
	const atBottom = () => isAtBottom(window.scrollY, window.innerHeight, root.scrollHeight);
	footer.dataset.footerReveal = 'held';
	if (root.scrollHeight <= window.innerHeight + BOTTOM_SLACK_PX) {
		footer.dataset.footerReveal = 'open';
		return;
	}

	let restingSince: number | null = atBottom() ? performance.now() : null;
	let touchStartY: number | null = null;
	const rested = () => restingSince !== null && performance.now() - restingSince >= REST_MS;

	const onScroll = () => {
		if (!atBottom()) restingSince = null;
		else restingSince ??= performance.now();
	};
	const onWheel = (event: WheelEvent) => {
		if (event.deltaY > 0 && rested()) open();
	};
	const onTouchStart = (event: TouchEvent) => {
		touchStartY = event.touches[0]?.clientY ?? null;
	};
	const onTouchMove = (event: TouchEvent) => {
		const y = event.touches[0]?.clientY;
		if (touchStartY !== null && y !== undefined && touchStartY - y > SWIPE_PX && rested())
			open();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (!REVEAL_KEYS.has(event.key) || !rested()) return;
		const target = event.target as HTMLElement | null;
		if (
			event.key === ' ' &&
			target?.closest('input, textarea, select, button, a, [contenteditable]')
		)
			return;
		open();
	};

	function open() {
		if (!(footer instanceof HTMLElement)) return;
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('wheel', onWheel);
		window.removeEventListener('touchstart', onTouchStart);
		window.removeEventListener('touchmove', onTouchMove);
		window.removeEventListener('keydown', onKeyDown);
		footer.removeEventListener('focusin', open);
		footer.dataset.footerReveal = 'open';
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		requestAnimationFrame(() =>
			window.scrollTo({ top: root.scrollHeight, behavior: reduced ? 'auto' : 'smooth' }),
		);
	}

	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('wheel', onWheel, { passive: true });
	window.addEventListener('touchstart', onTouchStart, { passive: true });
	window.addEventListener('touchmove', onTouchMove, { passive: true });
	window.addEventListener('keydown', onKeyDown);
	footer.addEventListener('focusin', open);
}
