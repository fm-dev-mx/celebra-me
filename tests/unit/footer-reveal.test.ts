import {
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
});
