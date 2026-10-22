import {
	REARM_ROOT_MARGIN,
	holdFooterUntilSecondScroll,
	isAtBottom,
	openGlideMs,
	pullProgress,
	shouldHoldFooter,
	wheelPixels,
} from '@/lib/invitation/footer-reveal';

type LeaveCallback = (entries: Array<Pick<IntersectionObserverEntry, 'isIntersecting'>>) => void;

/** Stands in for IntersectionObserver so a test can report the footer leaving the viewport. */
class FakeIntersectionObserver {
	static instances: FakeIntersectionObserver[] = [];
	observe = jest.fn();
	disconnect = jest.fn();

	constructor(
		public callback: LeaveCallback,
		public options?: IntersectionObserverInit,
	) {
		FakeIntersectionObserver.instances.push(this);
	}

	leave(): void {
		this.callback([{ isIntersecting: false }]);
	}
}

describe('footer reveal', () => {
	it('holds the footer only for the held token', () => {
		expect(shouldHoldFooter(' held')).toBe(true);
		expect(shouldHoldFooter('')).toBe(false);
		expect(shouldHoldFooter('open')).toBe(false);
	});

	it('treats the last few pixels as the bottom', () => {
		expect(isAtBottom(1000, 844, 1844)).toBe(true);
		expect(isAtBottom(997, 844, 1844)).toBe(true);
		expect(isAtBottom(990, 844, 1844)).toBe(false);
	});

	it('measures a pull against the distance that opens', () => {
		expect(pullProgress(36, 72)).toBe(0.5);
		expect(pullProgress(144, 72)).toBe(1);
		expect(pullProgress(-20, 72)).toBe(0);
		expect(pullProgress(10, 0)).toBe(0);
	});

	it('reads wheel deltas in pixels, lines or pages', () => {
		expect(wheelPixels({ deltaY: 100, deltaMode: 0 })).toBe(100);
		expect(wheelPixels({ deltaY: 3, deltaMode: 1 })).toBe(48);
		expect(wheelPixels({ deltaY: 1, deltaMode: 2 })).toBe(window.innerHeight);
	});

	it('reads the open glide from its token, falling back to the default', () => {
		expect(openGlideMs(' 720ms')).toBe(720);
		expect(openGlideMs('')).toBe(320);
		expect(openGlideMs('fast')).toBe(320);
		expect(openGlideMs('-5ms')).toBe(320);
	});

	it('opens with one progressive scroll curve, independent of native smooth scrolling', () => {
		jest.useFakeTimers();
		const originalMedia = window.matchMedia;
		const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')!;
		const frames: FrameRequestCallback[] = [];
		const start = 2000 - window.innerHeight;
		const height = jest
			.spyOn(document.documentElement, 'scrollHeight', 'get')
			.mockReturnValue(2000);
		const now = jest.spyOn(performance, 'now').mockReturnValue(0);
		const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
		jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
			frames.push(callback);
			return frames.length;
		});
		Object.defineProperty(window, 'scrollY', { configurable: true, value: start });
		window.matchMedia = jest.fn().mockReturnValue({ matches: false });
		const footer = document.createElement('footer');
		footer.style.setProperty('--invitation-footer-reveal', 'held');
		footer.style.setProperty('--footer-open-glide', '720ms');
		document.body.append(footer);

		try {
			holdFooterUntilSecondScroll(footer);
			now.mockReturnValue(400);
			const gesture = new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true });
			window.dispatchEvent(gesture);
			expect(gesture.defaultPrevented).toBe(true);
			expect(footer.dataset.footerReveal).toBe('open');
			height.mockReturnValue(2600);
			frames.shift()!(400);
			frames.shift()!(436);
			frames.shift()!(760);
			frames.shift()!(1120);
			const positions = scroll.mock.calls.map(([options]) => options as ScrollToOptions);
			expect(positions).toHaveLength(3);
			expect(positions.every((position) => position.behavior === 'instant')).toBe(true);
			expect(positions[0].top).toBeGreaterThan(start);
			expect(positions[0].top).toBeLessThan(start + 10);
			expect(positions[1].top).toBeGreaterThan(positions[0].top!);
			expect(positions[2].top).toBe(2600 - window.innerHeight);
		} finally {
			jest.runOnlyPendingTimers();
			document.body.replaceChildren();
			window.matchMedia = originalMedia;
			Object.defineProperty(window, 'scrollY', originalScrollY);
			jest.restoreAllMocks();
			jest.useRealTimers();
		}
	});

	it('holds the footer again once the guest leaves it well behind, and opens it once more', () => {
		jest.useFakeTimers();
		const originalMedia = window.matchMedia;
		const originalObserver = window.IntersectionObserver;
		const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')!;
		const frames: FrameRequestCallback[] = [];
		const start = 2000 - window.innerHeight;
		const height = jest
			.spyOn(document.documentElement, 'scrollHeight', 'get')
			.mockReturnValue(2000);
		const now = jest.spyOn(performance, 'now').mockReturnValue(0);
		jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
		jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
			frames.push(callback);
			return frames.length;
		});
		Object.defineProperty(window, 'scrollY', { configurable: true, value: start });
		window.matchMedia = jest.fn().mockReturnValue({ matches: false });
		FakeIntersectionObserver.instances = [];
		window.IntersectionObserver =
			FakeIntersectionObserver as unknown as typeof IntersectionObserver;
		const footer = document.createElement('footer');
		footer.style.setProperty('--invitation-footer-reveal', 'held');
		document.body.append(footer);
		const openWith = (key: string) =>
			window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));

		try {
			holdFooterUntilSecondScroll(footer);
			const firstCue = document.querySelector('.footer-pull');
			expect(firstCue).not.toBeNull();
			now.mockReturnValue(400);
			openWith('PageDown');
			expect(footer.dataset.footerReveal).toBe('open');
			expect(firstCue?.getAttribute('data-state')).toBe('away');
			// Nothing watches for the guest leaving until the glide has settled.
			height.mockReturnValue(2600);
			frames.shift()!(400);
			expect(FakeIntersectionObserver.instances).toHaveLength(0);
			frames.shift()!(1120);
			expect(FakeIntersectionObserver.instances).toHaveLength(1);
			const watch = FakeIntersectionObserver.instances[0];
			expect(watch.options?.rootMargin).toBe(REARM_ROOT_MARGIN);
			expect(watch.observe).toHaveBeenCalledWith(footer);

			// A footer still in view keeps waiting; a reader with focus inside it keeps it open.
			watch.callback([{ isIntersecting: true }]);
			expect(footer.dataset.footerReveal).toBe('open');
			const link = document.createElement('a');
			link.href = '#';
			footer.append(link);
			link.focus();
			watch.leave();
			expect(footer.dataset.footerReveal).toBe('open');
			link.blur();

			// Left well behind, the footer is held again and the lantern waits at the edge anew.
			height.mockReturnValue(2000);
			now.mockReturnValue(1500);
			watch.leave();
			expect(watch.disconnect).toHaveBeenCalled();
			expect(footer.dataset.footerReveal).toBe('held');
			const secondCue = document.querySelector('.footer-pull');
			expect(secondCue).not.toBeNull();
			expect(secondCue).not.toBe(firstCue);
			expect(secondCue?.getAttribute('data-state')).toBeNull();

			// The same gesture opens it a second time, after the same rest.
			now.mockReturnValue(1600);
			openWith('PageDown');
			expect(footer.dataset.footerReveal).toBe('held');
			now.mockReturnValue(1900);
			openWith('PageDown');
			expect(footer.dataset.footerReveal).toBe('open');
			expect(secondCue?.getAttribute('data-state')).toBe('away');
		} finally {
			jest.runOnlyPendingTimers();
			document.body.replaceChildren();
			window.matchMedia = originalMedia;
			window.IntersectionObserver = originalObserver;
			Object.defineProperty(window, 'scrollY', originalScrollY);
			jest.restoreAllMocks();
			jest.useRealTimers();
		}
	});

	it('lets wheel and touch moves cancel scrolling only while resting at the bottom', () => {
		const originalMedia = window.matchMedia;
		const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')!;
		const bottom = 2000 - window.innerHeight;
		jest.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);
		const add = jest.spyOn(window, 'addEventListener');
		const remove = jest.spyOn(window, 'removeEventListener');
		Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
		window.matchMedia = jest.fn().mockReturnValue({ matches: false });
		const footer = document.createElement('footer');
		footer.style.setProperty('--invitation-footer-reveal', 'held');
		document.body.append(footer);
		const blocking = () =>
			add.mock.calls.filter(
				([type, , options]) =>
					(type === 'wheel' || type === 'touchmove') &&
					typeof options === 'object' &&
					options?.passive === false,
			);

		try {
			holdFooterUntilSecondScroll(footer);
			expect(blocking()).toHaveLength(0);

			window.scrollY = bottom;
			window.dispatchEvent(new Event('scroll'));
			expect(blocking().map(([type]) => type)).toEqual(['wheel', 'touchmove']);

			window.scrollY = 0;
			window.dispatchEvent(new Event('scroll'));
			const released = remove.mock.calls.map(([type]) => type);
			expect(released).toEqual(expect.arrayContaining(['wheel', 'touchmove']));
		} finally {
			document.body.replaceChildren();
			window.matchMedia = originalMedia;
			Object.defineProperty(window, 'scrollY', originalScrollY);
			jest.restoreAllMocks();
		}
	});
});
