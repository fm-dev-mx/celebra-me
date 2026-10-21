import {
	holdFooterUntilSecondScroll,
	isAtBottom,
	openGlideMs,
	pullProgress,
	shouldHoldFooter,
	wheelPixels,
} from '@/lib/invitation/footer-reveal';

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
});
