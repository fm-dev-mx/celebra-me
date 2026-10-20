import { isAtBottom, shouldHoldFooter } from '@/lib/invitation/footer-reveal';

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
});
